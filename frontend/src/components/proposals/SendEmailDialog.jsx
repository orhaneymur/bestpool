import { useEffect, useState } from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import api from '@/api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';

export default function SendEmailDialog({ quoteId, open, onClose, onSent }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [configured, setConfigured] = useState(true);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (!open || !quoteId) return;
    setErr('');
    setOk('');
    setLoading(true);
    api
      .get(`/quotes/${quoteId}/email-preview`)
      .then((r) => {
        setTo(r.data.to || r.data.customer_email || '');
        setSubject(r.data.subject || '');
        setText(r.data.text || '');
        setCustomerName(r.data.customer_name || '');
        setConfigured(!!r.data.configured);
      })
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load email draft.'))
      .finally(() => setLoading(false));
  }, [open, quoteId]);

  async function send() {
    setErr('');
    setOk('');
    setSending(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/email`, { to, subject, text });
      setOk(`Email sent to ${data.to}`);
      onSent?.(data);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-paper">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4 text-accent" />
              Send proposal to customer
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Review the PDF first, then send. Message is pre-filled in English for{' '}
              <strong>{customerName || 'the customer'}</strong>.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing email draft…
            </div>
          ) : (
            <>
              {!configured && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  SMTP is not configured on the server yet. Set <code>SMTP_PASS</code> (Gmail App Password)
                  for <strong>orhaneymur@gmail.com</strong>, then retry.
                </div>
              )}
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="customer@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>From / Reply-to</Label>
                <Input value="orhaneymur@gmail.com" disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <textarea
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The current proposal PDF will be attached automatically.
              </p>
              {err && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {err}
                </div>
              )}
              {ok && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {ok}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="accent"
            className="gap-2"
            disabled={loading || sending || !to}
            onClick={send}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send email with PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
