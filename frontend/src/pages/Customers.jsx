import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react';
import api from '@/api/client.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

const EMPTY = {
  code: '',
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  tax_office: '',
  tax_no: '',
  notes: '',
};

const PAGE_SIZE = 50;

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  // Bumped to re-run the effect below after a save, so loading stays in one place.
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * One request per settled search, and never a stale one.
   *
   * This used to fire on every keystroke with no debounce and no cancellation,
   * so a slow early response could land after a fast later one and repaint the
   * table with results for a query the user had already moved past. That is what
   * made the list look like it "sometimes just doesn't load".
   */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get('/customers', {
          params: { q: q.trim() || undefined, page, limit: PAGE_SIZE },
          signal: controller.signal,
        })
        .then((r) => {
          setRows(r.data.rows || []);
          setTotal(r.data.count || 0);
          setErr('');
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setErr(e.response?.data?.error || e.message || 'Could not load customers.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, page, reloadKey]);

  // A new search starts from the first page rather than from wherever the user
  // had paged to for the previous one.
  useEffect(() => {
    setPage(1);
  }, [q]);

  const reload = () => setReloadKey((n) => n + 1);

  /**
   * The table only carries the columns it draws, so editing has to fetch the
   * full record — otherwise saving would blank out address, notes and tax
   * details that the row never contained.
   */
  async function edit(customer) {
    setOpeningId(customer.id);
    setErr('');
    try {
      const { data } = await api.get(`/customers/${customer.id}`);
      // Columns with no value come back as null, and a null `value` would flip
      // these inputs from controlled to uncontrolled mid-edit.
      const filled = { ...EMPTY };
      for (const key of Object.keys(EMPTY)) filled[key] = data[key] ?? '';
      setForm({ ...filled, id: data.id });
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Could not open this customer.');
    } finally {
      setOpeningId(null);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      if (form.id) await api.put(`/customers/${form.id}`, form);
      else await api.post('/customers', form);
      setForm(null);
      reload();
    } catch (e2) {
      setErr(e2.response?.data?.error || e2.message || 'Could not save this customer.');
    } finally {
      setSaving(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Customers" subtitle="Accounts, contacts, and facility owners">
        <Button type="button" variant="accent" className="gap-2" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="h-4 w-4" />
          New Customer
        </Button>
      </PageHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9 pr-9"
          placeholder="Search name, code, phone, tax ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {form && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{form.id ? 'Edit Customer' : 'New Customer'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Account code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Auto"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Customer / Facility name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact person</Label>
                  <Input
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax office</Label>
                  <Input
                    value={form.tax_office}
                    onChange={(e) => setForm({ ...form, tax_office: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax ID</Label>
                  <Input value={form.tax_no} onChange={(e) => setForm({ ...form, tax_no: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label>Notes</Label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/customers/${c.id}`} className="text-base font-semibold hover:text-accent">
                    {c.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.code || '—'}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={openingId === c.id}
                  onClick={() => edit(c)}
                >
                  {openingId === c.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Edit
                </Button>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                <div>{c.contact_person || 'No contact'}</div>
                <div>{c.phone || '—'}</div>
                <div>{c.city || '—'}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading…' : 'No records.'}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{c.code}</td>
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="font-semibold hover:text-accent">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={openingId === c.id}
                      onClick={() => edit(c)}
                    >
                      {openingId === c.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {loading ? 'Loading…' : 'No records.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            {`Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{`Page ${page} / ${lastPage}`}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
