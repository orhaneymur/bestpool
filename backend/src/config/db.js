import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'havuz_teklif',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    /**
     * Off by default. Set SLOW_QUERY_MS to log any statement that takes longer
     * than that many milliseconds — the cheapest way to find out which query is
     * responsible the next time a screen feels slow, without turning on the
     * general log and drowning in noise.
     */
    benchmark: !!Number(process.env.SLOW_QUERY_MS),
    logging: Number(process.env.SLOW_QUERY_MS)
      ? (sql, timingMs) => {
          if (timingMs >= Number(process.env.SLOW_QUERY_MS)) {
            console.warn(`[db] slow query ${timingMs}ms: ${String(sql).slice(0, 300)}`);
          }
        }
      : false,
    define: {
      underscored: true,
      freezeTableName: false,
      // Zaman damgası attribute adlarını açıkça snake_case yap:
      // böylece hem sütun hem JS erişimi created_at / updated_at olur.
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    /**
     * `acquire` was 30s: when the pool was saturated a request would sit there
     * for half a minute before erroring, which is long past the point where the
     * user has given up. Ten seconds still absorbs a burst but surfaces real
     * contention quickly, and a warm minimum connection keeps the first request
     * after an idle spell from paying for a handshake.
     */
    pool: { max: Number(process.env.DB_POOL_MAX) || 15, min: 1, acquire: 10000, idle: 10000 },
  }
);

export async function connectWithRetry(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await sequelize.authenticate();
      console.log('[db] MySQL bağlantısı başarılı.');
      return;
    } catch (err) {
      console.warn(`[db] Bağlantı denemesi ${i}/${retries} başarısız: ${err.message}`);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
