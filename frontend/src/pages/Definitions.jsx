import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Eye, EyeOff, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
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
 * prints.
 *
 * Both the hideable blocks and every editable word arrive from
 * GET /api/definitions/schema, described and grouped by the backend. This screen
 * used to keep its own list of which key belonged under which heading, which
 * meant a word added to the contract stayed invisible here until somebody
 * remembered to update React too — and a few never were. There is one list now,
 * and it lives with the definitions themselves.
 */
const THEME_FIELDS = [
  ['primary', 'Headings & rules'],
  ['numeral', 'Section numerals'],
  ['ink', 'Body text'],
  ['muted', 'Secondary text'],
  ['rule', 'Hairlines'],
];

/**
 * One editable line of the contract.
 *
 * Everything about it — where it belongs, what to call it, whether it needs a
 * box or a single line — is described by the backend, so a word added to the
 * definitions turns up here on its own. The Reset link puts the shipped wording
 * back in that one field without touching anything else on the page.
 */
function WordingField({ field, value, fallback, readOnly, onChange }) {
  const id = `def-${field.group}-${field.key}`;
  const multiline = field.kind === 'multiline';
  const changed = String(value ?? '') !== String(fallback ?? '');

  return (
    <div className={cn('space-y-1.5', multiline && 'sm:col-span-2')}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{field.label}</Label>
        {!readOnly && changed && (
          <button
            type="button"
            onClick={() => onChange(fallback)}
            title="Put the shipped wording back in this field"
            className="shrink-0 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-60"
        />
      ) : (
        <Input id={id} value={value ?? ''} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      {field.placeholders?.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Filled in from the contract: {field.placeholders.map((p) => `{${p}}`).join(', ')}
        </p>
      )}
    </div>
  );
}

export default function Definitions() {
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [schema, setSchema] = useState(null);
  const [d, setD] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [warnings, setWarnings] = useState([]);
  // The Wording tab holds a few dozen fields; typing a phrase narrows it to the
  // ones worth reading rather than making anyone scroll for a word they can see
  // on the contract in front of them.
  const [wordSearch, setWordSearch] = useState('');

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

  /**
   * The wording, section by section, exactly as the backend describes it.
   *
   * A search matches the field's own name, its hint and the text currently
   * saved in it, so looking up a phrase printed on the contract finds the box
   * that holds it. Sections with nothing left in them drop out.
   */
  const wordSections = useMemo(() => {
    const all = schema?.sections || [];
    const needle = wordSearch.trim().toLowerCase();
    if (!needle) return all;
    return all
      .map((section) => ({
        ...section,
        fields: section.fields.filter((f) =>
          [f.label, f.hint, f.key, d?.[f.group]?.[f.key]]
            .filter(Boolean)
            .some((hay) => String(hay).toLowerCase().includes(needle))
        ),
      }))
      .filter((section) => section.fields.length);
  }, [schema, d, wordSearch]);

  const totalFieldCount = useMemo(
    () => (schema?.sections || []).reduce((n, section) => n + section.fields.length, 0),
    [schema]
  );
  const matchCount = wordSections.reduce((n, section) => n + section.fields.length, 0);

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

  const clauses = Array.isArray(d.defaultClauses) ? d.defaultClauses : [];
  const setClauses = (next) => setD((prev) => ({ ...prev, defaultClauses: next }));
  const updateClause = (i, patch) =>
    setClauses(clauses.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeClause = (i) => setClauses(clauses.filter((_, idx) => idx !== i));
  const moveClause = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= clauses.length) return;
    const next = [...clauses];
    [next[i], next[j]] = [next[j], next[i]];
    setClauses(next);
  };
  const addClause = () =>
    setClauses([...clauses, { label: String.fromCharCode(65 + clauses.length), body: '', bold: false }]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Definitions"
        subtitle="Everything the contract PDF says and how it looks — wording, standard clauses, which blocks print, layout and numbering"
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

      {/* Wording first: it is the tab with something to change on it most days. */}
      <Tabs defaultValue="wording">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="wording">Wording</TabsTrigger>
          <TabsTrigger value="clauses">Standard clauses</TabsTrigger>
          <TabsTrigger value="visibility">PDF blocks</TabsTrigger>
          <TabsTrigger value="layout">Layout &amp; colours</TabsTrigger>
          <TabsTrigger value="parties">Parties &amp; signing</TabsTrigger>
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
                <CardTitle>Branding</CardTitle>
                <CardDescription>
                  The cover logo and the watermark printed behind every page. Switch either off entirely on the
                  <strong> PDF blocks</strong> tab.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Cover logo width (pt)</Label>
                  <Input
                    type="number"
                    min={40}
                    max={420}
                    disabled={readOnly}
                    value={d.branding.logoWidth}
                    onChange={(e) => set('branding.logoWidth', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Watermark width (pt)</Label>
                  <Input
                    type="number"
                    min={80}
                    max={600}
                    disabled={readOnly}
                    value={d.branding.backgroundWidth}
                    onChange={(e) => set('branding.backgroundWidth', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Signature box width (pt)</Label>
                  <Input
                    type="number"
                    disabled={readOnly}
                    value={d.branding.signatureWidth}
                    onChange={(e) => set('branding.signatureWidth', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Signature box height (pt)</Label>
                  <Input
                    type="number"
                    disabled={readOnly}
                    value={d.branding.signatureHeight}
                    onChange={(e) => set('branding.signatureHeight', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Watermark strength ({Math.round(Number(d.branding.backgroundOpacity) * 100)}%)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={0.18}
                    step={0.01}
                    disabled={readOnly}
                    value={d.branding.backgroundOpacity}
                    onChange={(e) => set('branding.backgroundOpacity', Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <p className="text-xs text-muted-foreground">
                    Capped at 18%. Above that the artwork starts competing with the contract text, and a contract
                    that is hard to read is not a style choice. 0% turns it off.
                  </p>
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
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract wording</CardTitle>
                <CardDescription>
                  Every word the contract prints, in the order it prints them. Section numbers are assigned
                  automatically — hide a section on the <strong>PDF blocks</strong> tab and the rest renumber,
                  sentences included. Changes apply to the PDF as soon as they are saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  value={wordSearch}
                  onChange={(e) => setWordSearch(e.target.value)}
                  placeholder="Find a word or phrase — search the labels and the text itself"
                  className="h-11"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {wordSearch.trim()
                      ? `${matchCount} of ${totalFieldCount} fields match`
                      : `${totalFieldCount} editable fields`}
                  </span>
                  {!wordSearch.trim() &&
                    wordSections.map((section) => (
                      <a
                        key={section.id}
                        href={`#definitions-${section.id}`}
                        className="underline-offset-2 hover:text-accent hover:underline"
                      >
                        {section.title}
                      </a>
                    ))}
                </div>
              </CardContent>
            </Card>

            {wordSections.map((section) => (
              <Card key={section.id} id={`definitions-${section.id}`} className="scroll-mt-4">
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  {section.description && <CardDescription>{section.description}</CardDescription>}
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <WordingField
                      key={`${f.group}.${f.key}`}
                      field={f}
                      value={d[f.group]?.[f.key] ?? ''}
                      fallback={schema.defaults?.[f.group]?.[f.key] ?? ''}
                      readOnly={readOnly}
                      onChange={(v) => set(`${f.group}.${f.key}`, v)}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}

            {wordSections.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nothing matches “{wordSearch.trim()}”.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ---------------- Standard clauses ---------------- */}
        <TabsContent value="clauses">
          <Card>
            <CardHeader>
              <CardTitle>Default Additional Comments</CardTitle>
              <CardDescription>
                What a <strong>new</strong> contract starts with. A contract copies these once, when it is
                created, and owns its copy from then on — editing this list never changes paperwork that
                has already gone out, and the wizard can reload it at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {clauses.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    aria-label="Clause label"
                    className="w-16 shrink-0 text-center"
                    value={c.label ?? ''}
                    disabled={readOnly}
                    onChange={(e) => updateClause(i, { label: e.target.value })}
                  />
                  <textarea
                    rows={2}
                    value={c.body ?? ''}
                    disabled={readOnly}
                    onChange={(e) => updateClause(i, { body: e.target.value })}
                    className={cn(
                      'flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-60',
                      c.bold && 'font-semibold'
                    )}
                  />
                  {!readOnly && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        variant={c.bold ? 'accent' : 'ghost'}
                        size="sm"
                        aria-pressed={!!c.bold}
                        title={c.bold ? 'Starts bold — click for normal weight' : 'Start this clause in bold'}
                        onClick={() => updateClause(i, { bold: !c.bold })}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveClause(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveClause(i, 1)}
                        disabled={i === clauses.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeClause(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {clauses.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No standard clauses. New contracts will start with an empty Additional Comments section.
                </div>
              )}

              {!readOnly && (
                <Button type="button" variant="outline" className="gap-2" onClick={addClause}>
                  <Plus className="h-4 w-4" />
                  Add clause
                </Button>
              )}
            </CardContent>
          </Card>
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
                <Label>Authorised signatory</Label>
                <Input
                  disabled={readOnly}
                  value={d.contractor.signatory ?? ''}
                  onChange={(e) => set('contractor.signatory', e.target.value)}
                  placeholder="Name only — the title has its own line"
                />
                <p className="text-xs text-muted-foreground">
                  Printed above the first contractor rule as “{(d.contractor.signatory || '').toUpperCase() || 'COMPANY NAME'}”, with “{d.labels.signatoryPrefix}” as the caption beneath it.
                  Upload the matching signature image on the Settings page.
                </p>
              </div>

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
