import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, RotateCcw, Save } from 'lucide-react';
import api from '@/api/client.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Definitions — the company-wide control panel for everything the contract PDF
 * prints. The list of hideable blocks comes from the backend so the two can
 * never drift; nothing here is duplicated in the frontend.
 */

const LABEL_FIELDS = [
  ['contractPrefix', 'Contract number prefix text', 'Contract :'],
  ['titleLine1', 'Cover title — line 1'],
  ['titleLine2', 'Cover title — line 2'],
  ['specTitle', 'Specification page title'],
  ['ownerColumn', 'Signature column — owner'],
  ['contractorColumn', 'Signature column — contractor'],
  ['ownerParty', 'Owner party word', 'OWNER'],
  ['initials', 'Initials line'],
  ['facilityHeading', 'Property table — facility column'],
  ['ownerHeading', 'Property table — owner column'],
  ['normalSeason', 'Schedule — normal season heading'],
  ['schoolSeason', 'Schedule — school season heading'],
  ['schoolSeasonNote', 'Schedule — school season note'],
  ['servicesIncluded', 'Services table heading'],
  ['signatureNote', 'Electronic signature note'],
];

const SECTION_FIELDS = [
  ['property', 'Section — property information'],
  ['duration', 'Section — duration, schedule and personnel'],
  ['comments', 'Section — additional comments'],
  ['compensation', 'Section — compensation schedule'],
  ['acceptance', 'Section — acceptance of proposal'],
];

const THEME_FIELDS = [
  ['primary', 'Headings & rules'],
  ['numeral', 'Section numerals'],
  ['ink', 'Body text'],
  ['muted', 'Secondary text'],
  ['rule', 'Hairlines'],
];

export default function Definitions() {
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [schema, setSchema] = useState(null);
  const [d, setD] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    Promise.all([api.get('/definitions/schema'), api.get('/definitions')])
      .then(([s, v]) => {
        setSchema(s.data);
        setD(v.data);
      })
      .catch(() => setMsg('Could not load definitions.'));
  }, []);

  const groups = useMemo(() => {
    if (!schema) return [];
    const map = new Map();
    for (const b of schema.blocks) {
      if (!map.has(b.group)) map.set(b.group, []);
      map.get(b.group).push(b);
    }
    return [...map.entries()];
  }, [schema]);

  if (!d || !schema) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const set = (path, value) =>
    setD((prev) => {
      const [group, key] = path.split('.');
      return { ...prev, [group]: { ...prev[group], [key]: value } };
    });

  const hiddenSet = new Set(d.hidden || []);
  const toggleHidden = (key) =>
    setD((prev) => {
      const next = new Set(prev.hidden || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, hidden: [...next] };
    });

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const { data } = await api.put('/definitions', d);
      setD(data.definitions);
      setWarnings(data.errors || []);
      setMsg('Saved');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm('Reset every definition back to the factory defaults?')) return;
    const { data } = await api.post('/definitions/reset');
    setD(data.definitions);
    setWarnings([]);
    setMsg('Reset to defaults');
    setTimeout(() => setMsg(''), 2500);
  }

  const text = (group, key) => ({
    value: d[group]?.[key] ?? '',
    disabled: readOnly,
    onChange: (e) => set(`${group}.${key}`, e.target.value),
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Definitions"
        subtitle="Company-wide defaults for the contract PDF — layout, wording, colours and which blocks print"
      >
        {!readOnly && (
          <>
            <Button type="button" variant="outline" className="gap-2" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="accent" className="gap-2" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </>
        )}
        {msg && <Badge variant="kabul">{msg}</Badge>}
      </PageHeader>

      {readOnly && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Only administrators can change definitions. You are viewing the current values.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">Some values were corrected to stay printable:</div>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="visibility">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="visibility">PDF blocks</TabsTrigger>
          <TabsTrigger value="layout">Layout &amp; colours</TabsTrigger>
          <TabsTrigger value="wording">Wording</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="numbering">Numbering</TabsTrigger>
        </TabsList>

        {/* ---------------- Default visibility ---------------- */}
        <TabsContent value="visibility">
          <Card>
            <CardHeader>
              <CardTitle>Blocks printed by default</CardTitle>
              <CardDescription>
                This is the starting point for <strong>new</strong> contracts only. Each contract keeps its own
                copy from the moment it is created, so changing something here never alters paperwork you have
                already sent out — use the eye buttons inside a contract for that.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {groups.map(([group, blocks]) => (
                <div key={group}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {blocks.map((b) => {
                      const off = hiddenSet.has(b.key);
                      return (
                        <button
                          key={b.key}
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleHidden(b.key)}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
                            off
                              ? 'border-border bg-muted/40 text-muted-foreground'
                              : 'border-accent/30 bg-accent/5 text-foreground'
                          )}
                        >
                          {off ? (
                            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{b.label}</span>
                            {b.hint && <span className="block text-xs text-muted-foreground">{b.hint}</span>}
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide">
                              {off ? 'Hidden' : 'Printed'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Layout & colours ---------------- */}
        <TabsContent value="layout">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Page</CardTitle>
                <CardDescription>Paper size, margins and text scale.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Paper size</Label>
                  <select
                    disabled={readOnly}
                    className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                    value={d.page.size}
                    onChange={(e) => set('page.size', e.target.value)}
                  >
                    <option value="LETTER">Letter (US)</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Density</Label>
                  <select
                    disabled={readOnly}
                    className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                    value={d.page.density}
                    onChange={(e) => set('page.density', e.target.value)}
                  >
                    <option value="compact">Compact — sections 1–5 on one page</option>
                    <option value="comfortable">Comfortable — more air, may add a page</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Side margin (pt)</Label>
                  <Input
                    type="number"
                    min={18}
                    max={90}
                    disabled={readOnly}
                    value={d.page.margin}
                    onChange={(e) => set('page.margin', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Text scale ({Number(d.page.fontScale).toFixed(2)}×)</Label>
                  <input
                    type="range"
                    min={0.85}
                    max={1.25}
                    step={0.05}
                    disabled={readOnly}
                    value={d.page.fontScale}
                    onChange={(e) => set('page.fontScale', Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colours</CardTitle>
                <CardDescription>Applied to every page of the PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {THEME_FIELDS.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      disabled={readOnly}
                      value={d.theme[key]}
                      onChange={(e) => set(`theme.${key}`, e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card"
                    />
                    <div className="min-w-0 flex-1">
                      <Label>{label}</Label>
                      <Input className="mt-1 font-mono text-xs" {...text('theme', key)} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Wording ---------------- */}
        <TabsContent value="wording">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Section titles</CardTitle>
                <CardDescription>Numbers are assigned automatically — hide a section and the rest renumber.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SECTION_FIELDS.map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input {...text('sectionTitles', key)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fixed text</CardTitle>
                <CardDescription>Every literal string the PDF prints outside the contract data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {LABEL_FIELDS.map(([key, label, placeholder]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input placeholder={placeholder} {...text('labels', key)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Parties ---------------- */}
        <TabsContent value="parties">
          <Card>
            <CardHeader>
              <CardTitle>Contractor naming</CardTitle>
              <CardDescription>
                Print the company name where the paperwork would otherwise say “the CONTRACTOR”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={!!d.contractor.replaceWord}
                  onChange={(e) => set('contractor.replaceWord', e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium">Use the company name instead of “CONTRACTOR”</span>
                  <span className="block text-xs text-muted-foreground">
                    “The CONTRACTOR will maintain…” becomes “FOUR SEASONS POOL MANAGEMENT will maintain…”
                  </span>
                </span>
              </label>

              <div className="space-y-1.5">
                <Label>Where to apply it</Label>
                <select
                  disabled={readOnly || !d.contractor.replaceWord}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft disabled:opacity-60"
                  value={d.contractor.scope}
                  onChange={(e) => set('contractor.scope', e.target.value)}
                >
                  <option value="all">Whole contract — specification page and terms</option>
                  <option value="spec">Specification page only — leave the legal terms wording alone</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  “Contractor” is a defined legal term in the terms and conditions. Replacing it everywhere reads
                  fine but makes the clauses longer; choose “specification page only” to keep the legal text as
                  your lawyer wrote it.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Name to print</Label>
                <Input placeholder="Leave blank to use the company name from Settings" {...text('contractor', 'label')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Numbering ---------------- */}
        <TabsContent value="numbering">
          <Card>
            <CardHeader>
              <CardTitle>Contract numbering</CardTitle>
              <CardDescription>
                The prefix lives in Settings. Format: <strong>PREFIX-YEAR-SEQUENCE</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sequence digits</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  disabled={readOnly}
                  value={d.numbering.padding}
                  onChange={(e) => set('numbering.padding', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  3 digits → FSPM-{new Date().getFullYear()}-001
                </p>
              </div>
              <label className="flex items-start gap-3 self-start rounded-xl border border-border p-3">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={!!d.numbering.yearlyReset}
                  onChange={(e) => set('numbering.yearlyReset', e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium">Restart the sequence every year</span>
                  <span className="block text-xs text-muted-foreground">
                    Off: one continuous sequence with no year segment.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
