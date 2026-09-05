import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { initDb } from './db/client.js';
import { cache } from './cache/redis.js';
import { marketPoller } from './services/poller.js';
import { wsManager } from './services/wsManager.js';
import { authRoutes } from './routes/auth.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { simRoutes } from './routes/sim.js';

// Extend Fastify types for JWT authentication
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'warn',
    },
  });

  // 1. Initialize Database Schema
  console.log('[Bootstrap] Initializing database...');
  await initDb();

  // 2. Initialize Redis Cache & PubSub
  console.log('[Bootstrap] Initializing cache...');
  await cache.init();

  // 3. Register CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // 4. Register JWT
  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
    }
  });

  // 5. Register WebSockets
  await fastify.register(websocket);

  fastify.register(async (instance) => {
    instance.get('/ws', { websocket: true }, (socket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

      let userId = 'anonymous';
      if (token) {
        try {
          const decoded = fastify.jwt.verify<{ userId: string }>(token);
          userId = decoded.userId;
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid authentication token' }));
          socket.close(1008, 'Invalid token');
          return;
        }
      } else {
        socket.send(JSON.stringify({ type: 'error', message: 'Authentication token required' }));
        socket.close(1008, 'Token required');
        return;
      }

      wsManager.registerClient(socket, userId);
    });
  });

  // 6. Register REST Routes
  await fastify.register(authRoutes);
  await fastify.register(watchlistRoutes);
  await fastify.register(simRoutes);

  // Health check endpoint
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'smart-market-watchlist-backend',
  }));

  // 7. Start Poller Service
  await marketPoller.start();

  // 8. Start HTTP / WS Server
  try {
    const address = await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n======================================================`);
    console.log(`🚀 Smart Watchlist Backend running at: ${address}`);
    console.log(`🔌 WebSocket Stream endpoint: ws://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/ws?token=<JWT>`);
    console.log(`======================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n[Shutdown] Received ${signal}. Closing gracefully...`);
      marketPoller.stop();
      await cache.close();
      await fastify.close();
      process.exit(0);
    });
  }
}

bootstrap().catch(err => {
  console.error('[Fatal Bootstrap Error]:', err);
  process.exit(1);
});
