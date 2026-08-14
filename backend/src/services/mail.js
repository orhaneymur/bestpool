import nodemailer from 'nodemailer';
import { renderDocument } from './renderPool.js';

const COMPANY_MAIL = process.env.MAIL_FROM || process.env.SMTP_USER || 'orhaneymur@gmail.com';

function money(n, cur = 'USD') {
  const symbol = cur === 'TRY' ? '₺' : cur === 'EUR' ? '€' : '$';
  const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
  return `${symbol}${s}`;
}

function dateEN(d) {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function buildProposalEmail(quote, setting = {}) {
  const customerName = quote.Customer?.name || 'Valued Customer';
  const company = setting.company_name || 'Four Seasons Pool Management';
  const fromEmail = setting.company_email || COMPANY_MAIL;
  const facility = quote.facility_name || customerName;
  const season =
    quote.season_start || quote.season_end
      ? `${dateEN(quote.season_start)} – ${dateEN(quote.season_end)}`
      : 'as discussed';
  const total = money(quote.total, quote.currency || 'USD');
  const earlyBird = Number(quote.early_bird_discount || 0);
  const earlyLine =
    earlyBird > 0
      ? `\nEarly Bird Price: ${money(Number(quote.total) - earlyBird, quote.currency || 'USD')} (if executed by ${dateEN(quote.valid_until)})\n`
      : '\n';

  const subject =
    `Contract ${quote.quote_no || ''} — Commercial Pool Management Agreement for ${facility}`.replace(/\s+/g, ' ').trim();

  const text = `Hello ${customerName},

Following our discussion, please find attached the commercial swimming pool management proposal we have prepared specifically for you.

Contract : ${quote.quote_no || 'DRAFT'}
Facility: ${facility}
Season: ${season}
Total Contract Price: ${total}${earlyLine}
Please review the attached PDF at your convenience. If you have any questions or would like to proceed, simply reply to this email or contact us at ${fromEmail}.

We look forward to working with you this season.

Best regards,
${company}
${setting.company_phone ? `${setting.company_phone}\n` : ''}${fromEmail}
${setting.company_website ? `${setting.company_website}\n` : ''}`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.55; max-width: 640px;">
      <p>Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      <p>Following our discussion, please find attached the commercial swimming pool management proposal we have prepared specifically for you.</p>
      <table style="border-collapse: collapse; margin: 16px 0; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Contract</td><td style="padding: 6px 0;"><strong>${escapeHtml(quote.quote_no || 'DRAFT')}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Facility</td><td style="padding: 6px 0;">${escapeHtml(facility)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Season</td><td style="padding: 6px 0;">${escapeHtml(season)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Total Contract Price</td><td style="padding: 6px 0;"><strong>${escapeHtml(total)}</strong></td></tr>
        ${
          earlyBird > 0
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Early Bird Price</td><td style="padding: 6px 0;">${escapeHtml(
                money(Number(quote.total) - earlyBird, quote.currency || 'USD')
              )} (if executed by ${escapeHtml(dateEN(quote.valid_until))})</td></tr>`
            : ''
        }
      </table>
      <p>Please review the attached PDF at your convenience. If you have any questions or would like to proceed, simply reply to this email or contact us at <a href="mailto:${escapeHtml(fromEmail)}">${escapeHtml(fromEmail)}</a>.</p>
      <p>We look forward to working with you this season.</p>
      <p style="margin-top: 24px;">
        Best regards,<br/>
        <strong>${escapeHtml(company)}</strong><br/>
        ${setting.company_phone ? `${escapeHtml(setting.company_phone)}<br/>` : ''}
        ${escapeHtml(fromEmail)}
        ${setting.company_website ? `<br/>${escapeHtml(setting.company_website)}` : ''}
      </p>
    </div>
  `;

  return {
    from: `"${company}" <${fromEmail}>`,
    to: quote.Customer?.email || '',
    subject,
    text,
    html,
  };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || COMPANY_MAIL;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';

  if (!pass) {
    const err = new Error(
      'Email is not configured. Set SMTP_PASS (Gmail App Password) for orhaneymur@gmail.com on the server.'
    );
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendProposalEmail(quote, setting, overrides = {}) {
  const draft = buildProposalEmail(quote, setting);
  const to = (overrides.to || draft.to || '').trim();
  if (!to) {
    const err = new Error('Customer email is missing. Add an email on the customer record or enter a recipient.');
    err.code = 'NO_RECIPIENT';
    throw err;
  }

  const subject = overrides.subject || draft.subject;
  const text = overrides.text || draft.text;
  const html = overrides.html || draft.html;

  // Same render path the download button uses, so the attachment is built on a
  // worker thread rather than blocking the API while an email goes out.
  const pdfBuffer = await renderDocument('pdf', quote, setting || {});
  const filename = `${quote.quote_no || 'proposal'}.pdf`;

  const transporter = getTransport();
  const info = await transporter.sendMail({
    from: draft.from,
    to,
    replyTo: COMPANY_MAIL,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return { messageId: info.messageId, to, subject };
}
