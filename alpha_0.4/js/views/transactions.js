import { store, txInMonth, totals, byCategory, sortByDateDesc, getCategory, categoriesOf } from '../store.js';
import { icon } from '../icons.js';
import { pageHeader, monthStrip, txList, emptyMini, categoryIcon, progressBar } from '../components/ui.js';
import {
  money, balanceMoney, monthLabel, monthName, escapeHtml, normalize, download, formatAmountInput,
} from '../utils.js';

// Filtros ficam em memória enquanto o app está aberto.
const filters = { q: '', type: 'all', category: 'all' };

function applyFilters(list) {
  const q = normalize(filters.q);
  return list.filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;
    if (filters.category !== 'all' && getCategory(t.categoryId, t.type).id !== filters.category) return false;
    if (q) {
      const haystack = normalize(`${t.description} ${getCategory(t.categoryId, t.type).name} ${t.notes}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

const categoryOptions = (type, label) =>
  `<optgroup label="${label}">${categoriesOf(type)
    .map((c) => `<option value="${escapeHtml(c.id)}" ${filters.category === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('')}</optgroup>`;

export function render(root, ctx) {
  const { month } = ctx;
  if (filters.category !== 'all' && !store.state.categories.some((c) => c.id === filters.category)) filters.category = 'all';

  root.innerHTML = `
    ${pageHeader({
      title: 'Suas <span class="ring">transações</span>',
      subtitle: monthLabel(month),
      actions: `<button type="button" class="btn btn-glass" data-export>${icon('download', 18)} Exportar CSV</button>
        <button type="button" class="btn btn-primary" data-action="new-transaction">${icon('plus', 18)} Nova transação</button>`,
    })}
    ${monthStrip(month)}
    <div class="tx-layout">
      <section class="card">
        <div class="toolbar">
          <label class="search">${icon('search', 18)}
            <input type="search" placeholder="Buscar por descrição, categoria ou observação" value="${escapeHtml(filters.q)}" data-filter-q aria-label="Buscar">
          </label>
          <div class="segmented" role="group" aria-label="Filtrar por tipo">
            ${[['all', 'Todas'], ['expense', 'Despesas'], ['income', 'Receitas']]
              .map(([v, l]) => `<button type="button" data-filter-type="${v}" class="${filters.type === v ? 'active' : ''}">${l}</button>`).join('')}
          </div>
          <select class="select" data-filter-cat aria-label="Filtrar por categoria">
            <option value="all">Todas as categorias</option>
            ${categoryOptions('expense', 'Despesas')}
            ${categoryOptions('income', 'Receitas')}
          </select>
        </div>
        <div data-list></div>
      </section>
      <aside class="card tx-side" data-side></aside>
    </div>`;

  const listEl = root.querySelector('[data-list]');
  const sideEl = root.querySelector('[data-side]');

  function update() {
    const monthList = txInMonth(month);
    const list = sortByDateDesc(applyFilters(monthList));
    const filtered = filters.q || filters.type !== 'all' || filters.category !== 'all';

    listEl.innerHTML = list.length
      ? txList(list, { dayTotals: true })
      : emptyMini(
          monthList.length
            ? 'Nenhuma transação encontrada com esses filtros.'
            : `Nenhuma transação em ${monthName(month)}. <button type="button" class="link" data-action="new-transaction">Adicionar agora</button>`,
          filtered ? 'search' : 'arrows',
        );

    const t = totals(list);
    const top = byCategory(list, 'expense').slice(0, 6);
    sideEl.innerHTML = `
      <div class="card-head"><h2>Resumo</h2>${filtered ? '<span class="chip">Filtrado</span>' : ''}</div>
      <ul class="summary">
        <li><span>Receitas</span><strong class="pos">+${money(t.income)}</strong></li>
        <li><span>Despesas</span><strong class="neg">−${money(t.expense)}</strong></li>
        <li class="total"><span>Saldo</span><strong class="${t.balance < 0 ? 'neg' : ''}">${balanceMoney(t.balance)}</strong></li>
        <li><span>Transações</span><strong>${list.length}</strong></li>
      </ul>
      ${top.length ? `<h3 class="side-title">Onde você mais gastou</h3>
        <ul class="top-cats">
          ${top.map((c) => `<li>
              ${categoryIcon(c.category, 18)}
              <div class="row-main">
                <span class="top-line"><strong>${escapeHtml(c.category.name)}</strong><span>${money(c.value)}</span></span>
                ${progressBar(c.pct, c.category.color)}
              </div>
            </li>`).join('')}
        </ul>` : ''}`;
  }

  root.querySelector('[data-filter-q]').addEventListener('input', (e) => { filters.q = e.target.value; update(); });
  root.querySelectorAll('[data-filter-type]').forEach((b) =>
    b.addEventListener('click', () => {
      filters.type = b.dataset.filterType;
      root.querySelectorAll('[data-filter-type]').forEach((x) => x.classList.toggle('active', x === b));
      update();
    }));
  root.querySelector('[data-filter-cat]').addEventListener('change', (e) => { filters.category = e.target.value; update(); });
  root.querySelector('[data-export]').addEventListener('click', () => exportCSV(sortByDateDesc(applyFilters(txInMonth(month))), month));

  update();
}

/** Exporta em CSV com ";" e vírgula decimal (abre direto no Excel em português). */
function exportCSV(list, month) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Observação'].join(';')];
  for (const t of list) {
    const value = `${t.type === 'expense' ? '-' : ''}${formatAmountInput(t.amount).replace(/\./g, '')}`;
    lines.push([
      t.date.split('-').reverse().join('/'),
      esc(t.description),
      esc(getCategory(t.categoryId, t.type).name),
      t.type === 'income' ? 'Receita' : 'Despesa',
      value,
      esc(t.notes),
    ].join(';'));
  }
  download(`finance-transacoes-${month}.csv`, `﻿${lines.join('\r\n')}`, 'text/csv;charset=utf-8');
}
