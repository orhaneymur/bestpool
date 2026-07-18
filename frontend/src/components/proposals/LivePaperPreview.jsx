import { FileDown, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { fmtMoney, fmtDate } from '@/api/utils.js';
import { DAYS, formatTime12 } from './utils/quoteMath.js';

function Money({ n, cur }) {
  return <span className="tabular-nums">{fmtMoney(n, cur)}</span>;
}

export default function LivePaperPreview({
  q,
  quoteNo,
  customer,
  schedules,
  specialNotes,
  installments,
  totals,
  contractAmount,
  onPdf,
  onExcel,
  canExport,
}) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">Live contract preview</div>
          <div className="text-xs text-muted-foreground">Digital paper simulation of the customer PDF</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!canExport} onClick={onExcel}>
            <Sheet className="h-3.5 w-3.5" />
            Excel Report
          </Button>
          <Button type="button" variant="accent" size="sm" className="gap-1.5" disabled={!canExport} onClick={onPdf}>
            <FileDown className="h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto rounded-2xl bg-gradient-to-b from-slate-200/80 to-slate-300/50 p-4 sm:p-6">
        <div className="mx-auto min-h-[720px] max-w-[520px] origin-top rounded-[2px] bg-white px-7 py-8 text-[10.5px] leading-relaxed text-slate-800 shadow-paper ring-1 ring-black/5 transition-transform duration-300 sm:scale-100">
          {/* Cover-ish header */}
          <div className="mb-5 text-center">
            <div className="text-[9px] italic text-slate-500">Commercial Swimming Pool Management Agreement</div>
            <div className="mt-2 text-[13px] font-bold tracking-wide text-slate-900">PROPOSAL #{quoteNo || 'DRAFT'}</div>
            <div className="mt-2 text-[12px] font-semibold">{q.facility_name || 'Facility Name'}</div>
            <div className="text-[10px] text-slate-500">{q.facility_address || 'Facility address'}</div>
          </div>

          <div className="mb-3 border-b border-slate-900 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            Section I. Property Information
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-0.5 font-semibold text-slate-500">Facility</div>
              <div className="font-semibold">{q.facility_name || '—'}</div>
              <div className="text-slate-600">{q.facility_address || '—'}</div>
            </div>
            <div>
              <div className="mb-0.5 font-semibold text-slate-500">Owner / Agent</div>
              <div className="font-semibold">{customer?.name || '—'}</div>
              <div className="text-slate-600">{customer?.address || customer?.city || '—'}</div>
            </div>
          </div>

          <div className="mb-2 border-b border-slate-900 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            Section II. Duration & Schedule
          </div>
          <p className="mb-3 text-slate-700">
            The CONTRACTOR will maintain the pool between{' '}
            <strong>{fmtDate(q.season_start)}</strong> and <strong>{fmtDate(q.season_end)}</strong>.
          </p>

          <div className="mb-3 grid grid-cols-2 gap-3">
            {[
              ['Normal / Season', normal],
              ['School / Off Season', okul],
            ].map(([title, rows]) => (
              <div key={title}>
                <div className="mb-1 font-semibold text-slate-900">{title}</div>
                <table className="w-full border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-1 py-0.5 text-left font-semibold">Day</th>
                      <th className="px-1 py-0.5">Open</th>
                      <th className="px-1 py-0.5">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ label, r }) => (
                      <tr key={label} className="border-b border-slate-200 odd:bg-slate-50">
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

          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
            <span><strong>Lifeguards:</strong> {Number(q.lifeguard_count || 0)}</span>
            <span><strong>Hrs/guard:</strong> {Number(q.hours_per_week || 0)}</span>
            <span><strong>Total staff hrs/wk:</strong> {totalHours}</span>
          </div>

          <div className="mb-2 border-b border-slate-900 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            Section III. Additional Comments
          </div>
          <ul className="mb-4 list-none space-y-0.5">
            {(specialNotes.filter((n) => n.body?.trim()).length
              ? specialNotes.filter((n) => n.body?.trim())
              : [{ label: '—', body: 'None.' }]
            ).map((n, i) => (
              <li key={i}>
                <strong>{n.label ? `${n.label}. ` : ''}</strong>
                {n.body}
              </li>
            ))}
          </ul>

          <div className="mb-2 border-b border-slate-900 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            Section IV. Compensation Schedule
          </div>
          <div className="mb-2 flex flex-wrap justify-between gap-2">
            <div>
              <span className="text-slate-500">Total Contract Price: </span>
              <strong><Money n={totals.total} cur={q.currency} /></strong>
            </div>
            {Number(q.early_bird_discount) > 0 && (
              <div>
                <span className="text-slate-500">Early Bird: </span>
                <strong><Money n={contractAmount} cur={q.currency} /></strong>
              </div>
            )}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <div className="space-y-0.5">
              {left.map((inst, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>Due: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                  <span><Money n={inst.amount} cur={q.currency} /></span>
                </div>
              ))}
            </div>
            <div className="space-y-0.5">
              {right.map((inst, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>Due: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                  <span><Money n={inst.amount} cur={q.currency} /></span>
                </div>
              ))}
            </div>
            {installments.length === 0 && (
              <div className="col-span-2 italic text-slate-400">No payment schedule yet.</div>
            )}
          </div>

          <div className="mb-2 border-b border-slate-900 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            Section V. Acceptance
          </div>
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div>
              <div className="font-semibold">CONTRACTOR</div>
              <div className="mt-3 border-b border-slate-300 pb-1 text-slate-400">Signature</div>
            </div>
            <div>
              <div className="font-semibold">OWNER</div>
              <div className="mt-3 border-b border-slate-300 pb-1 text-slate-400">Signature</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-[9px] text-slate-400">
            <span>Owner’s Initial(s) ______</span>
            <Badge variant="outline" className="text-[9px]">Live Preview</Badge>
            <span>Page 2 of ·</span>
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
