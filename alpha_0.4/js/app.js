// Ponto de entrada: monta o menu, faz o roteamento por hash (#/rota) e re-renderiza as telas
// sempre que os dados mudam ou o mês selecionado muda.

import { store } from './store.js';
import { icon } from './icons.js';
import { currentMonth, addMonths, defaultDateFor } from './utils.js';
import { openTransactionModal } from './components/transaction-form.js';
import * as dashboard from './views/dashboard.js';
import * as transactions from './views/transactions.js';
import * as categories from './views/categories.js';
import * as importer from './views/import.js';
import * as settings from './views/settings.js';
import * as goals from './views/goals.js';

const ROUTES = {
  dashboard: { label: 'Visão geral', icon: 'grid', view: dashboard },
  transacoes: { label: 'Transações', icon: 'arrows', view: transactions },
  categorias: { label: 'Categorias', icon: 'tag', view: categories },
  metas: { label: 'Metas', icon: 'target', view: goals },
  importar: { label: 'Importar', icon: 'upload', view: importer },
  configuracoes: { label: 'Ajustes', icon: 'sliders', view: settings },
};

// Módulos planejados (inspirados nas referências de design) — aparecem no menu como "em breve".
const COMING_SOON = [
  { label: 'Assinaturas', icon: 'repeat' },
  { label: 'Contas', icon: 'wallet' },
];

const MONTH_KEY = 'finance:selected-month';
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

function readSavedMonth() {
  try {
    const saved = sessionStorage.getItem(MONTH_KEY);
    return isMonth(saved) ? saved : currentMonth();
  } catch {
    return currentMonth();
  }
}

const ctx = {
  month: readSavedMonth(),
  setMonth(month, rerender = true) {
    if (!isMonth(month)) return;
    ctx.month = month;
    try { sessionStorage.setItem(MONTH_KEY, month); } catch { /* sem storage, segue a vida */ }
    if (rerender) render();
  },
};

const currentRoute = () => {
  const name = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return ROUTES[name] ? name : 'dashboard';
};

function renderSidebar(active) {
  document.getElementById('sidebar').innerHTML = `
    <a class="brand" href="#/dashboard">
      <span class="brand-mark">${icon('logo', 20)}</span>
      <span>Finance<small>alpha 0.4</small></span>
    </a>
    <nav class="nav">
      ${Object.entries(ROUTES).map(([key, r]) => `
        <a href="#/${key}" class="${key === active ? 'active' : ''}" ${key === active ? 'aria-current="page"' : ''}>
          ${icon(r.icon)}<span>${r.label}</span>
        </a>`).join('')}
      <span class="nav-label">Em breve</span>
      ${COMING_SOON.map((r) => `<span class="nav-soon">${icon(r.icon)}<span>${r.label}</span></span>`).join('')}
    </nav>
    <button type="button" class="btn btn-primary sidebar-cta" data-action="new-transaction">${icon('plus', 18)} Nova transação</button>
    <p class="sidebar-foot">Dados salvos localmente neste navegador.</p>`;
}

function render() {
  const route = currentRoute();
  renderSidebar(route);
  const root = document.getElementById('view');
  // Preserva a rolagem ao re-renderizar a mesma tela (ex.: após salvar uma transação).
  const scroll = window.scrollY;
  ROUTES[route].view.render(root, ctx);
  window.scrollTo(0, scroll);
}

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

store.subscribe(() => render());

// Ações globais via atributos data-* (funcionam em qualquer tela).
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-month], [data-month-step], [data-action], [data-edit-tx]');
  if (!el || el.closest('.modal')) return;

  if (el.dataset.month) ctx.setMonth(el.dataset.month);
  else if (el.dataset.monthStep) ctx.setMonth(addMonths(ctx.month, Number(el.dataset.monthStep)));
  else if (el.dataset.action === 'new-transaction') openTransactionModal(null, { date: defaultDateFor(ctx.month) });
  else if (el.dataset.editTx) {
    const tx = store.state.transactions.find((t) => t.id === el.dataset.editTx);
    if (tx) openTransactionModal(tx);
  }
});

// Atalho: tecla "N" abre uma nova transação (fora de campos de texto e modais).
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop')) return;
  e.preventDefault();
  openTransactionModal(null, { date: defaultDateFor(ctx.month) });
});

render();
