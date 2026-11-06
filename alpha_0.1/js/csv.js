// Leitura de CSV e heurísticas para extratos bancários.

import { normalize, parseDate, parseAmount } from './utils.js';
import { store, categoriesOf, FALLBACK } from './store.js';

function countOutsideQuotes(line, ch) {
  let n = 0;
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ch && !inQuotes) n++;
  }
  return n;
}

/** Converte texto CSV em matriz de strings. Detecta o separador (; , ou tab) e respeita aspas. */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delimiter = [';', ',', '\t']
    .map((d) => [d, countOutsideQuotes(firstLine, d)])
    .sort((a, b) => b[1] - a[1])[0][0];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  return { delimiter, rows: rows.filter((r) => r.some((c) => c.trim() !== '')) };
}

/** Tenta descobrir quais colunas são data, descrição e valor. */
export function guessMapping(rows) {
  const first = rows[0] ?? [];
  const hasHeader = !first.some((c) => parseDate(c));
  const header = hasHeader ? first.map(normalize) : [];
  const sample = rows.slice(hasHeader ? 1 : 0, hasHeader ? 21 : 20);
  const width = Math.max(...rows.map((r) => r.length));

  const byHeader = (re) => header.findIndex((h) => re.test(h));
  let date = byHeader(/\b(data|date|dt)\b|^data/);
  let amount = byHeader(/valor|amount|value|quantia|montante|preco/);
  let description = byHeader(/descri|title|titulo|historico|estabelecimento|lancamento|memo|detalhe|nome/);

  const allMatch = (col, test) => sample.length > 0 && sample.every((r) => test(r[col] ?? ''));
  const cols = [...Array(width).keys()];

  if (date < 0) date = cols.find((c) => allMatch(c, (v) => parseDate(v))) ?? -1;
  if (amount < 0) {
    amount = cols.find((c) => c !== date && allMatch(c, (v) => /\d/.test(v) && !parseDate(v) && Number.isFinite(parseAmount(v)) && /^[\s()R$+\-\d.,]+$/.test(v))) ?? -1;
  }
  if (description < 0) {
    const avgLen = (c) => sample.reduce((a, r) => a + (r[c]?.trim().length ?? 0), 0) / (sample.length || 1);
    description = cols.filter((c) => c !== date && c !== amount).sort((a, b) => avgLen(b) - avgLen(a))[0] ?? -1;
  }
  return { hasHeader, date, description, amount };
}

/* Regras simples de categorização automática por palavra-chave (texto sem acento, minúsculo). */
const RULES = [
  [/mercado ?livre|amazon|shopee|magalu|magazine|americanas|shein|aliexpress|renner|riachuelo|\bloja/, 'cat-compras'],
  [/mercado|supermerc|atacad|assai|carrefour|hortifrut|feira|pao de acucar|sacolao|\bextra\b/, 'cat-mercado'],
  [/ifood|rappi|restaurante|lanchonete|padaria|pizzaria|burger|mcdonald|\bcafe|starbucks|\bbar\b|sushi|churrasc/, 'cat-restaurantes'],
  [/uber|\b99\b|99 ?(app|pop|taxi)|taxi|combustivel|posto|shell|ipiranga|estacionamento|metro|onibus|pedagio|sem parar|bilhete unico/, 'cat-transporte'],
  [/netflix|spotify|youtube|disney|prime video|hbo|\bmax\b|globoplay|deezer|apple\.com|icloud|google one|paramount|crunchyroll/, 'cat-assinaturas'],
  [/aluguel|condominio|energia|\bluz\b|enel|cemig|copel|light|\bagua\b|sabesp|saneamento|internet|\bvivo\b|\bclaro\b|\btim\b|\boi\b|\bgas\b|iptu/, 'cat-moradia'],
  [/farmacia|drogaria|droga|raia|pacheco|hospital|clinica|consulta|laboratorio|exame|unimed|amil|odonto/, 'cat-saude'],
  [/curso|escola|faculdade|universidade|udemy|alura|livro|livraria|mensalidade escolar/, 'cat-educacao'],
  [/cinema|ingresso|sympla|show|teatro|steam|playstation|xbox|nintendo|viagem|hotel|airbnb|booking/, 'cat-lazer'],
  [/salario|pagamento de salario|folha de pagamento|proventos/, 'cat-salario'],
  [/rendimento|dividendo|juros|\bcdb\b|tesouro|resgate/, 'cat-investimentos'],
];

export function guessCategory(description, type) {
  const text = normalize(description);
  const available = categoriesOf(type);
  for (const [re, id] of RULES) {
    if (re.test(text) && available.some((c) => c.id === id)) return id;
  }
  return available.find((c) => c.id === FALLBACK[type])?.id ?? available[0]?.id ?? null;
}

export const duplicateKey = (t) => `${t.date}|${t.amount}|${t.type}|${normalize(t.description)}`;

/**
 * Transforma as linhas do CSV em transações prontas para importar.
 * signMode: 'negative-expense' (extrato de conta: valores negativos são despesas)
 *           'positive-expense' (fatura de cartão: valores positivos são despesas)
 */
export function buildImportItems(rows, { hasHeader, date, description, amount }, signMode) {
  const existing = new Set(store.state.transactions.map(duplicateKey));
  const items = [];
  let invalid = 0;

  for (const r of hasHeader ? rows.slice(1) : rows) {
    const iso = parseDate(r[date]);
    const cents = parseAmount(r[amount]);
    if (!iso || !Number.isFinite(cents) || cents === 0) { invalid++; continue; }

    const isExpense = signMode === 'negative-expense' ? cents < 0 : cents > 0;
    const type = isExpense ? 'expense' : 'income';
    const desc = (r[description] ?? '').trim().replace(/\s+/g, ' ').slice(0, 120) || 'Sem descrição';
    const item = { date: iso, description: desc, amount: Math.abs(cents), type, categoryId: guessCategory(desc, type) };
    item.duplicate = existing.has(duplicateKey(item));
    item.selected = !item.duplicate;
    items.push(item);
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  return { items, invalid };
}
