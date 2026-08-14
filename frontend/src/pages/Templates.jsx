import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import api from '@/api/client.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function Templates() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/templates').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);

  /**
   * The list carries only a short preview of the terms, so editing fetches the
   * full template. Saving the list row would otherwise truncate the contract
   * body to its first 200 characters.
   */
  async function edit(row) {
    setOpeningId(row.id);
    setErr('');
    try {
      const { data } = await api.get(`/templates/${row.id}`);
      setForm(data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Could not open this template.');
    } finally {
      setOpeningId(null);
    }
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    try {
      if (form.id) await api.put(`/templates/${form.id}`, form);
      else await api.post('/templates', form);
      setForm(null);
      load();
    } catch (e2) {
      setErr(e2.response?.data?.error || e2.message || 'Could not save this template.');
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Contract Templates"
        subtitle="Boilerplate terms printed after specification pages"
      >
        <Button
          type="button"
          variant="accent"
          className="gap-2"
          onClick={() => setForm({ name: '', body: '', is_default: false })}
        >
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </PageHeader>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {form && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{form.id ? 'Edit Template' : 'New Template'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Template name *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body (sections / clauses)</Label>
                <textarea
                  rows={12}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 sm:text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default template
              </label>
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

      <div className="grid gap-3">
        {rows.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{t.name}</div>
                  {t.is_default && <Badge variant="kabul">Default</Badge>}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                  {(t.body_preview || '').slice(0, 160) || 'No body text'}
                  {(t.body_preview || '').length > 160 ? '…' : ''}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={openingId === t.id}
                onClick={() => edit(t)}
              >
                {openingId === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
