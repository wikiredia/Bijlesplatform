import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

/** Zonder SMTP_HOST worden mails enkel gelogd (handig om lokaal te testen). */
export function getTransport() {
  if (transporter) return transporter;
  if (!config.mail.host) {
    console.warn('[mail] SMTP_HOST niet ingesteld → mails worden NIET verstuurd, enkel gelogd.');
    transporter = {
      sendMail: async (m) => {
        console.log(`[mail:log] aan=${m.to} onderwerp="${m.subject}" bijlagen=${(m.attachments || []).length}`);
        return { messageId: 'log' };
      },
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
}
