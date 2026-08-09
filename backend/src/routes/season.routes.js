import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { computeSeason, holidaysInSeason } from '../services/seasonCalendar.js';

const router = Router();
router.use(auth());

/**
 * Season maths for the wizard's live figures.
 *
 * The wizard deliberately does NOT do this arithmetic itself. The invoice, the
 * saved contract and the PDF all read from services/seasonCalendar.js, so
 * calculating it a second time in the browser would be a standing invitation for
 * the quoted hours and the printed hours to drift apart.
 */
router.post('/preview', (req, res) => {
  const body = req.body || {};
  res.json(
    computeSeason({
      season_start: body.season_start,
      season_end: body.season_end,
      schedules: Array.isArray(body.schedules) ? body.schedules : [],
      lifeguard_count: body.lifeguard_count,
      school_closes: body.school_closes,
      school_reopens: body.school_reopens,
      holiday_policy: body.holiday_policy,
    })
  );
});

/** US public holidays falling inside a date range, without the rest of the maths. */
router.get('/holidays', (req, res) => {
  res.json(holidaysInSeason(req.query.start, req.query.end));
});

export default router;
