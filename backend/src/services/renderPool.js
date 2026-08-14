import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { buildQuotePdf } from './pdf.js';
import { buildQuoteExcel } from './excel.js';

/**
 * A tiny worker pool for contract exports.
 *
 * Building a PDF or an Excel workbook is synchronous CPU work measured in
 * seconds. Doing it on the main thread blocked the event loop, so every other
 * request — the customer list, the contract list, even /health — sat in the
 * queue behind it. That is what made an export look like a two-minute wait when
 * the render itself takes a second or two: almost all of it was queueing.
 *
 * The pool is deliberately small. This app shares a host with other sites, and
 * spare cores are the scarce resource; two render threads are enough to keep the
 * API responsive without competing with MySQL for CPU.
 */

const WORKER_URL = new URL('./renderWorker.js', import.meta.url);

const INLINE_BUILDERS = { pdf: buildQuotePdf, excel: buildQuoteExcel };

function poolSize() {
  const configured = Number(process.env.RENDER_WORKERS);
  if (Number.isFinite(configured) && configured >= 0) return Math.trunc(configured);
  const cores = os.cpus()?.length || 1;
  return Math.max(1, Math.min(2, cores - 1));
}

const SIZE = poolSize();
/** Same watchdog the routes used to apply themselves — a render must not hang forever. */
const JOB_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS) || 25000;
/** Past this the server is already saturated; a fast 503 beats a request that never answers. */
const MAX_QUEUE = Number(process.env.RENDER_QUEUE_MAX) || 32;

/** @type {Array<{worker: import('node:worker_threads').Worker, job: object|null}>} */
const pool = [];
const queue = [];
let seq = 0;
let spawnFailures = 0;
/** Set once workers prove unavailable; renders then run inline rather than 500. */
let workersDisabled = SIZE === 0;

function spawn() {
  const entry = { worker: null, job: null };
  const worker = new Worker(WORKER_URL);
  entry.worker = worker;
  // The HTTP server keeps the process alive; an idle render thread should not.
  worker.unref();

  worker.on('message', (msg) => {
    if (!msg || msg.ready) return; // boot handshake, not a job result
    if (!entry.job || entry.job.id !== msg.id) return;
    settle(entry, msg.ok ? null : new Error(msg.error || 'Render failed.'), msg.bytes);
  });
  worker.on('error', (err) => discard(entry, err));
  worker.on('exit', (code) => {
    if (pool.includes(entry)) discard(entry, new Error(`Render worker exited with code ${code}.`));
  });

  pool.push(entry);
  return entry;
}

/** Finish the job this worker was holding and hand it the next one. */
function settle(entry, err, bytes) {
  const job = entry.job;
  entry.job = null;
  if (job) {
    clearTimeout(job.timer);
    if (err) job.reject(err);
    else job.resolve(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  }
  pump();
}

/** Drop a worker that died or timed out; its job fails and the slot reopens. */
function discard(entry, err) {
  const i = pool.indexOf(entry);
  if (i !== -1) pool.splice(i, 1);
  const job = entry.job;
  entry.job = null;
  if (job) {
    clearTimeout(job.timer);
    job.reject(err);
  }
  entry.worker.terminate().catch(() => {});
  pump();
}

function pump() {
  while (queue.length) {
    let entry = pool.find((e) => !e.job);
    if (!entry) {
      if (pool.length >= SIZE) return;
      try {
        entry = spawn();
        spawnFailures = 0;
      } catch (err) {
        spawnFailures += 1;
        console.error('[render] Could not start a render worker:', err.message);
        // Two failures in a row means workers are not usable in this
        // environment (locked-down container, no thread support). Fall back to
        // in-process rendering: slower for everyone else, but it still answers.
        if (spawnFailures >= 2) workersDisabled = true;
        drainInline();
        return;
      }
    }
    const job = queue.shift();
    entry.job = job;
    job.timer = setTimeout(
      () => discard(entry, new Error(`${job.kind === 'pdf' ? 'PDF' : 'Excel'} generation timed out after ${JOB_TIMEOUT_MS / 1000}s`)),
      JOB_TIMEOUT_MS
    );
    entry.worker.postMessage({ id: job.id, kind: job.kind, quote: job.quote, setting: job.setting });
  }
}

/** Last resort when no worker can be started — renders on the main thread. */
function drainInline() {
  while (queue.length) {
    const job = queue.shift();
    clearTimeout(job.timer);
    runInline(job.kind, job.quote, job.setting).then(job.resolve, job.reject);
  }
}

async function runInline(kind, quote, setting) {
  const build = INLINE_BUILDERS[kind];
  if (!build) throw new Error(`Unknown render kind "${kind}".`);
  // The watchdog cannot interrupt synchronous work, but pdfmake signals through
  // stream events: if it ever finished without emitting 'end' or 'error' the
  // promise would never settle and the request would hang until the proxy gave
  // up with a 502. Losing the race turns that into an honest error instead.
  let timer;
  const guard = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${kind === 'pdf' ? 'PDF' : 'Excel'} generation timed out after ${JOB_TIMEOUT_MS / 1000}s`)),
      JOB_TIMEOUT_MS
    );
  });
  return Promise.race([build(quote, setting || {}), guard]).finally(() => clearTimeout(timer));
}

/**
 * Render a contract off the request thread.
 *
 * @param {'pdf'|'excel'} kind
 * @param {object} quote   plain object (quote.toJSON()) — it crosses a thread boundary
 * @param {object} setting plain object (setting.toJSON())
 * @returns {Promise<Buffer>}
 */
export function renderDocument(kind, quote, setting = {}) {
  if (!INLINE_BUILDERS[kind]) return Promise.reject(new Error(`Unknown render kind "${kind}".`));
  if (workersDisabled) return runInline(kind, quote, setting);

  if (queue.length >= MAX_QUEUE) {
    const busy = new Error('The server is busy generating other documents. Please try again in a moment.');
    busy.status = 503;
    return Promise.reject(busy);
  }

  return new Promise((resolve, reject) => {
    seq += 1;
    queue.push({ id: seq, kind, quote, setting, resolve, reject, timer: null });
    pump();
  });
}

/** Starts one worker at boot so the first export does not pay the spawn cost. */
export function warmUpRenderPool() {
  if (workersDisabled || pool.length) return;
  try {
    spawn();
  } catch (err) {
    console.warn('[render] Warm-up failed, workers will be retried on first export:', err.message);
  }
}

export async function shutdownRenderPool() {
  await Promise.all(pool.splice(0).map((e) => e.worker.terminate().catch(() => {})));
}
