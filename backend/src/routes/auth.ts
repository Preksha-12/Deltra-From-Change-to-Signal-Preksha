import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Signup
  fastify.post('/auth/signup', async (request, reply) => {
    const parseResult = AuthSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors.map(e => e.message),
      });
    }

    const { email, password } = parseResult.data;
    const db = await getDbClient();

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const insertRes = await db.query<{ id: string; email: string; created_at: string }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase(), passwordHash]
    );
    const user = insertRes.rows[0];

    // Seed default watchlist symbols for great immediate user experience
    const initialSymbols = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];
    for (const sym of initialSymbols) {
      try {
        await db.query(
          'INSERT INTO watchlist_items (user_id, symbol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, sym]
        );
      } catch {
        // ignore duplicate
      }
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });
    return reply.status(201).send({
      message: 'Account created successfully',
      token,
      user: { id: user.id, email: user.email },
    });
  });

  // Login
  fastify.post('/auth/login', async (request, reply) => {
    const parseResult = AuthSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors.map(e => e.message),
      });
    }

    const { email, password } = parseResult.data;
    const db = await getDbClient();

    const userRes = await db.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });
    return reply.send({
      token,
      user: { id: user.id, email: user.email },
    });
  });

  // Verify / Me
  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUser = (request as any).user;
    const db = await getDbClient();
    const res = await db.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE id = $1',
      [authUser.userId]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ user: res.rows[0] });
  });
};
