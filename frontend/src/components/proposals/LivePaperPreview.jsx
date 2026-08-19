import { FileDown, Loader2, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { fmtMoney, fmtDate } from '@/api/utils.js';
import { DAYS, formatTime12 } from './utils/quoteMath.js';
import { fillTemplate } from './utils/template.js';
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
  earlyBirdPrice,
  onPdf,
  onExcel,
  canExport,
  /**
   * Company-wide contract wording, straight from the API.
   *
   * This preview used to carry its own hard-coded titles and sentences, which is
   * why it never quite matched the PDF — two copies of the same contract text,
   * drifting independently. Now both read the same definitions, so editing a
   * heading on the Definitions page changes the preview and the PDF together.
   */
  definitions = null,
  /** The uploaded contractor signature as a data URI, or null. */
  signatureImage = null,
  /** ISO date the contract was created; today for one that has not been saved. */
  createdAt = null,
  /** 'pdf' | 'excel' | null — which export is currently building, if any. */
  busyKind = null,
}) {
  const { isHidden, hidden } = useVisibility();
  const show = (k) => !isHidden(k);

  // Falls back to empty objects so a slow /definitions response renders a blank
  // heading for a moment rather than throwing away the whole preview.
  const L = definitions?.labels || {};
  const S = definitions?.sectionTitles || {};
  const SENT = definitions?.sentences || {};
  const contractorWord = definitions?.contractor?.replaceWord
    ? (definitions.contractor.label || '').trim().toUpperCase() || 'the CONTRACTOR'
    : 'the CONTRACTOR';
  const ownerWord = L.ownerParty || 'OWNER';
  const signatoryName = (definitions?.contractor?.signatory || '').trim() || contractorWord;
  const showSignature = show('spec.contractorSignature') && !!signatureImage;

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

  const seasonTables = [[L.normalSeason, normal]];
  if (show('spec.scheduleSchool')) seasonTables.push([L.schoolSeason, okul]);

  /**
   * Built as a list so the numbering matches the PDF: hidden sections are
   * dropped and the remaining ones renumber, rather than leaving a gap.
   */
  // Facility and Owner / Agent name the same party on most properties, so each
  // column can be hidden on its own; the survivor then spans the full width.
  const propertyCols = [
    show('spec.propertyFacility') && {
      key: 'facility',
      heading: L.facilityHeading,
      name: q.facility_name,
      detail: q.facility_address,
    },
    show('spec.propertyOwner') && {
      key: 'owner',
      heading: L.ownerHeading,
      name: customer?.name,
      detail: customer?.address || customer?.city,
    },
  ].filter(Boolean);

  const sections = [];
  if (show('spec.property') && propertyCols.length) {
    sections.push({
      title: S.property,
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
      title: S.duration,
      node: (
        <>
          <p className="mb-3 text-slate-700">
            {fillTemplate(SENT.duration, {
              contractor: contractorWord,
              owner: ownerWord,
              start: fmtDate(q.season_start),
              end: fmtDate(q.season_end),
              seasonSummary: season?.valid
                ? ` — ${season.weeksLabel}, ${season.openDays} operating days.`
                : '.',
            })}
          </p>

          {show('spec.schedule') && (
            <div className={`mb-3 grid gap-3 ${seasonTables.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {seasonTables.map(([title, rows]) => (
                <div key={title}>
                  <div className="mb-1 font-semibold text-slate-900">{title}</div>
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="border-b border-[#0d47a1] text-[#0d47a1]">
                        <th className="px-1 py-0.5 text-left font-semibold">{L.scheduleDay}</th>
                        <th className="px-1 py-0.5">{L.scheduleOpen}</th>
                        <th className="px-1 py-0.5">{L.scheduleClose}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, r }) => (
                        <tr key={label} className="border-b border-slate-200">
                          <td className="px-1 py-0.5">{label}</td>
                          <td className="px-1 py-0.5 text-center">
                            {r?.is_closed ? L.scheduleClosed : formatTime12(r?.open_time)}
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            {r?.is_closed ? L.scheduleClosed : formatTime12(r?.close_time)}
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
              {show('spec.staffLifeguards') && (
                <span>
                  <strong>{L.staffLifeguards}:</strong> {Number(q.lifeguard_count || 0)} Lifeguard(s)
                </span>
              )}
              {show('spec.staffOperatingDays') && (
                <span>
                  <strong>{L.staffOperatingDays}:</strong>{' '}
                  {season ? `${season.openDays} of ${season.days} days` : '—'}
                </span>
              )}
              {show('spec.staffDailyHours') && (
                <span>
                  <strong>{L.staffDailyHours}:</strong>{' '}
                  {season ? `${season.avgDailyHoursPerGuard} Hrs/day` : '—'}
                </span>
              )}
              {show('spec.staffWeeklyHours') && (
                <span>
                  <strong>{L.staffWeeklyHours}:</strong> {season ? `${season.weeklyStaffHours} Hrs/week` : '—'}
                </span>
              )}
              {show('spec.staffSeasonHours') && (
                <span>
                  <strong>{L.staffSeasonHours}:</strong> {season ? `${season.staffHours} Hrs/season` : '—'}
                </span>
              )}
            </div>
          )}
        </>
      ),
    });
  }

  if (show('spec.comments')) {
    const visibleNotes = specialNotes.filter((n) => n.body?.trim());
    sections.push({
      title: S.comments,
      node: (
        <ul className="mb-4 list-none space-y-0.5">
          {(visibleNotes.length ? visibleNotes : [{ label: '', body: L.noComments }]).map((n, i) => (
            <li key={i} className={n.is_bold ? 'font-semibold' : undefined}>
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
      title: S.compensation,
      node: (
        <>
          {show('spec.compensationIntro') && (
            <p className="mb-2 text-slate-600">
              {fillTemplate(SENT.compensation, { owner: ownerWord, contractor: contractorWord })}
            </p>
          )}

          {show('spec.items') && lineItems.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">{L.servicesIncluded}</div>
              <table className="mb-2 w-full border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-[#0d47a1] text-[#0d47a1]">
                    <th className="px-1 py-0.5 text-left">{L.itemsDescription}</th>
                    <th className="px-1 py-0.5 text-right">{L.itemsQty}</th>
                    <th className="px-1 py-0.5 text-right">{L.itemsAmount}</th>
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
                <span className="text-slate-500">{L.totalPrice}: </span>
                <strong>
                  <Money n={totals.total} cur={q.currency} />
                </strong>
              </div>
              {Number(q.early_bird_discount) > 0 && show('spec.earlyBird') && (
                <div>
                  <span className="text-slate-500">{L.earlyBirdPrice}: </span>
                  <strong>
                    <Money n={earlyBirdPrice} cur={q.currency} />
                  </strong>
                </div>
              )}
            </div>
          )}

          {Number(q.early_bird_discount) > 0 && show('spec.earlyBird') && show('spec.earlyBirdNote') && (
            <p className="mb-2 text-[9px] italic text-slate-500">
              {fillTemplate(SENT.earlyBirdNote, {
                contractor: contractorWord,
                owner: ownerWord,
                deadline: q.valid_until ? fmtDate(q.valid_until) : 'the stated deadline',
              })}
            </p>
          )}

          {show('spec.installments') && (
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <div className="space-y-0.5">
                {left.map((inst, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{L.dueLabel}: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                    <span>
                      <Money n={inst.amount} cur={q.currency} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5">
                {right.map((inst, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{L.dueLabel}: {inst.due_date ? fmtDate(inst.due_date) : inst.label}</span>
                    <span>
                      <Money n={inst.amount} cur={q.currency} />
                    </span>
                  </div>
                ))}
              </div>
              {installments.length === 0 && (
                <div className="col-span-2 italic text-slate-400">{L.noInstallments}</div>
              )}
            </div>
          )}
        </>
      ),
    });
  }

  if (show('spec.acceptance')) {
    sections.push({
      title: S.acceptance,
      node: (
        <div className="grid grid-cols-2 gap-6 pt-2">
          {/* Signature last in both columns, and the same height reserved on
              each, exactly as the PDF lays it out. */}
          <div>
            <div className="font-semibold">{L.ownerColumn}</div>
            {/* No title line for the owner — just the space it occupied, so
                every rule below stays level with the contractor's. */}
            <div className="mt-0.5 text-[8px]">&nbsp;</div>
            <div className="mt-3 h-4" />
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Company</div>
            <div className="mt-3 h-4" />
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Date</div>
            <div className="mt-3 h-11" />
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Signature</div>
          </div>
          <div>
            <div className="font-semibold">{L.contractorColumn}</div>
            <div className="mt-3 border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">
              {L.signatoryPrefix} {String(signatoryName).toUpperCase()}
            </div>
            <div className="mt-3 flex h-4 items-end text-[9px] text-slate-700">
              {L.contractorTitle}
            </div>
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Title</div>
            <div className="mt-3 flex h-4 items-end text-[9px] text-slate-700">
              {fmtDate(createdAt || new Date().toISOString())}
            </div>
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Date</div>
            {/* -mb-3 drops the ink onto the rule the way the PDF does. */}
            <div className="mt-3 flex h-11 items-end overflow-visible">
              {showSignature && (
                <img
                  src={signatureImage}
                  alt="Contractor signature"
                  className="-mb-3 max-h-11 max-w-full object-contain object-left"
                />
              )}
            </div>
            <div className="border-b border-slate-400" />
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-slate-400">Signature</div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!canExport || !!busyKind}
            onClick={onExcel}
          >
            {busyKind === 'excel' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sheet className="h-3.5 w-3.5" />
            )}
            Excel
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="gap-1.5"
            disabled={!canExport || !!busyKind}
            onClick={onPdf}
          >
            {busyKind === 'pdf' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {busyKind === 'pdf' ? 'Building PDF…' : 'Review PDF'}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto rounded-2xl bg-gradient-to-b from-slate-200/80 to-slate-300/50 p-3 sm:p-6">
        <div className="mx-auto min-h-[560px] max-w-[520px] origin-top rounded-[2px] bg-white px-4 py-6 text-[10.5px] leading-relaxed text-slate-800 shadow-paper ring-1 ring-black/5 transition-transform duration-300 sm:min-h-[720px] sm:px-7 sm:py-8">
          {show('spec.header') && (
            <div className="mb-5 text-center">
              {show('cover.logo') && (
                // Served from the backend rather than bundled, so the preview and
                // the PDF can only ever show the same artwork.
                <img
                  src="/api/assets/logo.png"
                  alt=""
                  className="mx-auto mb-2 h-auto w-[140px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
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
            <span>{show('footer.initials') ? `${L.initials} ______` : ''}</span>
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
