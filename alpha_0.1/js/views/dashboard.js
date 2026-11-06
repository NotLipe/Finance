import { store, txInMonth, totals, byCategory, sortByDateDesc } from '../store.js';
import { icon } from '../icons.js';
import { donut, incomeExpenseBars } from '../charts.js';
import { pageHeader, monthStrip, txList, emptyMini, categoryIcon, toast } from '../components/ui.js';
import {
  money, balanceMoney, percent, monthName, monthLabel, monthShort, addMonths, escapeHtml,
} from '../utils.js';

let categoryType = 'expense';

export function render(root, ctx) {
  const { month } = ctx;
  const header =
    pageHeader({
      title: 'Controle seus <span class="ring">gastos</span>',
      subtitle: `Resumo de ${monthLabel(month)}`,
      actions: `<button type="button" class="btn btn-primary" data-action="new-transaction">${icon('plus', 18)} Nova transação</button>`,
    }) + monthStrip(month);

  if (!store.state.transactions.length) {
    root.innerHTML = header + onboarding();
    root.querySelector('[data-load-sample]').addEventListener('click', () => {
      store.loadSample();
      toast('Dados de exemplo carregados');
    });
    return;
  }

  const list = txInMonth(month);
  const t = totals(list);
  const prevMonth = addMonths(month, -1);
  const prev = totals(txInMonth(prevMonth));
  const expenseDelta = prev.expense ? (t.expense - prev.expense) / prev.expense : null;
  const savingsRate = t.income ? t.balance / t.income : null;

  const cats = byCategory(list, categoryType);
  const catTotal = categoryType === 'expense' ? t.expense : t.income;

  const series = [];
  for (let i = 5; i >= 0; i--) {
    const key = addMonths(month, -i);
    series.push({ key, label: monthShort(key), ...totals(txInMonth(key)) });
  }

  const recent = sortByDateDesc(list).slice(0, 8);

  root.innerHTML = `${header}
  <div class="dash-grid">
    <section class="card balance-card">
      <div class="card-head">
        <h2>Saldo de ${monthName(month)}</h2>
        <a class="icon-btn soft" href="#/transacoes" title="Ver transações">${icon('chart')}</a>
      </div>
      <div class="balance-value${t.balance < 0 ? ' neg' : ''}">${balanceMoney(t.balance)}</div>
      <div class="stat-tiles">
        <div class="stat-tile">
          <span class="stat-ico up">${icon('trending-up', 16)}</span>
          <span class="stat-label">Receitas</span>
          <strong class="pos">+${money(t.income)}</strong>
        </div>
        <div class="stat-tile">
          <span class="stat-ico down">${icon('trending-down', 16)}</span>
          <span class="stat-label">Despesas</span>
          <strong class="neg">−${money(t.expense)}</strong>
        </div>
      </div>
      <ul class="insights">
        <li><span>Despesas vs ${monthName(prevMonth)}</span>
          <strong class="${expenseDelta > 0 ? 'neg' : expenseDelta < 0 ? 'pos' : ''}">${expenseDelta === null ? '—' : `${expenseDelta > 0 ? '+' : ''}${percent(expenseDelta, 1)}`}</strong></li>
        <li><span>Taxa de economia</span><strong>${savingsRate === null ? '—' : percent(savingsRate, 1)}</strong></li>
        <li><span>Transações no mês</span><strong>${list.length}</strong></li>
      </ul>
    </section>

    <section class="card chart-card">
      <div class="card-head">
        <div>
          <h2>Receitas x Despesas</h2>
          <p class="card-sub">Últimos 6 meses · clique em um mês para selecioná-lo</p>
        </div>
        <div class="legend"><span><i style="--c:var(--income)"></i>Receitas</span><span><i style="--c:var(--expense)"></i>Despesas</span></div>
      </div>
      ${incomeExpenseBars(series, month)}
    </section>

    <section class="card categories-card">
      <div class="card-head">
        <h2>Categorias</h2>
        <div class="segmented sm" role="group" aria-label="Tipo de categoria">
          <button type="button" data-cat-type="expense" class="${categoryType === 'expense' ? 'active' : ''}">Despesas</button>
          <button type="button" data-cat-type="income" class="${categoryType === 'income' ? 'active' : ''}">Receitas</button>
        </div>
      </div>
      ${cats.length
        ? `<div class="cats-body">
            ${donut(
              cats.map((c) => ({ value: c.value, color: c.category.color, label: c.category.name })),
              { label: categoryType === 'expense' ? 'Total gasto' : 'Total recebido', value: money(catTotal) },
            )}
            <ul class="cat-list">
              ${cats.map((c) => `<li class="row">
                  ${categoryIcon(c.category)}
                  <span class="row-main"><strong>${escapeHtml(c.category.name)}</strong><small>${money(c.value)}</small></span>
                  <span class="pct-pill">${Math.round(c.pct * 100)}%</span>
                </li>`).join('')}
            </ul>
          </div>`
        : emptyMini(`Nenhuma ${categoryType === 'expense' ? 'despesa' : 'receita'} em ${monthName(month)}.`, 'tag')}
    </section>

    <section class="card recent-card">
      <div class="card-head">
        <h2>Últimas transações</h2>
        <a class="link" href="#/transacoes">Ver todas</a>
      </div>
      <div class="scroll-area">
        ${recent.length ? txList(recent) : emptyMini(`Nada registrado em ${monthName(month)} ainda.`, 'arrows')}
      </div>
    </section>
  </div>`;

  root.querySelectorAll('[data-cat-type]').forEach((b) =>
    b.addEventListener('click', () => { categoryType = b.dataset.catType; render(root, ctx); }));
}

function onboarding() {
  const features = [
    ['arrows', 'Receitas e despesas', 'Registre tudo em segundos, com categoria e data.'],
    ['tag', 'Categorias', 'Use as sugeridas ou crie as suas, com cor e ícone.'],
    ['chart', 'Resumo mensal', 'Saldo, gráficos e comparação com o mês anterior.'],
    ['upload', 'Importar extrato', 'Traga transações de um CSV do seu banco.'],
  ];
  return `<section class="card onboarding">
    <div>
      <span class="eyebrow">alpha 0.1</span>
      <h2>Bem-vindo ao Finance</h2>
      <p class="muted">Comece registrando sua primeira transação, importe um extrato ou explore o app com dados de exemplo.
      Seus dados ficam salvos apenas neste navegador.</p>
      <div class="onboarding-actions">
        <button type="button" class="btn btn-primary" data-action="new-transaction">${icon('plus', 18)} Nova transação</button>
        <a class="btn btn-ghost" href="#/importar">${icon('upload', 18)} Importar extrato</a>
        <button type="button" class="btn btn-ghost" data-load-sample>${icon('sparkles', 18)} Ver com dados de exemplo</button>
      </div>
    </div>
    <ul class="feature-list">
      ${features.map(([ic, title, text]) => `<li class="row"><span class="tx-icon" style="--c:var(--primary)">${icon(ic)}</span>
        <span class="row-main"><strong>${title}</strong><small>${text}</small></span></li>`).join('')}
    </ul>
  </section>`;
}
