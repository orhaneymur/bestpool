import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Save, Loader2, Eye, X } from 'lucide-react';
import api, { downloadFile } from '@/api/client.js';
import { Button } from '@/components/ui/button.jsx';
import WizardStepper from './WizardStepper.jsx';
import LivePaperPreview from './LivePaperPreview.jsx';
import StepCustomer from './steps/StepCustomer.jsx';
import StepSchedule from './steps/StepSchedule.jsx';
import StepPersonnel from './steps/StepPersonnel.jsx';
import StepPayment from './steps/StepPayment.jsx';
import {
  buildDefaultSchedules,
  computeTotals,
  emptyItem,
  round2,
  weeksBetween,
} from './utils/quoteMath.js';

const STEPS = [
  { id: 'customer', label: 'Customer' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'personnel', label: 'Staffing' },
  { id: 'payment', label: 'Payment' },
];

export default function ProposalWizard({ id, initialCustomerId }) {
  const nav = useNavigate();
  const editing = !!id;

  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [quoteNo, setQuoteNo] = useState('');
  const [err, setErr] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const [q, setQ] = useState({
    customer_id: initialCustomerId || '',
    contract_template_id: '',
    facility_name: '',
    facility_address: '',
    season_start: '',
    season_end: '',
    lifeguard_count: 0,
    hours_per_week: 0,
    discount_rate: 0,
    discount_amount: 0,
    early_bird_discount: 0,
    currency: 'USD',
    status: 'taslak',
    valid_until: '',
    notes: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [installments, setInstallments] = useState([]);
  const [schedules, setSchedules] = useState(buildDefaultSchedules());
  const [specialNotes, setSpecialNotes] = useState([]);

  useEffect(() => {
    Promise.all([api.get('/customers'), api.get('/services'), api.get('/templates')]).then(
      ([c, s, t]) => {
        setCustomers(c.data);
        setServices(s.data);
        setTemplates(t.data);
        const def = t.data.find((x) => x.is_default);
        if (def && !editing) setQ((prev) => ({ ...prev, contract_template_id: def.id }));
      }
    );
  }, [editing]);

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
        discount_rate: d.discount_rate || 0,
        discount_amount: d.discount_amount || 0,
        early_bird_discount: d.early_bird_discount || 0,
        currency: d.currency || 'USD',
        status: d.status,
        valid_until: d.valid_until || '',
        notes: d.notes || '',
      });
      setItems(d.items?.length ? d.items.map((it) => ({ ...it })) : [emptyItem()]);
      setInstallments(d.installments || []);
      setSchedules(d.schedules?.length ? d.schedules.map((s) => ({ ...s })) : buildDefaultSchedules());
      setSpecialNotes(d.special_notes?.length ? d.special_notes.map((n) => ({ ...n })) : []);
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
  const selectedCustomer = customers.find((c) => String(c.id) === String(q.customer_id));

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
      items: items.filter((it) => it.description),
      installments,
      schedules,
      special_notes: specialNotes.filter((n) => (n.body || '').trim()),
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
      setErr(e.response?.data?.error || 'Failed to save.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(kind) {
    let sid = savedId || id;
    if (!sid) {
      const created = await save();
      sid = created?.id;
    }
    if (!sid) return;
    const name = `${quoteNo || 'proposal'}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
    await downloadFile(`/quotes/${sid}/${kind}`, name);
  }

  return (
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
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
          <Button type="button" variant="outline" onClick={() => save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
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
                  customers={customers}
                  selectedCustomer={selectedCustomer}
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
                />
              )}
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
            quoteNo={quoteNo}
            customer={selectedCustomer}
            schedules={schedules}
            specialNotes={specialNotes}
            installments={installments}
            totals={totals}
            contractAmount={contractAmount}
            canExport={!!(savedId || id)}
            onPdf={() => exportFile('pdf')}
            onExcel={() => exportFile('excel')}
          />
        </div>
      </div>

      {/* Mobile / tablet full-screen preview sheet */}
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
              quoteNo={quoteNo}
              customer={selectedCustomer}
              schedules={schedules}
              specialNotes={specialNotes}
              installments={installments}
              totals={totals}
              contractAmount={contractAmount}
              canExport={!!(savedId || id)}
              onPdf={() => exportFile('pdf')}
              onExcel={() => exportFile('excel')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
