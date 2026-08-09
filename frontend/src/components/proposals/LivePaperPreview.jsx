import { FileDown, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { fmtMoney, fmtDate } from '@/api/utils.js';
import { DAYS, formatTime12 } from './utils/quoteMath.js';
import { useVisibility } from './VisibilityContext.jsx';

function Money({ n, cur }) {
  return <span className="tabular-nums">{fmtMoney(n, cur)}</span>;
}

/** Mirrors the PDF: oversized soft-blue numeral, letterspaced title, hairline rule. */
function SectionHead({ no, children }) {
  return (
    <div className="mb-2 mt-3 border-b border-[#0d47a1] pb-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-bold leading-none text-[#93aed6]">{no}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d47a1]">{children}</span>
      </div>
    </div>
  );
}

export default function LivePaperPreview({
  q,
  season,
  quoteNo,
  customer,
  schedules,
  specialNotes,
  installments,
  items = [],
  totals,
  contractAmount,
  onPdf,
  onExcel,
  canExport,
}) {
  const { isHidden, hidden } = useVisibility();
  const show = (k) => !isHidden(k);

  const normal = DAYS.map(([day, label]) => {
    const r = schedules.find((s) => s.season_type === 'normal' && s.day_label === day);
    return { label, r };
  });
  const okul = DAYS.map(([day, label]) => {
    const r = schedules.find((s) => s.season_type === 'okul' && s.day_label === day);
    return { label, r };
  });
  const half = Math.ceil(installments.length / 2);
  const left = installments.slice(0, half);
  const right = installments.slice(half);
  const totalHours = Number(q.lifeguard_count || 0) * Number(q.hours_per_week || 0);
  const lineItems = items.filter((it) => it.description?.trim());

  const seasonTables = [['Normal / Season', normal]];
  if (show('spec.scheduleSchool')) seasonTables.push(['School / Off Season', okul]);

  /**
   * Built as a list so the numbering matches the PDF: hidden sections are
   * dropped and the remaining ones renumber, rather than leaving a gap.
   */
  // Facility and Owner / Agent name the same party on most properties, so each
  // column can be hidden on its own; the survivor then spans the full width.
  const propertyCols = [
    show('spec.propertyFacility') && {
      key: 'facility',
      heading: 'Facility',
      name: q.facility_name,
      detail: q.facility_address,
    },
    show('spec.propertyOwner') && {
      key: 'owner',
      heading: 'Owner / Agent',
      name: customer?.name,
      detail: customer?.address || customer?.city,
    },
  ].filter(Boolean);

  const sections = [];
  if (show('spec.property') && propertyCols.length) {
    sections.push({
      title: 'Property Information',
      node: (
        <div className={`mb-4 grid gap-3 ${propertyCols.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {propertyCols.map((c) => (
            <div key={c.key}>
              <div className="mb-0.5 font-semibold text-slate-500">{c.heading}</div>
              <div className="font-semibold">{c.name || '—'}</div>
              <div className="text-slate-600">{c.detail || '—'}</div>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (show('spec.duration')) {
    sections.push({
      title: 'Duration & Schedule',
      node: (
        <>
          <p className="mb-3 text-slate-700">
            The pool will be maintained between <strong>{fmtDate(q.season_start)}</strong> and{' '}
            <strong>{fmtDate(q.season_end)}</strong>
            {season?.valid ? ` — ${season.weeksLabel}, ${season.openDays} operating days.` : '.'}
          </p>

          {show('spec.schedule') && (
            <div className={`mb-3 grid gap-3 ${seasonTables.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {seasonTables.map(([title, rows]) => (
                <div key={title}>
                  <div className="mb-1 font-semibold text-slate-900">{title}</div>
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="border-b border-[#0d47a1] text-[#0d47a1]">
                        <th className="px-1 py-0.5 text-left font-semibold">Day</th>
                        <th className="px-1 py-0.5">Open</th>
                        <th className="px-1 py-0.5">Close</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, r }) => (
                        <tr key={label} className="border-b border-slate-200">
                          <td className="px-1 py-0.5">{label}</td>
                          <td className="px-1 py-0.5 text-center">
                            {r?.is_closed ? 'Closed' : formatTime12(r?.open_time)}
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            {r?.is_closed ? '—' : formatTime12(r?.close_time)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {show('spec.personnel') && (
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <span>
                <strong>Lifeguards:</strong> {Number(q.lifeguard_count || 0)}
              </span>
              <span>
                <strong>Operating days:</strong> {season ? `${season.openDays} / ${season.days}` : '\u2014'}
              </span>
              <span>
                <strong>Staff hrs/wk:</strong> {season ? season.avgWeeklyStaffHours : '\u2014'}
              </span>
              <span>
                <strong>Season hrs:</strong> {season ? season.staffHours : '\u2014'}
              </span>
            </div>
          )}
        </>
      ),
    });
  }

  if (show('spec.comments')) {
    const visibleNotes = specialNotes.filter((n) => n.body?.trim());
    sections.push({
      title: 'Additional Comments',
      node: (
        <ul className="mb-4 list-none space-y-0.5">
          {(visibleNotes.length ? visibleNotes : [{ label: '—', body: 'None.' }]).map((n, i) => (
            <li key={i}>
              <strong>{n.label ? `${n.label}. ` : ''}</strong>
              {n.body}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (show('spec.compensation')) {
    sections.push({
      title: 'Compensation Schedule',
      node: (
        <>
          {show('spec.items') && lineItems.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">Services Included</div>
              <table className="mb-2 w-full border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-[#0d47a1] text-[#0d47a1]">
                    <th className="px-1 py-0.5 text-left">Description</th>
                    <th className="px-1 py-0.5 text-right">Qty</th>
                    <th className="px-1 py-0.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="px-1 py-0.5">{it.description}</td>
                      <td className="px-1 py-0.5 text-right">{it.quantity}</td>
                      <td className="px-1 py-0.5 text-right">
                        <Money n={Number(it.quantity || 0) * Number(it.unit_price || 0)} cur={q.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {show('spec.totals') && (
            <div className="mb-2 flex flex-wrap justify-between gap-2">
              <div>
                <span className="text-slate-500">Total Contract Price: </span>
                <strong>
                  <Money n={totals.total} cur={q.currency} />
                </strong>
              </div>
              {Number(q.early_bird_discount) > 0 && show('spec.earlyBird') && (
                <div>
                  <span className="text-slate-500">Early Bird: </span>
                  <strong>
                    <Money n={contractAmount} cur={q.currency} />
                  </strong>
                </div>
              )}
            </div>
          )}

          {show('spec.installments') && (
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <div className="space-y-0.5">
                {left.map((inst, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>Due: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                    <span>
                      <Money n={inst.amount} cur={q.currency} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5">
                {right.map((inst, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>Due: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                    <span>
                      <Money n={inst.amount} cur={q.currency} />
                    </span>
                  </div>
                ))}
              </div>
              {installments.length === 0 && (
                <div className="col-span-2 italic text-slate-400">No payment schedule yet.</div>
              )}
            </div>
          )}
        </>
      ),
    });
  }

  if (show('spec.acceptance')) {
    sections.push({
      title: 'Acceptance',
      node: (
        <div className="grid grid-cols-2 gap-6 pt-2">
          <div>
            <div className="font-semibold">OWNER / CLIENT</div>
            <div className="mt-3 border-b border-slate-300 pb-1 text-slate-400">Signature</div>
            <div className="mt-2 text-[9px] text-slate-400">Title · Company · Date</div>
          </div>
          <div>
            <div className="font-semibold">CONTRACTOR</div>
            <div className="mt-3 border-b border-slate-300 pb-1 text-slate-400">Signature</div>
            <div className="mt-2 text-[9px] text-slate-400">Title · Date</div>
          </div>
        </div>
      ),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Live contract preview</div>
          <div className="text-xs text-muted-foreground">
            {hidden.length > 0
              ? `${hidden.length} block${hidden.length === 1 ? '' : 's'} hidden from the PDF`
              : 'Digital paper simulation of the customer PDF'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!canExport} onClick={onExcel}>
            <Sheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button type="button" variant="accent" size="sm" className="gap-1.5" disabled={!canExport} onClick={onPdf}>
            <FileDown className="h-3.5 w-3.5" />
            Review PDF
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto rounded-2xl bg-gradient-to-b from-slate-200/80 to-slate-300/50 p-3 sm:p-6">
        <div className="mx-auto min-h-[560px] max-w-[520px] origin-top rounded-[2px] bg-white px-4 py-6 text-[10.5px] leading-relaxed text-slate-800 shadow-paper ring-1 ring-black/5 transition-transform duration-300 sm:min-h-[720px] sm:px-7 sm:py-8">
          {show('spec.header') && (
            <div className="mb-5 text-center">
              <div className="text-[9px] italic text-slate-500">
                Commercial Swimming Pool Management Agreement
              </div>
              <div className="mt-2 text-[13px] font-bold tracking-wide text-slate-900">
                Contract : {quoteNo || 'DRAFT'}
              </div>
              <div className="mt-2 text-[12px] font-semibold">{q.facility_name || 'Facility Name'}</div>
              <div className="text-[10px] text-slate-500">{q.facility_address || 'Facility address'}</div>
            </div>
          )}

          {sections.map((s, i) => (
            <div key={s.title}>
              <SectionHead no={i + 1}>{s.title}</SectionHead>
              {s.node}
            </div>
          ))}

          {sections.length === 0 && (
            <p className="py-10 text-center text-[11px] italic text-slate-400">
              Every specification section is hidden — the PDF would print the cover and terms only.
            </p>
          )}

          <div className="mt-6 flex items-center justify-between text-[9px] text-slate-400">
            <span>{show('footer.initials') ? 'Owner’s Initial(s) ______' : ''}</span>
            <Badge variant="outline" className="text-[9px]">
              Live Preview
            </Badge>
            <span>{show('footer.pageNo') ? 'Page 2 of ·' : ''}</span>
          </div>
        </div>
      </div>

      {!canExport && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Save the proposal before exporting PDF / Excel.
        </p>
      )}
    </div>
  );
}
