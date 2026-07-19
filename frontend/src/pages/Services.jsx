import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/api/client.js';
import { fmtMoney } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

const EMPTY = {
  code: '',
  name: '',
  category: 'maintenance',
  unit: 'month',
  default_unit_price: 0,
  vat_rate: 0,
  is_active: true,
};
const CATS = ['maintenance', 'lifeguard', 'chemical', 'permit', 'winterization', 'equipment', 'other'];
const UNITS = ['unit', 'hour', 'week', 'month', 'season'];

export default function Services() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => api.get('/services').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    if (form.id) await api.put(`/services/${form.id}`, form);
    else await api.post('/services', form);
    setForm(null);
    load();
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Service Catalog"
        subtitle="Default unit prices populate when creating a proposal"
      >
        <Button type="button" variant="accent" className="gap-2" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="h-4 w-4" />
          New Service
        </Button>
      </PageHeader>

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
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Service name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                  >
                    {CATS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
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
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent">
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:hidden">
        {rows.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-base font-semibold">{s.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.code} · {s.category} · {s.unit}
                </div>
                <div className="mt-2 text-sm font-semibold tabular-nums">
                  {fmtMoney(s.default_unit_price)} · {s.vat_rate}% tax
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(s)}>
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Unit price</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{s.code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs">{s.category}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(s.default_unit_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.vat_rate}%</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(s)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
