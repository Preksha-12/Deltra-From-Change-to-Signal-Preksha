import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'smart-watchlist-dev-jwt-secret-key-32charsmin!',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  snapshotIntervalMs: parseInt(process.env.SNAPSHOT_INTERVAL_MS || '15000', 10),
  significanceThreshold: parseFloat(process.env.SIGNIFICANCE_THRESHOLD || '1.5'),
  volatilityFloor: parseFloat(process.env.VOLATILITY_FLOOR || '0.2'),
  dataPath: path.resolve(process.cwd(), 'data'),
};
