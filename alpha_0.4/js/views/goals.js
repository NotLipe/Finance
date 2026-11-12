import { store, INVESTMENT_EXPENSE } from '../store.js';
import { icon } from '../icons.js';
import { lineChart } from '../charts.js';
import { pageHeader, monthStrip, categoryIcon, progressBar, toast } from '../components/ui.js';
import { openBudgetModal, openTotalBudgetModal } from '../components/budget-form.js';
import { openGoalModal } from '../components/goal-form.js';
import { openTransactionModal } from '../components/transaction-form.js';
import { confirmDialog } from '../components/modal.js';
import { budgetOverview, suggestedLimits, projection, goalStatus } from '../planning.js';
import {
  money, balanceMoney, monthName, monthLabel, monthShort, escapeHtml, formatAmountInput, parseAmount,
  currentMonth, defaultDateFor, percent,
} from '../utils.js';

let tab = 'orcamento';

const TABS = [
  ['orcamento', 'Orçamento', 'sliders'],
  ['projecao', 'Projeção', 'chart'],
  ['objetivos', 'Objetivos', 'target'],
];

const STATUS_LABEL = { ok: 'Dentro', warn: 'Atenção', over: 'Estourou', none: 'Sem meta' };

export function render(root, ctx) {
  const subtitle = {
    orcamento: `Orçamento de ${monthLabel(ctx.month)}`,
    projecao: 'Como fica sua sobra nos próximos 6 meses',
    objetivos: 'Quanto falta e quando você chega lá',
  }[tab];

  root.innerHTML = `
    ${pageHeader({
      title: 'Alcance suas <span class="ring">metas</span>',
      subtitle,
      actions: tab === 'objetivos'
        ? `<button type="button" class="btn btn-primary" data-new-goal>${icon('plus', 18)} Novo objetivo</button>`
        : `<button type="button" class="btn btn-primary" data-action="new-transaction">${icon('plus', 18)} Nova transação</button>`,
    })}
    <nav class="tab-strip" aria-label="Seções de metas">
      ${TABS.map(([key, label, ic]) => `<button type="button" class="tab${tab === key ? ' active' : ''}" data-tab="${key}"
        ${tab === key ? 'aria-current="true"' : ''}>${icon(ic, 18)}<span>${label}</span></button>`).join('')}
    </nav>
    ${tab === 'orcamento' ? monthStrip(ctx.month) + budgetTab(ctx) : tab === 'projecao' ? projectionTab() : goalsTab()}`;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(root, ctx); }));

  if (tab === 'orcamento') bindBudget(root, ctx);
  if (tab === 'projecao') bindProjection(root);
  if (tab === 'objetivos') bindGoals(root, ctx);
}

/* =============================== Orçamento =============================== */

/** Barra de progresso do orçamento com marcador de "hoje" (onde o gasto deveria estar no ritmo ideal). */
function budgetBar(spent, limit, prog, color, status) {
  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const marker = prog.state === 'current' && limit
    ? `<span class="bbar-marker" style="left:${(prog.fraction * 100).toFixed(1)}%" title="Hoje: ${percent(prog.fraction)} do mês"></span>`
    : '';
  return `<span class="bbar ${status}"><span class="bbar-fill" style="width:${pct.toFixed(1)}%;--c:${escapeHtml(color)}"></span>${marker}</span>`;
}

function budgetNote(r, prog) {
  const over = r.projected - r.limit;
  if (r.status === 'over') return `Passou ${money(r.spent - r.limit)} do limite.`;
  if (prog.state === 'past') return `Fechou em ${money(r.spent)}, sobraram ${money(r.limit - r.spent)}.`;
  if (prog.state === 'future') return r.avg ? `Média recente: ${money(r.avg)}.` : 'Sem histórico para comparar.';
  const label = r.category.fixed ? 'Previsão (gasto fixo)' : 'Previsão de fechamento';
  return over > 0
    ? `${label}: <strong>${money(r.projected)}</strong>, ${money(over)} acima da meta.`
    : `${label}: <strong>${money(r.projected)}</strong>, dentro da meta.`;
}

function budgetTab(ctx) {
  const ov = budgetOverview(ctx.month);
  const { prog } = ov;
  const withLimit = ov.rows.filter((r) => r.limit)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const withoutLimit = ov.rows.filter((r) => !r.limit)
    .sort((a, b) => b.spent - a.spent || b.avg - a.avg || a.category.name.localeCompare(b.category.name));
  const suggestions = suggestedLimits();
  const pendingSuggestions = Object.keys(suggestions).filter((id) => !store.state.budgets.byCategory[id]).length;

  const remaining = ov.limit - ov.spent;
  const perDay = prog.state === 'current' && remaining > 0
    ? Math.floor(remaining / (prog.daysInMonth - prog.daysElapsed + 1))
    : null;

  const summary = `
    <section class="card budget-summary">
      <div class="card-head">
        <h2>Total do mês</h2>
        ${ov.limit ? `<span class="status-pill ${ov.status}">${STATUS_LABEL[ov.status]}</span>` : ''}
      </div>
      ${ov.limit ? `
        <div class="budget-total"><strong>${money(ov.spent)}</strong><span>de ${money(ov.limit)}</span></div>
        <p class="card-sub">${ov.limitIsTotal ? 'Todos os gastos do mês contra o teto mensal.' : 'Só as categorias com limite. Defina um teto mensal para contar todos os gastos.'}</p>
        ${budgetBar(ov.spent, ov.limit, prog, 'var(--blue)', ov.status)}
        <ul class="summary">
          ${prog.state === 'current' ? `<li><span>Previsão de fechamento</span><strong class="${ov.projected > ov.limit ? 'neg' : 'pos'}">${money(ov.projected)}</strong></li>` : ''}
          <li><span>${remaining >= 0 ? 'Disponível' : 'Acima do teto'}</span><strong class="${remaining < 0 ? 'neg' : ''}">${money(Math.abs(remaining))}</strong></li>
          ${perDay !== null ? `<li><span>Pode gastar por dia</span><strong>${money(perDay)}</strong></li>` : ''}
          ${prog.state === 'current' ? `<li><span>Mês decorrido</span><strong>${percent(prog.fraction)}</strong></li>` : ''}
        </ul>
        <div class="status-counts">
          <span class="status-pill ok">${ov.counts.ok} dentro</span>
          <span class="status-pill warn">${ov.counts.warn} atenção</span>
          <span class="status-pill over">${ov.counts.over} estourou</span>
        </div>`
      : `<p class="muted">Defina limites por categoria (ao lado) ou um teto para o mês inteiro. Assim você acompanha se está gastando dentro do esperado.</p>`}
      <div class="limit-line">
        <div><span>Teto mensal</span><strong>${ov.limitIsTotal ? money(ov.limit) : ov.sumOfLimits ? `Soma das categorias (${money(ov.sumOfLimits)})` : 'Não definido'}</strong></div>
        <button type="button" class="btn btn-ghost sm" data-edit-total>${icon('pencil', 16)} ${ov.limitIsTotal ? 'Editar' : 'Definir'}</button>
      </div>
      ${pendingSuggestions ? `
        <div class="suggest-box">
          ${icon('sparkles', 18)}
          <div><strong>Sugestão de limites</strong><small>Com base na sua média dos últimos meses, para ${pendingSuggestions} categoria${pendingSuggestions > 1 ? 's' : ''} sem limite.</small></div>
          <button type="button" class="btn btn-primary sm" data-suggest>Aplicar</button>
        </div>` : ''}
    </section>`;

  const limitRows = withLimit.map((r) => `
    <li>
      <button type="button" class="budget-row" data-budget="${escapeHtml(r.category.id)}" title="Editar limite">
        ${categoryIcon(r.category)}
        <span class="row-main">
          <span class="top-line">
            <strong>${escapeHtml(r.category.name)}${r.category.fixed ? ' <em class="tag-fixed">fixo</em>' : ''}</strong>
            <span>${money(r.spent)} <small>de ${money(r.limit)}</small></span>
          </span>
          ${budgetBar(r.spent, r.limit, prog, r.category.color, r.status)}
          <small class="budget-note">${budgetNote(r, prog)}</small>
        </span>
        <span class="status-pill ${r.status}">${STATUS_LABEL[r.status]}</span>
      </button>
    </li>`).join('');

  const freeRows = withoutLimit.map((r) => `
    <li class="row free-row">
      ${categoryIcon(r.category, 18)}
      <span class="row-main">
        <strong>${escapeHtml(r.category.name)}${r.category.fixed ? ' <em class="tag-fixed">fixo</em>' : ''}</strong>
        <small>${money(r.spent)} em ${monthName(ctx.month)}${r.avg ? ` · média ${money(r.avg)}` : ''}</small>
      </span>
      <button type="button" class="btn btn-ghost sm" data-budget="${escapeHtml(r.category.id)}">${icon('plus', 16)} Definir</button>
    </li>`).join('');

  return `<div class="budget-layout">
    <section class="card">
      <div class="card-head">
        <div><h2>Limites por categoria</h2>
          <p class="card-sub">${prog.state === 'current'
            ? 'A linha na barra marca onde você deveria estar hoje, no ritmo ideal.'
            : prog.state === 'past' ? `Resultado de ${monthName(ctx.month)}.` : 'Mês futuro: limites e médias de referência.'}</p></div>
      </div>
      ${withLimit.length ? `<ul class="budget-list">${limitRows}</ul>` : `<div class="notice">${icon('info', 18)} Nenhum limite definido ainda. Use “Definir” nas categorias abaixo ou aplique a sugestão.</div>`}
      ${withoutLimit.length ? `<h3 class="side-title">Sem limite definido</h3><ul class="free-list">${freeRows}</ul>` : ''}
    </section>
    ${summary}
  </div>`;
}

function bindBudget(root, ctx) {
  const ov = budgetOverview(ctx.month);
  root.querySelectorAll('[data-budget]').forEach((b) =>
    b.addEventListener('click', () => {
      const row = ov.rows.find((r) => r.category.id === b.dataset.budget);
      if (row) openBudgetModal(row.category, { avg: row.avg });
    }));
  root.querySelector('[data-edit-total]')?.addEventListener('click', () => openTotalBudgetModal(ov.sumOfLimits));
  root.querySelector('[data-suggest]')?.addEventListener('click', async () => {
    const suggestions = suggestedLimits();
    const pending = Object.fromEntries(Object.entries(suggestions).filter(([id]) => !store.state.budgets.byCategory[id]));
    const list = Object.entries(pending)
      .map(([id, v]) => `<li><span>${escapeHtml(ov.rows.find((r) => r.category.id === id)?.category.name ?? '')}</span><strong>${money(v)}</strong></li>`)
      .join('');
    const ok = await confirmDialog({
      title: 'Aplicar limites sugeridos?',
      message: `Média dos últimos meses, arredondada para cima. Você pode ajustar cada um depois.<ul class="summary suggest-list">${list}</ul>`,
      confirmLabel: 'Aplicar',
    });
    if (!ok) return;
    store.setCategoryBudgets(pending);
    toast('Limites aplicados');
  });
}

/* =============================== Projeção =============================== */

function projectionTab() {
  const income = store.state.settings.monthlyIncome;
  const p = projection(6);
  const last = p.rows[p.rows.length - 1];
  const diff = last.accPlan - last.accTrend;

  const incomeCard = `
    <section class="card">
      <div class="card-head"><h2>Renda mensal</h2><span class="tx-icon" style="--c:var(--income)">${icon('briefcase')}</span></div>
      <p class="muted">Valor fixo usado nas projeções, por exemplo o seu salário líquido.</p>
      <form class="income-form" data-income-form novalidate>
        <label class="amount-field sm"><span>R$</span>
          <input name="income" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="Renda mensal"
            value="${income ? formatAmountInput(income) : ''}"></label>
        <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
      </form>
    </section>`;

  if (!income) {
    return `<div class="projection-layout">
      <div class="stack">${incomeCard}</div>
      <section class="card"><div class="empty-mini">${icon('chart', 32)}<p>Informe sua renda mensal para ver a projeção dos próximos meses.</p></div></section>
    </div>`;
  }

  const labels = p.rows.map((r) => monthShort(r.key));
  const chart = lineChart(labels, [
    { name: 'Se cumprir as metas', color: '#4f8ff0', values: p.rows.map((r) => r.accPlan) },
    { name: 'Se continuar como está', color: '#9b3cf0', values: p.rows.map((r) => r.accTrend), dashed: true },
  ]);

  const scenarios = `
    <section class="card">
      <div class="card-head"><h2>Em 6 meses</h2></div>
      <div class="scenario plan">
        <span class="dot"></span>
        <div><small>Se cumprir as metas</small><strong class="${last.accPlan < 0 ? 'neg' : ''}">${balanceMoney(last.accPlan)}</strong>
          <small>gastando até ${money(p.planned)} por mês</small></div>
      </div>
      <div class="scenario trend">
        <span class="dot"></span>
        <div><small>Se continuar como está</small><strong class="${last.accTrend < 0 ? 'neg' : ''}">${balanceMoney(last.accTrend)}</strong>
          <small>${p.historyMonths ? `média de ${money(p.trend)} por mês` : 'sem histórico suficiente ainda'}</small></div>
      </div>
      ${p.historyMonths && p.planned ? `<div class="notice ${diff >= 0 ? '' : 'warn'}">${icon(diff >= 0 ? 'trending-up' : 'info', 18)}
        <span>${diff >= 0
          ? `Cumprir as metas vale <strong>${money(diff)}</strong> a mais em 6 meses.`
          : `Seus limites somam mais do que você costuma gastar. Dá para apertar ${money(-diff / 6)} por mês.`}</span></div>` : ''}
    </section>`;

  const table = `
    <div class="table-wrap">
      <table class="preview proj-table">
        <thead><tr>
          <th>Mês</th><th class="num">Renda</th><th class="num">Gasto (metas)</th><th class="num">Gasto (atual)</th>
          <th class="num">Acumulado (metas)</th><th class="num">Acumulado (atual)</th>
        </tr></thead>
        <tbody>${p.rows.map((r, i) => `<tr>
          <td class="nowrap"><strong>${monthShort(r.key)}</strong>${i === 0 ? ' <span class="badge info">mês atual</span>' : ''}</td>
          <td class="num">${money(r.income)}</td>
          <td class="num">${money(r.planExpense)}</td>
          <td class="num">${money(r.trendExpense)}</td>
          <td class="num ${r.accPlan < 0 ? 'neg' : 'pos'}">${balanceMoney(r.accPlan)}</td>
          <td class="num ${r.accTrend < 0 ? 'neg' : 'pos'}">${balanceMoney(r.accTrend)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  return `<div class="projection-layout">
    <div class="stack">${incomeCard}${scenarios}</div>
    <section class="card">
      <div class="card-head">
        <div><h2>Sobra acumulada</h2><p class="card-sub">A partir de ${monthName(currentMonth())}. Aportes em investimentos contam como gasto aqui; o progresso deles aparece em Objetivos.</p></div>
        <div class="legend"><span><i style="--c:#4f8ff0"></i>Se cumprir as metas</span><span><i style="--c:#9b3cf0"></i>Se continuar como está</span></div>
      </div>
      ${chart}
      ${table}
    </section>
  </div>`;
}

function bindProjection(root) {
  const form = root.querySelector('[data-income-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = form.elements.income.value.trim();
    const cents = value ? Math.abs(parseAmount(value)) : 0;
    if (!Number.isFinite(cents)) return toast('Valor inválido', 'error');
    store.setMonthlyIncome(cents);
    toast(cents ? 'Renda mensal salva' : 'Renda mensal removida');
  });
}

/* =============================== Objetivos =============================== */

function statusLine(goal, s) {
  switch (s.status) {
    case 'done': return { kind: 'ok', text: 'Objetivo alcançado! 🎉' };
    case 'expired': return { kind: 'over', text: `O prazo (${monthShort(goal.deadline)}) passou e faltam ${money(s.remaining)}.` };
    case 'on-track': return { kind: 'ok', text: `No ritmo atual, você chega lá em <strong>${monthShort(s.eta)}</strong>, dentro do prazo.` };
    case 'late': return { kind: 'warn', text: `No ritmo atual, você chega lá em <strong>${monthShort(s.eta)}</strong>, ${s.lateBy} ${s.lateBy === 1 ? 'mês' : 'meses'} depois do prazo.` };
    case 'no-deadline': return { kind: 'ok', text: `No ritmo atual, você chega lá em <strong>${monthShort(s.eta)}</strong>.` };
    default: return { kind: 'none', text: 'Sem aportes recentes. Registre um aporte para calcular a previsão.' };
  }
}

function goalsTab() {
  const goals = store.state.goals;
  const hasInvestCategory = store.state.categories.some((c) => c.id === INVESTMENT_EXPENSE);

  if (!goals.length) {
    return `<section class="card onboarding">
      <div>
        <span class="eyebrow">Objetivos</span>
        <h2>Junte dinheiro para o que importa</h2>
        <p class="muted">Crie um objetivo com valor e prazo. O Finance calcula quanto guardar por mês e, pelos seus aportes na categoria
        “Investimentos” (despesa), mostra quando você deve chegar lá.</p>
        <div class="onboarding-actions"><button type="button" class="btn btn-primary" data-new-goal>${icon('plus', 18)} Criar primeiro objetivo</button></div>
      </div>
      <ul class="feature-list">
        ${[['target', 'Valor e prazo', 'Ex.: R$ 10.000 para uma viagem até julho.'],
          ['piggy', 'Aportes ligados', 'Cada aporte em Investimentos pode ir para um objetivo.'],
          ['chart', 'Previsão', 'Veja se está adiantado ou atrasado no ritmo atual.']]
          .map(([ic, t, d]) => `<li class="row"><span class="tx-icon" style="--c:var(--primary)">${icon(ic)}</span>
            <span class="row-main"><strong>${t}</strong><small>${d}</small></span></li>`).join('')}
      </ul>
    </section>`;
  }

  const statuses = goals.map((g) => [g, goalStatus(g)]);
  const totalSaved = statuses.reduce((a, [, s]) => a + s.saved, 0);
  const totalTarget = goals.reduce((a, g) => a + g.target, 0);
  const done = statuses.filter(([, s]) => s.status === 'done').length;

  const cards = statuses.map(([g, s]) => {
    const line = statusLine(g, s);
    return `<section class="card goal-card">
      <div class="goal-head">
        <span class="tx-icon lg" style="--c:${escapeHtml(g.color)}">${icon(g.icon, 24)}</span>
        <div class="row-main"><strong>${escapeHtml(g.name)}</strong><small>${g.deadline ? `Prazo: ${monthShort(g.deadline)}` : 'Sem prazo'}</small></div>
        <div class="row-actions">
          <button type="button" class="icon-btn" data-edit-goal="${escapeHtml(g.id)}" aria-label="Editar objetivo" title="Editar">${icon('pencil', 18)}</button>
          <button type="button" class="icon-btn danger" data-del-goal="${escapeHtml(g.id)}" aria-label="Excluir objetivo" title="Excluir">${icon('trash', 18)}</button>
        </div>
      </div>
      <div class="goal-amount"><strong>${money(s.saved)}</strong><span>de ${money(g.target)}</span><em>${Math.floor(s.pct * 100)}%</em></div>
      ${progressBar(s.pct, s.status === 'done' ? 'var(--income)' : g.color)}
      <ul class="summary">
        <li><span>Falta</span><strong>${money(s.remaining)}</strong></li>
        ${s.neededPerMonth !== null && s.status !== 'done' ? `<li><span>Necessário por mês</span><strong>${money(s.neededPerMonth)}</strong></li>` : ''}
        <li><span>Ritmo atual</span><strong>${s.pace ? `${money(s.pace)}/mês` : '—'}</strong></li>
      </ul>
      <div class="goal-status ${line.kind}">${line.text}</div>
      ${s.status !== 'done' ? `<button type="button" class="btn btn-ghost goal-btn" data-contribute="${escapeHtml(g.id)}" ${hasInvestCategory ? '' : 'disabled title="A categoria Investimentos (despesa) foi excluída"'}>
        ${icon('plus', 18)} Registrar aporte</button>` : ''}
    </section>`;
  }).join('');

  return `
    <section class="card goals-summary">
      <div><small>Total guardado</small><strong>${money(totalSaved)}</strong><span>de ${money(totalTarget)}</span></div>
      <div><small>Objetivos alcançados</small><strong>${done}<span>/${goals.length}</span></strong></div>
      <div class="goals-summary-bar">${progressBar(totalTarget ? totalSaved / totalTarget : 0, 'var(--primary)')}</div>
    </section>
    <div class="goal-grid">${cards}</div>`;
}

function bindGoals(root, ctx) {
  const find = (id) => store.state.goals.find((g) => g.id === id);
  root.querySelectorAll('[data-new-goal]').forEach((b) => b.addEventListener('click', () => openGoalModal()));
  root.querySelectorAll('[data-edit-goal]').forEach((b) => b.addEventListener('click', () => {
    const g = find(b.dataset.editGoal);
    if (g) openGoalModal(g);
  }));
  root.querySelectorAll('[data-del-goal]').forEach((b) => b.addEventListener('click', async () => {
    const g = find(b.dataset.delGoal);
    if (!g) return;
    const ok = await confirmDialog({
      title: `Excluir “${g.name}”?`,
      message: 'Os aportes continuam registrados como transações, só deixam de contar para este objetivo.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    store.deleteGoal(g.id);
    toast('Objetivo excluído');
  }));
  root.querySelectorAll('[data-contribute]').forEach((b) => b.addEventListener('click', () => {
    const g = find(b.dataset.contribute);
    if (!g) return;
    openTransactionModal(null, {
      type: 'expense',
      categoryId: INVESTMENT_EXPENSE,
      goalId: g.id,
      description: `Aporte ${g.name}`,
      date: defaultDateFor(ctx.month),
    });
  }));
}
