import { sequelize } from '../config/db.js';

/**
 * Production-safe column ensures (when DB_SYNC alter is flaky or skipped).
 * Fixes "Unknown column 'x'" save failures after an app upgrade.
 *
 * Add every new column here as well as in models/index.js. The two are not
 * generated from each other on purpose: `sequelize.sync({ alter: true })` is not
 * run in production, so this list is what actually reaches the live database.
 */
const COLUMNS = [
  { table: 'quotes', column: 'county', ddl: 'VARCHAR(80) NULL', after: 'hours_per_week' },
  { table: 'quotes', column: 'peak_weeks', ddl: 'INT NOT NULL DEFAULT 0', after: 'county' },
  { table: 'quotes', column: 'hidden_fields', ddl: 'JSON NULL' },
  { table: 'quotes', column: 'school_closes', ddl: 'DATE NULL' },
  { table: 'quotes', column: 'school_reopens', ddl: 'DATE NULL' },
  { table: 'quotes', column: 'holiday_policy', ddl: 'JSON NULL' },
  { table: 'settings', column: 'definitions', ddl: 'JSON NULL' },
];

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

async function tableExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table`,
    { replacements: { table } }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

export async function ensureSchemaPatches() {
  for (const { table, column, ddl, after } of COLUMNS) {
    // One try/catch per column: a single failure (say the MySQL build has no JSON
    // type) must not stop the remaining patches from being applied.
    try {
      if (!(await tableExists(table))) continue;
      if (await columnExists(table, column)) continue;
      const position = after && (await columnExists(table, after)) ? ` AFTER \`${after}\`` : '';
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}${position}`);
      console.log(`[db] Added ${table}.${column}`);
    } catch (err) {
      console.warn(`[db] Schema patch warning (${table}.${column}):`, err.message);
    }
  }
}
