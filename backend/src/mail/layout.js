import { config } from '../config.js';
import { escapeHtml } from '../lib/util.js';

const C = {
  ink: '#16123a',
  muted: '#5d5a78',
  line: '#e7e4f3',
  bg: '#f5f3fc',
  accent: '#5b3df5',
  accent2: '#ff6a4d',
};

const nl2br = (s) => escapeHtml(s).replace(/\n/g, '<br>');

/**
 * Bouwt een e-mail (HTML + platte tekst).
 * blocks: array van
 *   { p: 'tekst' }                         – alinea
 *   { details: [[label, waarde], …] }      – tabel met gegevens
 *   { quote: 'tekst', by: 'naam' }         – bericht in kader
 *   { cta: { label, url } }                – knop
 *   { note: 'tekst' }                      – kleine grijze tekst
 */
export function renderMail({ subject, preheader = '', heading, blocks = [], footer }) {
  const htmlBlocks = blocks.map((b) => {
    if (b.p) return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.ink}">${nl2br(b.p)}</p>`;
    if (b.note) return `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${C.muted}">${nl2br(b.note)}</p>`;
    if (b.quote) {
      return `<div style="margin:0 0 18px;padding:14px 16px;border-left:4px solid ${C.accent};background:${C.bg};border-radius:10px">
        ${b.by ? `<div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.accent};margin-bottom:6px">${escapeHtml(b.by)}</div>` : ''}
        <div style="font-size:15px;line-height:1.55;color:${C.ink}">${nl2br(b.quote)}</div></div>`;
    }
    if (b.details) {
      const rows = b.details.filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;font-size:13px;color:${C.muted};vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>
          <td style="padding:8px 0;font-size:15px;color:${C.ink};vertical-align:top">${nl2br(v)}</td></tr>`).join('');
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
    }
    if (b.cta) {
      return `<p style="margin:8px 0 22px"><a href="${escapeHtml(b.cta.url)}" style="display:inline-block;background:${C.accent};background-image:linear-gradient(120deg,${C.accent},${C.accent2});color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px">${escapeHtml(b.cta.label)}</a></p>`;
    }
    return '';
  }).join('\n');

  const footerHtml = footer ?? `${escapeHtml(config.siteName)} · <a href="${config.publicUrl}/privacy" style="color:${C.muted}">Privacy</a>`;

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="height:6px;background:${C.accent};background-image:linear-gradient(90deg,${C.accent},${C.accent2})"></td></tr>
<tr><td style="padding:26px 26px 6px">
<div style="font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.accent}">${escapeHtml(config.siteName)}</div>
<h1 style="margin:10px 0 18px;font-size:23px;line-height:1.25;color:${C.ink}">${escapeHtml(heading)}</h1>
${htmlBlocks}
</td></tr>
<tr><td style="padding:16px 26px 24px;border-top:1px solid ${C.line};font-size:12px;line-height:1.5;color:${C.muted}">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;

  const textParts = [heading, ''];
  for (const b of blocks) {
    if (b.p) textParts.push(b.p, '');
    if (b.note) textParts.push(b.note, '');
    if (b.quote) textParts.push(`${b.by ? b.by + ':\n' : ''}> ${b.quote.replace(/\n/g, '\n> ')}`, '');
    if (b.details) {
      for (const [k, v] of b.details) if (v !== undefined && v !== null && v !== '') textParts.push(`${k}: ${v}`);
      textParts.push('');
    }
    if (b.cta) textParts.push(`${b.cta.label}: ${b.cta.url}`, '');
  }
  textParts.push('—', `${config.siteName} · Privacy: ${config.publicUrl}/privacy`);

  return { subject, html, text: textParts.join('\n') };
}
