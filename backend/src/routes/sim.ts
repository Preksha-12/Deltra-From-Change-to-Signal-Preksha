import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { marketSim } from '../sim/marketGenerator.js';
import { marketPoller } from '../services/poller.js';

const TriggerSchema = z.object({
  action: z.enum(['price_shock', 'volume_spike', 'pause_symbol', 'out_of_order', 'market_toggle']),
  symbol: z.string().optional(),
  pct: z.number().optional(),
  multiplier: z.number().optional(),
  paused: z.boolean().optional(),
  open: z.boolean().optional(),
});

export const simRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /sim/status
  fastify.get('/sim/status', async (_request, reply) => {
    return reply.send({
      status: marketSim.getChaosStatus(),
    });
  });

  // GET /sim/universe (popular available tickers)
  fastify.get('/sim/universe', async (_request, reply) => {
    return reply.send({
      symbols: marketSim.getAllKnownSymbols(),
    });
  });

  // POST /sim/trigger (Execute chaos or anomaly for live testing)
  fastify.post('/sim/trigger', async (request, reply) => {
    const parseResult = TriggerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid trigger parameters',
        details: parseResult.error.errors.map(e => e.message),
      });
    }

    const { action, symbol = 'AAPL', pct = 4.0, multiplier = 3.5, paused = true, open = true } = parseResult.data;
    const upper = symbol.toUpperCase();

    switch (action) {
      case 'price_shock':
        marketSim.injectPriceShock(upper, pct);
        // Trigger immediate poll cycle to observe effect right away
        await marketPoller.pollCycle();
        return reply.send({
          message: `Injected price shock of ${pct > 0 ? '+' : ''}${pct}% on ${upper}`,
          action,
          symbol: upper,
        });

      case 'volume_spike':
        marketSim.injectVolumeSpike(upper, multiplier);
        await marketPoller.pollCycle();
        return reply.send({
          message: `Injected volume surge of ${multiplier}x on ${upper}`,
          action,
          symbol: upper,
        });

      case 'pause_symbol':
        marketSim.setSymbolPaused(upper, paused);
        return reply.send({
          message: `${paused ? 'Paused' : 'Resumed'} live ticks for ${upper} (simulates provider lag)`,
          action,
          symbol: upper,
          paused,
        });

      case 'out_of_order':
        marketSim.injectOutOfOrderTick(upper);
        await marketPoller.pollCycle();
        return reply.send({
          message: `Injected out-of-order tick (stamped 2m ago) for ${upper} — verified dropped by apply-if-newer rule`,
          action,
          symbol: upper,
        });

      case 'market_toggle':
        marketSim.setMarketOpen(open);
        await marketPoller.pollCycle();
        return reply.send({
          message: `Market is now ${open ? 'OPEN' : 'CLOSED'}`,
          action,
          open,
        });

      default:
        return reply.status(400).send({ error: 'Unknown action' });
    }
  });
};
