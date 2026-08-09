import { Router as ExpressRouter } from 'express';

/**
 * Express 4 does not understand async handlers.
 *
 * When an `async (req, res) => { ... }` handler rejects — a MySQL constraint, a
 * malformed row, anything — Express never sees it. It becomes an unhandled
 * promise rejection, and Node 15+ terminates the process on those by default.
 * One bad request therefore killed the entire API for every user, who saw a 502
 * until Kubernetes restarted the pod. That is exactly the failure this replaces.
 *
 * This wrapper forwards a rejected handler to `next(err)`, so it lands in the
 * error middleware and the caller gets a 500 with a message while the server
 * stays up. Import `Router` from here instead of from 'express' in every route
 * file — the whole point is that no handler is left unguarded, so a plain
 * `import { Router } from 'express'` in a route module is a bug.
 */
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all', 'use'];

function wrap(handler) {
  // Paths, arrays and sub-routers pass through untouched.
  if (typeof handler !== 'function') return handler;
  // Express identifies error middleware by arity; wrapping would break that.
  if (handler.length === 4) return handler;

  const wrapped = function asyncSafeHandler(req, res, next) {
    try {
      const result = handler.call(this, req, res, next);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(next);
      }
      return result;
    } catch (err) {
      next(err);
      return undefined;
    }
  };
  Object.defineProperty(wrapped, 'name', { value: handler.name || 'handler' });
  return wrapped;
}

export function Router(...args) {
  const router = ExpressRouter(...args);
  for (const method of METHODS) {
    const original = router[method];
    if (typeof original !== 'function') continue;
    router[method] = (...handlers) => original.apply(router, handlers.map(wrap));
  }
  return router;
}

export default Router;
