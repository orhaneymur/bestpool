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
  // The mail account is proved from this screen: 'check' authenticates, 'send'
  // posts a real message.
  const [smtpBusy, setSmtpBusy] = useState(null);
  const [smtpMsg, setSmtpMsg] = useState(null);
  const [testTo, setTestTo] = useState('');

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

  /**
   * Runs against what the server has stored, not what is on screen.
   *
   * Testing the typed-in values would prove nothing about the account that
   * actually sends: the fields fall back to the pod's environment one at a
   * time, and only the server knows what it ends up with.
   */
  async function testSmtp(mode) {
    setSmtpBusy(mode);
    setSmtpMsg(null);
    try {
      const { data } = await api.post('/settings/smtp-test', { mode, to: testTo });
      setSmtpMsg({
        ok: true,
        text:
          mode === 'send'
            ? `Test message sent to ${data.to} from ${data.from}.`
            : `Connected to ${data.host}:${data.port} as ${data.user}. Proposals will be sent from ${data.from}.`,
      });
    } catch (e2) {
      setSmtpMsg({ ok: false, text: e2.response?.data?.error || e2.message || 'The test failed.' });
    } finally {
      setSmtpBusy(null);
    }
  }

  const f = (k) => ({
    value: s[k] || '',
    onChange: (e) => setS({ ...s, [k]: e.target.value }),
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Company profile printed on the contract, and the mailbox proposals are sent from"
      />

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

      <Card>
        <CardHeader>
          <CardTitle>Email (SMTP)</CardTitle>
          <CardDescription>
            The mailbox proposals are sent from. Leave a field blank and the server's own setting is used
            instead, so an install already configured on the server keeps working untouched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>SMTP server</Label>
              <Input {...f('smtp_host')} placeholder="smtp.gmail.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={s.smtp_port ?? ''}
                  onChange={(e) => setS({ ...s, smtp_port: e.target.value })}
                  placeholder="587"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Security</Label>
                <select
                  value={s.smtp_secure ? 'ssl' : 'starttls'}
                  onChange={(e) => {
                    const ssl = e.target.value === 'ssl';
                    // The two must agree — 465 with STARTTLS does not fail, it
                    // hangs until the socket times out. A port the user chose
                    // themselves is left alone.
                    const port = Number(s.smtp_port);
                    const standard = !s.smtp_port || port === 465 || port === 587;
                    setS({ ...s, smtp_secure: ssl, ...(standard ? { smtp_port: ssl ? 465 : 587 } : {}) });
                  }}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                >
                  <option value="starttls">STARTTLS (587)</option>
                  <option value="ssl">SSL/TLS (465)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input {...f('smtp_user')} placeholder="name@example.com" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={s.smtp_pass ?? ''}
                onChange={(e) => setS({ ...s, smtp_pass: e.target.value })}
                placeholder={s.smtp_pass_set ? 'Saved — type to replace' : 'App password'}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                {s.smtp_pass_set
                  ? 'A password is stored. It is never sent back to this page — leave the box untouched to keep it.'
                  : 'For Gmail and Outlook this is an app password, not your account password.'}
                {s.smtp_pass_set && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => setS({ ...s, smtp_pass: '', smtp_pass_set: false })}
                      className="font-medium text-destructive underline-offset-2 hover:underline"
                    >
                      Forget it
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Send from</Label>
              <Input {...f('smtp_from_email')} placeholder="Blank = the Email above" />
            </div>
            <div className="space-y-1.5">
              <Label>Sender name</Label>
              <Input {...f('smtp_from_name')} placeholder="Blank = the company name" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Replies go to</Label>
              <Input {...f('smtp_reply_to')} placeholder="Blank = the send-from address" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" disabled={!!smtpBusy} onClick={() => testSmtp('check')}>
              {smtpBusy === 'check' ? 'Checking…' : 'Test connection'}
            </Button>
            <div className="flex flex-1 items-center gap-2">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="Send a test message to…"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" disabled={!!smtpBusy} onClick={() => testSmtp('send')}>
                {smtpBusy === 'send' ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Save first — the test uses the settings stored on the server, not what is typed above.
          </p>

          {smtpMsg && (
            <div
              className={
                smtpMsg.ok
                  ? 'rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
                  : 'rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'
              }
            >
              {smtpMsg.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
