import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Save, Loader2, Eye, X, Copy, Mail } from 'lucide-react';
import api from '@/api/client.js';
import { useDownload } from '@/hooks/useDownload.js';
import { Button } from '@/components/ui/button.jsx';
import WizardStepper from './WizardStepper.jsx';
import LivePaperPreview from './LivePaperPreview.jsx';
import SendEmailDialog from './SendEmailDialog.jsx';
import StepCustomer from './steps/StepCustomer.jsx';
import StepSchedule from './steps/StepSchedule.jsx';
import StepPersonnel from './steps/StepPersonnel.jsx';
import StepPayment from './steps/StepPayment.jsx';
import StepOutput from './steps/StepOutput.jsx';
import { VisibilityProvider } from './VisibilityContext.jsx';
import {
  buildDefaultSchedules,
  computeTotals,
  emptyItem,
  round2,
  weeksBetween,
} from './utils/quoteMath.js';
import { cloneStandardClauses } from './utils/defaultClauses.js';
import { computeBidSummary, buildMarchAugustInstallments } from './utils/bidPricing.js';

const STEPS = [
  { id: 'customer', label: 'Customer' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'personnel', label: 'Staffing' },
  { id: 'payment', label: 'Payment' },
  { id: 'output', label: 'PDF output' },
];

export default function ProposalWizard({ id, initialCustomerId }) {
  const nav = useNavigate();
  const editing = !!id;

  const [step, setStep] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // True only between picking a customer and its full record arriving, so the
  // facility fields are prefilled on a fresh choice and never on a reload.
  const [prefillFromCustomer, setPrefillFromCustomer] = useState(false);
  const [services, setServices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [quoteNo, setQuoteNo] = useState('');
  const [err, setErr] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pdfBlocks, setPdfBlocks] = useState([]);
  const [season, setSeason] = useState(null);
  const [companyHidden, setCompanyHidden] = useState([]);
  const [hiddenFields, setHiddenFields] = useState([]);
  const [duplicating, setDuplicating] = useState(false);
  const { busyKey, download } = useDownload();

  const [q, setQ] = useState({
    customer_id: initialCustomerId || '',
    contract_template_id: '',
    facility_name: '',
    facility_address: '',
    season_start: '',
    season_end: '',
    lifeguard_count: 0,
    hours_per_week: 0,
    county: '',
    peak_weeks: 0,
    discount_rate: 0,
    discount_amount: 0,
    early_bird_discount: 0,
    currency: 'USD',
    status: 'taslak',
    valid_until: '',
    school_closes: '',
    school_reopens: '',
    notes: '',
  });
  const [holidayPolicy, setHolidayPolicy] = useState({});
  const [items, setItems] = useState([emptyItem()]);
  const [installments, setInstallments] = useState([]);
  const [schedules, setSchedules] = useState(buildDefaultSchedules());
  const [specialNotes, setSpecialNotes] = useState(() => (id ? [] : cloneStandardClauses()));

  // The block registry and the company-wide default visibility. A new contract
  // starts from the company default; an existing one loads its own saved list.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/definitions/schema'), api.get('/definitions')])
      .then(([schema, defs]) => {
        if (cancelled) return;
        setPdfBlocks(schema.data.blocks || []);
        const companyDefault = defs.data.hidden || [];
        setCompanyHidden(companyDefault);
        if (!editing) setHiddenFields(companyDefault);
      })
      .catch(() => {
        // Definitions are optional chrome — a failure here must not block the
        // wizard, it just means no blocks can be toggled this session.
      });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  /**
   * The customer table is no longer part of this request.
   *
   * Opening the wizard used to fetch every customer, every service and every
   * contract template — including each template's full LONGTEXT body — before
   * the first field could be edited. The picker now searches server-side and
   * the templates arrive without their body text.
   */
  useEffect(() => {
    Promise.all([api.get('/services'), api.get('/templates')]).then(([s, t]) => {
      setServices(s.data);
      setTemplates(t.data);
      const def = t.data.find((x) => x.is_default);
      if (def && !editing) setQ((prev) => ({ ...prev, contract_template_id: def.id }));
    });
  }, [editing]);

  /**
   * Resolve the chosen customer to its full record — the picker's rows carry
   * only the columns its dropdown draws, and the summary card below it needs
   * address, email and tax details.
   */
  useEffect(() => {
    if (!q.customer_id) {
      setSelectedCustomer(null);
      return undefined;
    }
    if (selectedCustomer && String(selectedCustomer.id) === String(q.customer_id)) return undefined;

    let cancelled = false;
    api
      .get(`/customers/${q.customer_id}`)
      .then((r) => {
        if (cancelled) return;
        setSelectedCustomer(r.data);
        // Only when the user just picked this customer, so re-opening a saved
        // contract never overwrites a facility name that was cleared on purpose.
        if (prefillFromCustomer) {
          setPrefillFromCustomer(false);
          setQ((prev) => ({
            ...prev,
            facility_name: prev.facility_name || r.data.name || '',
            facility_address: prev.facility_address || r.data.address || '',
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedCustomer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [q.customer_id, selectedCustomer, prefillFromCustomer]);

  useEffect(() => {
    if (!editing) return;
    api.get(`/quotes/${id}`).then((r) => {
      const d = r.data;
      setQuoteNo(d.quote_no);
      setQ({
        customer_id: d.customer_id,
        contract_template_id: d.contract_template_id || '',
        facility_name: d.facility_name || '',
        facility_address: d.facility_address || '',
        season_start: d.season_start || '',
        season_end: d.season_end || '',
        lifeguard_count: d.lifeguard_count || 0,
        hours_per_week: d.hours_per_week || 0,
        county: d.county || '',
        peak_weeks: d.peak_weeks || 0,
        discount_rate: d.discount_rate || 0,
        discount_amount: d.discount_amount || 0,
        early_bird_discount: d.early_bird_discount || 0,
        currency: d.currency || 'USD',
        status: d.status,
        valid_until: d.valid_until || '',
        school_closes: d.school_closes || '',
        school_reopens: d.school_reopens || '',
        notes: d.notes || '',
      });
      setHolidayPolicy(d.holiday_policy && typeof d.holiday_policy === 'object' ? d.holiday_policy : {});
      setItems(d.items?.length ? d.items.map((it) => ({ ...it })) : [emptyItem()]);
      setInstallments(d.installments || []);
      setSchedules(d.schedules?.length ? d.schedules.map((s) => ({ ...s })) : buildDefaultSchedules());
      setSpecialNotes(d.special_notes?.length ? d.special_notes.map((n) => ({ ...n })) : []);
      setHiddenFields(Array.isArray(d.hidden_fields) ? d.hidden_fields : []);
    });
  }, [id, editing]);

  const totals = useMemo(
    () => computeTotals(items, q.discount_rate, q.discount_amount),
    [items, q.discount_rate, q.discount_amount]
  );
  const contractAmount = round2(totals.total - Number(q.early_bird_discount || 0));
  const installmentsSum = round2(installments.reduce((s, x) => s + Number(x.amount || 0), 0));
  const totalHours = Number(q.lifeguard_count || 0) * Number(q.hours_per_week || 0);
  const weeks = weeksBetween(q.season_start, q.season_end);
  const peakWeeks = Number(q.peak_weeks || weeks || 0);

  /** Picking from the dropdown: remember the id, then let the effect above fill in the rest. */
  function selectCustomer(row) {
    setPrefillFromCustomer(true);
    setSelectedCustomer(null);
    setQ((prev) => ({ ...prev, customer_id: row.id }));
  }
  /**
   * Season figures come from the server, not from arithmetic in the browser.
   * The invoice, the saved contract and the PDF all read the same
   * services/seasonCalendar.js, so a second implementation here would be a
   * standing invitation for the quoted hours and the printed hours to drift.
   */
  useEffect(() => {
    if (!q.season_start || !q.season_end) {
      setSeason(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .post('/season/preview', {
          season_start: q.season_start,
          season_end: q.season_end,
          schedules,
          lifeguard_count: q.lifeguard_count,
          school_closes: q.school_closes || null,
          school_reopens: q.school_reopens || null,
          holiday_policy: holidayPolicy,
        })
        .then((r) => {
          if (!cancelled) setSeason(r.data);
        })
        .catch(() => {
          if (!cancelled) setSeason(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    q.season_start,
    q.season_end,
    q.lifeguard_count,
    q.school_closes,
    q.school_reopens,
    schedules,
    holidayPolicy,
  ]);

  const bid = useMemo(
    () =>
      computeBidSummary({
        county: q.county,
        lifeguardCount: q.lifeguard_count,
        totalLifeguardHours: season?.staffHours || 0,
        weeklyStaffHours: season?.weeklyStaffHours || 0,
      }),
    [q.county, q.lifeguard_count, season]
  );

  // Spec: when contract total changes, keep March–August schedule in sync if it was empty or already 6 months
  useEffect(() => {
    if (!(contractAmount > 0)) return;
    const looksLikeMarchAug =
      installments.length === 0 ||
      (installments.length === 6 &&
        installments.every((r) => /March|April|May|June|July|August/i.test(r.label || '')));
    if (!looksLikeMarchAug) return;
    const y = q.season_start
      ? new Date(q.season_start).getFullYear()
      : new Date().getFullYear();
    const next = buildMarchAugustInstallments(contractAmount, y);
    const same =
      installments.length === 6 &&
      next.every((n, i) => Math.abs(Number(installments[i]?.amount || 0) - n.amount) < 0.02);
    if (!same) setInstallments(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-split when amount changes
  }, [contractAmount]);

  async function save() {
    setErr('');
    if (!q.customer_id) {
      setErr('Please select a customer.');
      setStep(0);
      return null;
    }
    setSaving(true);
    const payload = {
      ...q,
      customer_id: Number(q.customer_id) || q.customer_id,
      contract_template_id: q.contract_template_id || null,
      lifeguard_count: Number(q.lifeguard_count) || 0,
      hours_per_week: Number(q.hours_per_week) || 0,
      peak_weeks: Number(q.peak_weeks) || 0,
      county: q.county || null,
      season_start: q.season_start || null,
      season_end: q.season_end || null,
      valid_until: q.valid_until || null,
      items: items.filter((it) => it.description),
      installments,
      schedules,
      special_notes: specialNotes.filter((n) => (n.body || '').trim()),
      hidden_fields: hiddenFields,
      school_closes: q.school_closes || null,
      school_reopens: q.school_reopens || null,
      holiday_policy: holidayPolicy,
    };
    try {
      let res;
      if (editing || savedId) {
        const target = id || savedId;
        res = await api.put(`/quotes/${target}`, payload);
      } else {
        res = await api.post('/quotes', payload);
      }
      setSavedId(res.data.id);
      setQuoteNo(res.data.quote_no);
      if (!editing && !id) nav(`/quotes/${res.data.id}`, { replace: true });
      return res.data;
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.message ||
        'Failed to save.';
      setErr(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(kind) {
    let sid = savedId || id;
    let no = quoteNo;
    if (!sid) {
      const created = await save();
      sid = created?.id;
      // Read the number off the response: setQuoteNo() above has not re-rendered
      // yet, so the `quoteNo` captured by this closure is still empty and the
      // file would download as "proposal.pdf".
      no = created?.quote_no || no;
    }
    if (!sid) return;
    const name = `${no || 'proposal'}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
    await download(`${kind}-${sid}`, `/quotes/${sid}/${kind}`, name);
  }

  return (
    <VisibilityProvider hidden={hiddenFields} setHidden={setHiddenFields} blocks={pdfBlocks}>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/quotes"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to proposals
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {editing || savedId ? `Proposal ${quoteNo || ''}` : 'New contract proposal'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step-by-step wizard · live PDF preview
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="gap-2 xl:hidden"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          {(savedId || id) && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={duplicating}
              onClick={async () => {
                setDuplicating(true);
                setErr('');
                try {
                  const { data } = await api.post(`/quotes/${savedId || id}/duplicate`);
                  nav(`/quotes/${data.id}`);
                } catch (e) {
                  setErr(e.response?.data?.error || e.message || 'Could not duplicate this contract.');
                } finally {
                  setDuplicating(false);
                }
              }}
            >
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Duplicate
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            type="button"
            variant="accent"
            className="gap-2"
            onClick={async () => {
              let sid = savedId || id;
              if (!sid) {
                const created = await save();
                sid = created?.id;
              }
              if (sid) setEmailOpen(true);
            }}
          >
            <Mail className="h-4 w-4" />
            Email customer
          </Button>
        </div>
      </div>

      <WizardStepper steps={STEPS} current={step} onChange={setStep} />

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Split screen */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <StepCustomer
                  q={q}
                  setQ={setQ}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={selectCustomer}
                  season={season}
                />
              )}
              {step === 1 && (
                <StepSchedule schedules={schedules} setSchedules={setSchedules} />
              )}
              {step === 2 && (
                <StepPersonnel
                  q={q}
                  setQ={setQ}
                  items={items}
                  setItems={setItems}
                  services={services}
                  totals={totals}
                  contractAmount={contractAmount}
                  totalHours={totalHours}
                  weeks={weeks}
                  bid={bid}
                  season={season}
                  holidayPolicy={holidayPolicy}
                  setHolidayPolicy={setHolidayPolicy}
                />
              )}
              {step === 4 && <StepOutput companyDefault={companyHidden} />}
              {step === 3 && (
                <StepPayment
                  q={q}
                  setQ={setQ}
                  installments={installments}
                  setInstallments={setInstallments}
                  specialNotes={specialNotes}
                  setSpecialNotes={setSpecialNotes}
                  contractAmount={contractAmount}
                  installmentsSum={installmentsSum}
                  templates={templates}
                  err={err}
                  setErr={setErr}
                  setItems={setItems}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="accent"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="accent" onClick={() => save()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & Finish
              </Button>
            )}
          </div>
        </div>

        {/* Live preview — sticky on desktop */}
        <div className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
          <LivePaperPreview
            q={q}
            season={season}
            quoteNo={quoteNo}
            customer={selectedCustomer}
            schedules={schedules}
            specialNotes={specialNotes}
            installments={installments}
            items={items}
            totals={totals}
            contractAmount={contractAmount}
            canExport={!!(savedId || id)}
            busyKind={busyKey ? busyKey.split('-')[0] : null}
            onPdf={() => exportFile('pdf')}
            onExcel={() => exportFile('excel')}
          />
        </div>
      </div>

      {/* Mobile / tablet full-screen preview sheet */}
      <SendEmailDialog
        quoteId={savedId || id}
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        onSent={(data) => {
          if (data?.status) setQ((prev) => ({ ...prev, status: data.status }));
        }}
      />

      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background xl:hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <div className="text-sm font-semibold">Contract preview</div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(false)} className="gap-1.5">
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 pb-24">
            <LivePaperPreview
              q={q}
              season={season}
              quoteNo={quoteNo}
              customer={selectedCustomer}
              schedules={schedules}
              specialNotes={specialNotes}
              installments={installments}
              items={items}
              totals={totals}
              contractAmount={contractAmount}
              canExport={!!(savedId || id)}
              busyKind={busyKey ? busyKey.split('-')[0] : null}
              onPdf={() => exportFile('pdf')}
              onExcel={() => exportFile('excel')}
            />
          </div>
        </div>
      )}
    </div>
    </VisibilityProvider>
  );
}
