import pg from 'pg';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.postgres.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  }
});

dbPool.on('error', (err) => {
  console.error('[Postgres] Error inesperado en pool de conexiones:', err);
});

redisClient.on('connect', () => {
  console.log('[Redis] Conexión establecida con éxito.');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Error de conexión:', err);
});
