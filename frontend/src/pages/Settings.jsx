import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
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
  const [err, setErr] = useState('');
  const fileInput = useRef(null);

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
    setErr('');
    try {
      const { data } = await api.put('/settings', s);
      setS(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e2) {
      setErr(e2.response?.data?.error || e2.message || 'Could not save the settings.');
    }
  }

  /**
   * Reads the picked image straight into a data URI.
   *
   * The whole signature travels inside the ordinary settings save — no upload
   * endpoint, no file on disk. Pods are replaced on every deploy, so a file
   * written into the container would not survive one; the database would have
   * had to hold it either way.
   */
  function pickSignature(file) {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setErr('The signature must be a PNG or JPEG image.');
      return;
    }
    // Roughly the server's ceiling, checked here first so an over-large file is
    // rejected before it is read and sent.
    if (file.size > 700 * 1024) {
      setErr('That image is too large. A signature should be well under 700 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setS((prev) => ({ ...prev, signature_image: String(reader.result) }));
    reader.onerror = () => setErr('Could not read that file.');
    reader.readAsDataURL(file);
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
                  placeholder="Safety Is Our Standard, Service Is Our Promise"
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
                <Label>Contract no prefix</Label>
                <Input {...f('quote_prefix')} placeholder="FSPM" />
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
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Authorised signature</Label>
              <p className="text-xs text-muted-foreground">
                Printed above the contractor signature line on the specification page of every new
                contract. A PNG with a transparent background reproduces best. Switch it off for a single
                contract from its PDF output step, or for all of them under Definitions → PDF blocks.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {s.signature_image ? (
                  <img
                    src={s.signature_image}
                    alt="Authorised signature"
                    className="h-16 max-w-[240px] rounded-lg border border-border bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-16 w-[240px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    No signature uploaded
                  </div>
                )}

                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    pickSignature(e.target.files?.[0]);
                    // Cleared so picking the same file again still fires onChange.
                    e.target.value = '';
                  }}
                />
                <Button type="button" variant="outline" className="gap-2" onClick={() => fileInput.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {s.signature_image ? 'Replace' : 'Upload'}
                </Button>
                {s.signature_image && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 text-destructive"
                    onClick={() => setS({ ...s, signature_image: '' })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Changes take effect once you save.</p>
            </div>

            {err && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {err}
              </div>
            )}

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
