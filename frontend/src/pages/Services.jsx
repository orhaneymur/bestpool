import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, EyeOff, Eye, GripVertical, Pencil, Check, X, Loader2 } from 'lucide-react';
import api from '@/api/client.js';
import { fmtMoney } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

const EMPTY = {
  code: '',
  name: '',
  category: '',
  unit: 'season',
  default_unit_price: 0,
  vat_rate: 0,
  is_active: true,
};
const UNITS = ['unit', 'hour', 'day', 'week', 'month', 'season'];

/** Pulls the server's message out of an axios error instead of showing "Request failed". */
function apiError(e, fallback) {
  return e?.response?.data?.error || e?.message || fallback;
}

/**
 * Blocking confirm with room to explain consequences — window.confirm() cannot
 * show the list of affected contracts, and stacking two of them is confusing.
 */
function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel, busy, secondary }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {secondary && (
            <Button type="button" variant="secondary" onClick={secondary.onClick} disabled={busy}>
              {secondary.label}
            </Button>
          )}
          <Button
            type="button"
            variant={danger ? 'destructive' : 'accent'}
            onClick={onConfirm}
            disabled={busy}
            className="gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Services() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);

  const load = () =>
    Promise.all([api.get('/services?all=1'), api.get('/service-categories')]).then(([s, c]) => {
      setRows(s.data);
      setCats(c.data);
    });

  useEffect(() => {
    load().catch((e) => setErr(apiError(e, 'Could not load the service catalogue.')));
  }, []);

  const catName = useMemo(() => {
    const map = new Map(cats.map((c) => [c.code, c.name]));
    return (code) => map.get(code) || code || '—';
  }, [cats]);

  function flash(text) {
    setMsg(text);
    setErr('');
    setTimeout(() => setMsg(''), 2500);
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (form.id) await api.put(`/services/${form.id}`, form);
      else await api.post('/services', form);
      setForm(null);
      await load();
      flash('Saved');
    } catch (e2) {
      setErr(apiError(e2, 'Could not save the service.'));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(s, force) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/services/${s.id}${force ? '?force=1' : ''}`);
      setDialog(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
      await load();
      flash(data.detached ? `Deleted — ${data.detached} contract line(s) unlinked` : 'Deleted');
      return true;
    } catch (e) {
      const data = e?.response?.data;
      if (data?.canForce) {
        // Used by existing contracts. Offer both ways out and spell out what
        // force actually does, because "delete anyway" reads alarming.
        setDialog({
          title: `“${s.name}” is used by ${data.contracts} contract line(s)`,
          danger: true,
          confirmLabel: 'Remove anyway',
          body: (
            <>
              <p>
                Those contracts keep their wording, quantities and prices exactly as they are — the line text and
                totals are stored on the contract itself, not read from the catalogue.
              </p>
              <p>Removing it only drops the link back to this catalogue entry.</p>
            </>
          ),
          onConfirm: () => doDelete(s, true),
          secondary: { label: 'Deactivate instead', onClick: () => { setDialog(null); toggleActive(s, false); } },
        });
        return false;
      }
      setDialog(null);
      setErr(apiError(e, 'Could not delete the service.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function remove(s) {
    setErr('');
    setDialog({
      title: `Delete “${s.name}”?`,
      danger: true,
      confirmLabel: 'Delete',
      body: <p>This removes it from the catalogue. It cannot be undone.</p>,
      onConfirm: () => doDelete(s, false),
    });
  }

  function removeSelected() {
    setErr('');
    const chosen = rows.filter((r) => selected.has(r.id));
    if (!chosen.length) return;
    setDialog({
      title: `Delete ${chosen.length} service${chosen.length === 1 ? '' : 's'}?`,
      danger: true,
      confirmLabel: 'Remove anyway',
      body: (
        <>
          <ul className="max-h-40 list-disc overflow-auto pl-5">
            {chosen.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
          <p>
            Any of these still used by a contract will be unlinked from it, not removed from it: existing contracts
            keep their line text, quantities and totals unchanged.
          </p>
        </>
      ),
      onConfirm: async () => {
        setBusy(true);
        try {
          const { data } = await api.post('/services/bulk-delete', {
            ids: chosen.map((c) => c.id),
            force: true,
          });
          setDialog(null);
          setSelected(new Set());
          await load();
          flash(
            `Deleted ${data.deleted.length} service(s)` +
              (data.detached ? ` — ${data.detached} contract line(s) unlinked` : '')
          );
        } catch (e) {
          setDialog(null);
          setErr(apiError(e, 'Could not delete the selected services.'));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function toggleActive(s, next) {
    setErr('');
    try {
      await api.put(`/services/${s.id}`, { is_active: next });
      await load();
      flash(next ? 'Service activated' : 'Service deactivated');
    } catch (e) {
      setErr(apiError(e, 'Could not change the service.'));
    }
  }

  const activeCats = cats.filter((c) => c.is_active || c.code === form?.category);

  const visible = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((s) =>
      [s.name, s.code, catName(s.category)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(q)
    );
  }, [rows, filter, catName]);

  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((s) => next.delete(s.id));
      else visible.forEach((s) => next.add(s.id));
      return next;
    });
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Service Catalog" subtitle="Default unit prices populate when creating a contract">
        <Button
          type="button"
          variant="accent"
          className="gap-2"
          onClick={() => setForm({ ...EMPTY, category: cats[0]?.code || '' })}
        >
          <Plus className="h-4 w-4" />
          New Service
        </Button>
        {msg && <Badge variant="kabul">{msg}</Badge>}
      </PageHeader>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services ({rows.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({cats.length})</TabsTrigger>
        </TabsList>

        {/* ---------------- Services ---------------- */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Filter by name, code or category…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilter('')}>
                Clear
              </Button>
            )}
            <div className="flex-1" />
            {isAdmin && selected.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
                <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={removeSelected}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete selected
                </Button>
              </>
            )}
          </div>

          {form && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{form.id ? 'Edit Service' : 'New Service'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={save} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Code</Label>
                      <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Service name *</Label>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <select
                        value={form.category || ''}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                      >
                        <option value="">— None —</option>
                        {activeCats.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {cats.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No categories yet — add one on the Categories tab.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <select
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.default_unit_price}
                        onChange={(e) => setForm({ ...form, default_unit_price: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.vat_rate}
                        onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active !== false}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="h-4 w-4 accent-accent"
                      />
                      Active — offered when building a contract
                    </label>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => setForm(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="accent" disabled={busy} className="gap-2">
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((s) => (
              <Card key={s.id} className={cn(s.is_active === false && 'opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-accent"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.code} · {catName(s.category)} · {s.unit}
                      </div>
                      <div className="mt-2 text-sm font-semibold tabular-nums">
                        {fmtMoney(s.default_unit_price)} · {s.vat_rate}% tax
                      </div>
                    </div>
                    {s.is_active === false && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...s })}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => toggleActive(s, s.is_active === false)}
                    >
                      {s.is_active === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {s.is_active === false ? 'Activate' : 'Deactivate'}
                    </Button>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive"
                        onClick={() => remove(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isAdmin && (
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-accent"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          title="Select all shown"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {visible.map((s) => (
                    <tr
                      key={s.id}
                      className={cn(
                        'hover:bg-muted/30',
                        s.is_active === false && 'opacity-55',
                        selected.has(s.id) && 'bg-accent/5'
                      )}
                    >
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-accent"
                            checked={selected.has(s.id)}
                            onChange={() => toggleOne(s.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{s.code}</td>
                      <td className="px-4 py-3 font-medium">
                        {s.name}
                        {s.is_active === false && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs">{catName(s.category)}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(s.default_unit_price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.vat_rate}%</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...s })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title={s.is_active === false ? 'Activate' : 'Deactivate'}
                            onClick={() => toggleActive(s, s.is_active === false)}
                          >
                            {s.is_active === false ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Delete"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => remove(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-muted-foreground">
                        {rows.length ? 'No service matches that filter.' : 'No services yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- Categories ---------------- */}
        <TabsContent value="categories">
          <CategoryManager
            cats={cats}
            isAdmin={isAdmin}
            reload={load}
            onError={setErr}
            onDone={flash}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        secondary={dialog?.secondary}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => dialog?.onConfirm?.()}
      >
        {dialog?.body}
      </ConfirmDialog>
    </div>
  );
}

function CategoryManager({ cats, isAdmin, reload, onError, onDone }) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.post('/service-categories', { name: newName.trim() });
      setNewName('');
      await reload();
      onDone('Category added');
    } catch (e2) {
      onError(apiError(e2, 'Could not add the category.'));
    } finally {
      setBusy(false);
    }
  }

  async function rename(cat) {
    if (!editing?.name.trim()) return;
    try {
      await api.put(`/service-categories/${cat.id}`, { name: editing.name.trim() });
      setEditing(null);
      await reload();
      onDone('Category renamed');
    } catch (e) {
      onError(apiError(e, 'Could not rename the category.'));
    }
  }

  async function remove(cat) {
    if (!window.confirm(`Delete the category “${cat.name}”?`)) return;
    try {
      await api.delete(`/service-categories/${cat.id}`);
      await reload();
      onDone('Category deleted');
    } catch (e) {
      onError(apiError(e, 'Could not delete the category.'));
    }
  }

  async function move(cat, direction) {
    const ordered = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    const i = ordered.findIndex((c) => c.id === cat.id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    try {
      await api.put(`/service-categories/${ordered[i].id}`, { sort_order: ordered[j].sort_order });
      await api.put(`/service-categories/${ordered[j].id}`, { sort_order: ordered[i].sort_order });
      await reload();
    } catch (e) {
      onError(apiError(e, 'Could not reorder the categories.'));
    }
  }

  async function toggle(cat) {
    try {
      await api.put(`/service-categories/${cat.id}`, { is_active: !cat.is_active });
      await reload();
    } catch (e) {
      onError(apiError(e, 'Could not change the category.'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service categories</CardTitle>
        <CardDescription>
          These fill the Category dropdown when you add a service. Renaming one updates every service that uses
          it; the internal key never changes, so nothing loses its category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" variant="accent" className="gap-1.5" disabled={busy || !newName.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        )}

        <div className="divide-y divide-border/70 rounded-xl border border-border">
          {cats.map((c, i) => (
            <div
              key={c.id}
              className={cn('flex flex-wrap items-center gap-2 px-3 py-2.5', !c.is_active && 'opacity-55')}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

              {editing?.id === c.id ? (
                <>
                  <Input
                    autoFocus
                    className="max-w-[220px]"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(c);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => rename(c)}>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{c.code}</code>
                  <Badge variant="outline" className="text-[10px]">
                    {c.service_count} service{c.service_count === 1 ? '' : 's'}
                  </Badge>
                  {!c.is_active && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                </>
              )}

              {isAdmin && editing?.id !== c.id && (
                <div className="flex gap-0.5">
                  <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => move(c, -1)}>
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={i === cats.length - 1}
                    onClick={() => move(c, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Rename"
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title={c.is_active ? 'Hide from the dropdown' : 'Show in the dropdown'}
                    onClick={() => toggle(c)}
                  >
                    {c.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Delete"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {cats.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">No categories yet.</div>
          )}
        </div>

        {!isAdmin && (
          <p className="text-xs text-muted-foreground">Only administrators can change categories.</p>
        )}
      </CardContent>
    </Card>
  );
}
