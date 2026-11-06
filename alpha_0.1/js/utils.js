// Funções utilitárias: formatação de dinheiro/datas, parsing e helpers gerais.
// Valores monetários são SEMPRE guardados em centavos (inteiros) para evitar erros de ponto flutuante.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------- Dinheiro ---------- */

export const money = (cents) => BRL.format((cents || 0) / 100);

/** "+R$ 10,00" para receitas e "−R$ 10,00" para despesas. */
export const signedMoney = (cents, type) => `${type === 'income' ? '+' : '−'}${money(Math.abs(cents))}`;

/** Saldo com sinal (positivo/negativo). */
export const balanceMoney = (cents) => `${cents < 0 ? '−' : '+'}${money(Math.abs(cents))}`;

export function compactMoney(cents) {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(v)}`;
}

export const percent = (ratio, digits = 0) =>
  `${(ratio * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;

/**
 * Converte texto em centavos. Aceita formatos BR e US:
 * "1.234,56" · "1234.56" · "R$ -12,00" · "(45,90)" · "-45.9"
 * Retorna NaN quando não há número.
 */
export function parseAmount(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw * 100) : NaN;
  let s = String(raw ?? '').trim();
  if (!s) return NaN;
  const negative = s.includes('-') || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart = s;
  let decPart = '';
  const splitAt = (i) => { intPart = s.slice(0, i); decPart = s.slice(i + 1); };

  if (lastComma > -1 && lastDot > -1) splitAt(Math.max(lastComma, lastDot));
  else if (lastComma > -1) { if (s.split(',').length === 2) splitAt(lastComma); }
  else if (lastDot > -1) {
    // "12.500" (3 dígitos após o ponto) é tratado como milhar; "12.5" / "12.50" como decimal.
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length !== 3) splitAt(lastDot);
  }

  intPart = intPart.replace(/[.,]/g, '');
  const cents = parseInt(intPart || '0', 10) * 100 + Math.round(Number(`0.${decPart || '0'}`) * 100);
  return negative ? -cents : cents;
}

/** Centavos -> "1.234,56" (para preencher inputs). */
export const formatAmountInput = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- Datas (sempre strings ISO "YYYY-MM-DD" para evitar problemas de fuso) ---------- */

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const currentMonth = () => todayISO().slice(0, 7);

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(parseISO(s)) === s;
}

/** Soma n meses a uma chave "YYYY-MM". */
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key) => `${monthName(key)} de ${key.slice(0, 4)}`;
export const monthShort = (key) => `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

export function dayLabel(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
export const weekday = (iso) => WEEKDAYS[parseISO(iso).getDay()];
export const formatDateBR = (iso) => iso.split('-').reverse().join('/');

/** Data padrão para uma nova transação no mês selecionado. */
export const defaultDateFor = (month) => (month === currentMonth() ? todayISO() : `${month}-01`);

/** Lê datas em "DD/MM/AAAA", "DD/MM/AA", "AAAA-MM-DD" (e variações com - ou .). */
export function parseDate(raw) {
  const s = String(raw ?? '').trim();
  let m, y, mo, d;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/))) {
    [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
  } else return null;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return isValidISO(iso) ? iso : null;
}

/* ---------- Texto ---------- */

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Minúsculas e sem acentos — usado em buscas e comparações. */
export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* ---------- Arquivos ---------- */

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um arquivo de texto tentando UTF-8 e, se houver caracteres inválidos, Windows-1252 (comum em bancos). */
export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try { return new TextDecoder('windows-1252').decode(buffer); } catch { return utf8; }
}
