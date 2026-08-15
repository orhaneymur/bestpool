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
  { table: 'settings', column: 'signature_image', ddl: 'LONGTEXT NULL' },
  { table: 'quote_notes', column: 'is_bold', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
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

/**
 * Indexes the app actually needs, applied the same way as the columns above:
 * declared in models/index.js for a fresh database, ensured here for the live
 * one, because sync({ alter: true }) is not what reaches production.
 *
 * Without these, both list screens read the whole table and sorted it on every
 * request — the single biggest cause of "the customer list takes forever".
 */
const INDEXES = [
  { table: 'customers', name: 'idx_customers_name', columns: ['name'] },
  { table: 'quotes', name: 'idx_quotes_created', columns: ['created_at'] },
  { table: 'quotes', name: 'idx_quotes_status_created', columns: ['status', 'created_at'] },
  { table: 'quotes', name: 'idx_quotes_customer', columns: ['customer_id'] },
  { table: 'quotes', name: 'idx_quotes_season_start', columns: ['season_start'] },
  { table: 'quote_items', name: 'idx_quote_items_quote', columns: ['quote_id'] },
  { table: 'quote_installments', name: 'idx_quote_installments_quote', columns: ['quote_id'] },
  { table: 'quote_schedules', name: 'idx_quote_schedules_quote', columns: ['quote_id'] },
  { table: 'quote_notes', name: 'idx_quote_notes_quote', columns: ['quote_id'] },
];

/** Every index on a table as `{ indexName: ['col', 'col'] }`, in column order. */
async function readIndexes(table) {
  const [rows] = await sequelize.query(
    `SELECT INDEX_NAME AS name, SEQ_IN_INDEX AS seq, COLUMN_NAME AS column_name
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    { replacements: { table } }
  );
  const byName = new Map();
  for (const row of rows) {
    if (!byName.has(row.name)) byName.set(row.name, []);
    byName.get(row.name).push(row.column_name);
  }
  return byName;
}

/**
 * True when some existing index already starts with exactly these columns.
 *
 * Matching on the leading columns rather than on the index name matters: MySQL
 * creates an index for every foreign key, so `quote_items.quote_id` is usually
 * already covered under a different name. Adding our own would duplicate it and
 * make writes slower, not faster.
 */
function alreadyCovered(existing, columns) {
  for (const cols of existing.values()) {
    if (cols.length >= columns.length && columns.every((c, i) => cols[i] === c)) return true;
  }
  return false;
}

export async function ensureIndexes() {
  for (const { table, name, columns } of INDEXES) {
    try {
      if (!(await tableExists(table))) continue;
      const existing = await readIndexes(table);
      if (existing.has(name) || alreadyCovered(existing, columns)) continue;
      const cols = columns.map((c) => `\`${c}\``).join(', ');
      // Blocks until MySQL has built it. On a table this size that is seconds
      // at worst, and it happens once, at boot, before traffic matters.
      await sequelize.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${cols})`);
      console.log(`[db] Added index ${name} on ${table}(${columns.join(', ')})`);
    } catch (err) {
      console.warn(`[db] Index warning (${table}.${name}):`, err.message);
    }
  }
}

/**
 * sync({ alter: true }) has a habit of re-adding a unique constraint on every
 * boot, so a long-running install can end up with quote_no_2, quote_no_3 … each
 * one more write amplification and a step closer to MySQL's 64-index ceiling.
 *
 * Dropping indexes automatically is not something a boot sequence should do, so
 * this only reports — with the statements to run by hand after a look.
 */
export async function reportRedundantIndexes() {
  for (const table of ['quotes', 'customers', 'users', 'service_items', 'service_categories']) {
    try {
      if (!(await tableExists(table))) continue;
      const existing = await readIndexes(table);
      const seen = new Map();
      const duplicates = [];
      for (const [name, cols] of existing) {
        if (name === 'PRIMARY') continue;
        const signature = cols.join(',');
        if (seen.has(signature)) duplicates.push(name);
        else seen.set(signature, name);
      }
      if (duplicates.length) {
        console.warn(
          `[db] ${table} has ${duplicates.length} redundant index(es). Review, then drop by hand:\n` +
            duplicates.map((n) => `      ALTER TABLE \`${table}\` DROP INDEX \`${n}\`;`).join('\n')
        );
      }
    } catch (err) {
      console.warn(`[db] Could not inspect indexes on ${table}:`, err.message);
    }
  }
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
  await ensureIndexes();
  await reportRedundantIndexes();
}
