import { parentPort } from 'node:worker_threads';
import { buildQuotePdf, warmUpPdf } from './pdf.js';
import { buildQuoteExcel } from './excel.js';

/**
 * Worker side of the render pool (see renderPool.js).
 *
 * Everything expensive about a contract — pdfmake's layout engine, ExcelJS's
 * workbook serialisation — is synchronous CPU work. Run on the main thread it
 * froze the whole API for the duration, which is why a customer list could take
 * minutes to arrive while somebody else was exporting a PDF.
 *
 * One job at a time; the pool never sends a second message to a busy worker.
 */
const BUILDERS = {
  pdf: buildQuotePdf,
  excel: buildQuoteExcel,
};

// Decode the fonts now rather than inside the first request that lands here.
try {
  warmUpPdf();
} catch (err) {
  console.warn('[render] Font warm-up failed, first PDF will pay the cost:', err.message);
}

parentPort.on('message', async ({ id, kind, quote, setting }) => {
  try {
    const build = BUILDERS[kind];
    if (!build) throw new Error(`Unknown render kind "${kind}".`);
    const buffer = await build(quote, setting || {});
    // Copied into a standalone ArrayBuffer so it can be transferred rather than
    // cloned — a Buffer from the pool would drag its whole 8 KB slab along.
    const bytes = new Uint8Array(buffer);
    parentPort.postMessage({ id, ok: true, bytes }, [bytes.buffer]);
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
});

parentPort.postMessage({ ready: true });
