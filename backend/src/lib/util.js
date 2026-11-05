import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import { config } from '../config.js';

export const newToken = () => crypto.randomBytes(24).toString('base64url');

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRef() {
  const bytes = crypto.randomBytes(5);
  let s = '';
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  return `B-${s}`;
}

export const now = () => DateTime.now().setZone(config.timezone);
export const todayISO = () => now().toISODate();

export function fmtDate(iso) {
  return DateTime.fromISO(iso, { zone: config.timezone }).setLocale('nl-BE').toFormat('cccc d LLLL yyyy');
}
export function fmtDateShort(iso) {
  return DateTime.fromISO(iso, { zone: config.timezone }).setLocale('nl-BE').toFormat('ccc d LLL');
}
export function fmtDateTime(date) {
  const d = date instanceof Date ? DateTime.fromJSDate(date) : DateTime.fromISO(String(date));
  return d.setZone(config.timezone).setLocale('nl-BE').toFormat("cccc d LLLL yyyy 'om' HH:mm");
}
export function fmtTime(date) {
  const d = date instanceof Date ? DateTime.fromJSDate(date) : DateTime.fromISO(String(date));
  return d.setZone(config.timezone).toFormat('HH:mm');
}

// Telefoonnummer naar wa.me-formaat (alleen cijfers, met landcode; Belgisch 04.. → 324..)
export function waNumber(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '32' + d.slice(1);
  return d;
}

export function waLink(phone, text) {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
