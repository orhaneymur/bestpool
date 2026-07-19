import { useEffect, useState } from 'react';
import api from '@/api/client.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data));
  }, []);

  if (!s) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  async function save(e) {
    e.preventDefault();
    const { data } = await api.put('/settings', s);
    setS(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const f = (k) => ({
    value: s[k] || '',
    onChange: (e) => setS({ ...s, [k]: e.target.value }),
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Settings" subtitle="Company profile shown on proposal cover & header" />

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>These details appear on PDF covers and contract headers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Company name</Label>
                <Input {...f('company_name')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cover tagline</Label>
                <Input
                  {...f('company_tagline')}
                  placeholder="Where Customer Service is a Policy, Not a Department"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...f('company_phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fax</Label>
                <Input {...f('company_fax')} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...f('company_email')} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input {...f('company_website')} placeholder="www.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Tax office</Label>
                <Input {...f('tax_office')} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax ID</Label>
                <Input {...f('tax_no')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input {...f('company_address')} />
              </div>
              <div className="space-y-1.5">
                <Label>Proposal # prefix</Label>
                <Input {...f('quote_prefix')} />
              </div>
              <div className="space-y-1.5">
                <Label>Default tax %</Label>
                <Input
                  type="number"
                  value={s.default_vat_rate}
                  onChange={(e) => setS({ ...s, default_vat_rate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>PDF revision label</Label>
                <Input {...f('rev_label')} placeholder="Rev 06/2025" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="accent">
                Save
              </Button>
              {saved && <Badge variant="kabul">Saved ✓</Badge>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
