// Pedaços de interface reutilizados pelas telas.

import { icon } from '../icons.js';
import { getCategory } from '../store.js';
import {
  escapeHtml, money, signedMoney, balanceMoney, addMonths, monthShort, currentMonth, dayLabel, weekday,
} from '../utils.js';

export function pageHeader({ title, subtitle = '', actions = '' }) {
  return `<header class="page-header">
    <div>
      <h1 class="page-title">${title}</h1>
      ${subtitle ? `<p class="page-sub">${subtitle}</p>` : ''}
    </div>
    <div class="page-actions">${actions}</div>
  </header>`;
}

/** Faixa de meses em vidro (cliques tratados globalmente em app.js via data-month / data-month-step). */
export function monthStrip(month) {
  const chips = [];
  for (let i = -3; i <= 3; i++) {
    const key = addMonths(month, i);
    chips.push(`<button type="button" class="month-chip d${Math.abs(i)}${i === 0 ? ' active' : ''}" data-month="${key}"
      ${i === 0 ? 'aria-current="true"' : ''}>${monthShort(key)}</button>`);
  }
  const today = currentMonth();
  return `<nav class="month-strip" aria-label="Selecionar mês">
    <button type="button" class="icon-btn" data-month-step="-1" aria-label="Mês anterior">${icon('chevron-left')}</button>
    <div class="month-chips">${chips.join('')}</div>
    <button type="button" class="icon-btn" data-month-step="1" aria-label="Próximo mês">${icon('chevron-right')}</button>
    ${month !== today ? `<button type="button" class="today-btn" data-month="${today}">Mês atual</button>` : ''}
  </nav>`;
}

export function categoryIcon(category, size = 20) {
  return `<span class="tx-icon" style="--c:${escapeHtml(category.color)}">${icon(category.icon, size)}</span>`;
}

export function txRow(t) {
  const c = getCategory(t.categoryId, t.type);
  return `<button type="button" class="tx-row" data-edit-tx="${escapeHtml(t.id)}" title="Clique para editar">
    ${categoryIcon(c)}
    <span class="row-main">
      <strong>${escapeHtml(t.description)}</strong>
      <small>${escapeHtml(c.name)}${t.notes ? ` · ${escapeHtml(t.notes)}` : ''}</small>
    </span>
    <span class="tx-amount ${t.type}">${signedMoney(t.amount, t.type)}</span>
  </button>`;
}

/** Lista agrupada por dia. Espera a lista já ordenada. */
export function txList(list, { dayTotals = false } = {}) {
  const groups = new Map();
  for (const t of list) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups]
    .map(([date, items]) => {
      const net = items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
      return `<div class="tx-group">
        <div class="tx-day">
          <span>${dayLabel(date)} <small>${weekday(date)}</small></span>
          ${dayTotals ? `<small class="${net < 0 ? 'neg' : 'pos'}">${balanceMoney(net)}</small>` : ''}
        </div>
        ${items.map(txRow).join('')}
      </div>`;
    })
    .join('');
}

export function emptyMini(text, iconName = 'file') {
  return `<div class="empty-mini">${icon(iconName, 28)}<p>${text}</p></div>`;
}

export function progressBar(ratio, color) {
  return `<span class="bar-track"><span class="bar-fill" style="width:${Math.max(0, Math.min(100, ratio * 100)).toFixed(1)}%;--c:${escapeHtml(color)}"></span></span>`;
}

/** Notificação temporária no canto da tela. */
export function toast(message, kind = 'success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check', 18)}<span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 2800);
}

