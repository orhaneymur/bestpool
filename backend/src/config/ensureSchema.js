import { sequelize } from '../config/db.js';

/**
 * Production-safe column ensures (when DB_SYNC alter is flaky or skipped).
 * Fixes "Unknown column 'county'" / similar save failures after app upgrades.
 */
async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
       AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

export async function ensureSchemaPatches() {
  try {
    if (!(await columnExists('quotes', 'county'))) {
      await sequelize.query(
        'ALTER TABLE quotes ADD COLUMN county VARCHAR(80) NULL AFTER hours_per_week'
      );
      console.log('[db] Added quotes.county');
    }
    if (!(await columnExists('quotes', 'peak_weeks'))) {
      await sequelize.query(
        'ALTER TABLE quotes ADD COLUMN peak_weeks INT NOT NULL DEFAULT 0 AFTER county'
      );
      console.log('[db] Added quotes.peak_weeks');
    }
  } catch (err) {
    console.warn('[db] Schema patch warning:', err.message);
  }
}
