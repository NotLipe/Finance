// Cálculos de Metas: orçamento (ritmo e previsão de fechamento), projeção de meses futuros e objetivos.
// Só leitura: nada aqui altera dados, tudo é derivado do store.

import { store, txInMonth, totals, getCategory, categoriesOf } from './store.js';
import { currentMonth, addMonths, todayISO, toISO } from './utils.js';

export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** Diferença em meses entre duas chaves "YYYY-MM" (b - a). */
export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

const sum = (list, fn = (x) => x) => list.reduce((a, x) => a + fn(x), 0);

/** Em que ponto do mês estamos: passado, atual (com fração decorrida) ou futuro. */
export function monthProgress(month) {
  const cur = currentMonth();
  const dim = daysInMonth(month);
  if (month < cur) return { state: 'past', fraction: 1, daysElapsed: dim, daysInMonth: dim };
  if (month > cur) return { state: 'future', fraction: 0, daysElapsed: 0, daysInMonth: dim };
  const day = Number(todayISO().slice(8, 10));
  return { state: 'current', fraction: day / dim, daysElapsed: day, daysInMonth: dim };
}

/**
 * Média mensal de despesas por categoria nos 3 meses anteriores a `month`.
 * Só conta meses que têm algum registro, para não puxar a média para baixo quando o uso é recente.
 */
export function categoryAverages(month) {
  const withData = new Set(store.state.transactions.map((t) => t.date.slice(0, 7)));
  const months = [1, 2, 3].map((n) => addMonths(month, -n)).filter((k) => withData.has(k));
  const averages = {};
  if (!months.length) return { averages, months: 0 };
  for (const t of store.state.transactions) {
    if (t.type !== 'expense' || !months.includes(t.date.slice(0, 7))) continue;
    const id = getCategory(t.categoryId, 'expense').id;
    averages[id] = (averages[id] ?? 0) + t.amount;
  }
  for (const id of Object.keys(averages)) averages[id] = Math.round(averages[id] / months.length);
  return { averages, months: months.length };
}

/** Limites sugeridos: média recente arredondada para cima em múltiplos de R$ 50. */
export function suggestedLimits(month = currentMonth()) {
  const { averages } = categoryAverages(month);
  const out = {};
  for (const [id, avg] of Object.entries(averages)) if (avg > 0) out[id] = Math.ceil(avg / 5000) * 5000;
  return out;
}

/**
 * Previsão de quanto a categoria vai fechar no mês.
 * - Gasto fixo: o maior entre o já gasto e a média (a conta pode ainda não ter chegado).
 * - Variável: no começo do mês pesa mais o histórico; conforme o mês avança, pesa mais o ritmo atual.
 */
function projectSpend(spent, avg, fixed, prog) {
  if (prog.state === 'past') return spent;
  if (prog.state === 'future') return avg;
  if (fixed) return Math.max(spent, avg);
  const pace = (spent / prog.daysElapsed) * prog.daysInMonth;
  const w = prog.fraction;
  return Math.round(w * pace + (1 - w) * Math.max(spent, avg));
}

function statusOf(spent, projected, limit, prog) {
  if (!limit) return 'none';
  if (spent > limit) return 'over';
  if (spent >= 0.8 * limit || (prog.state === 'current' && projected > limit)) return 'warn';
  return 'ok';
}

/** Situação do orçamento no mês: por categoria e no total. */
export function budgetOverview(month) {
  const prog = monthProgress(month);
  const { averages } = categoryAverages(month);
  const limits = store.state.budgets.byCategory;

  const spentBy = {};
  for (const t of txInMonth(month)) {
    if (t.type !== 'expense') continue;
    const id = getCategory(t.categoryId, 'expense').id;
    spentBy[id] = (spentBy[id] ?? 0) + t.amount;
  }

  const rows = categoriesOf('expense').map((category) => {
    const spent = spentBy[category.id] ?? 0;
    const avg = averages[category.id] ?? 0;
    const limit = limits[category.id] ?? 0;
    const projected = projectSpend(spent, avg, category.fixed, prog);
    return { category, spent, avg, limit, projected, status: statusOf(spent, projected, limit, prog) };
  });

  const withLimit = rows.filter((r) => r.limit);
  const sumOfLimits = sum(withLimit, (r) => r.limit);
  const limitIsTotal = Boolean(store.state.budgets.total);
  const limit = store.state.budgets.total || sumOfLimits;
  // Com teto mensal, conta todo gasto do mês. Sem teto, compara só as categorias que têm limite.
  const counted = limitIsTotal ? rows : withLimit;
  const spent = sum(counted, (r) => r.spent);
  const projected = sum(counted, (r) => r.projected);

  return {
    prog,
    rows,
    spent,
    projected,
    totalSpent: sum(rows, (r) => r.spent),
    limit,
    sumOfLimits,
    limitIsTotal,
    status: statusOf(spent, projected, limit, prog),
    counts: {
      ok: withLimit.filter((r) => r.status === 'ok').length,
      warn: withLimit.filter((r) => r.status === 'warn').length,
      over: withLimit.filter((r) => r.status === 'over').length,
    },
  };
}

/**
 * Projeção do mês atual + `ahead` meses, em dois cenários:
 * - plan: gastando o que as metas permitem (teto total, ou limites por categoria + média nas sem limite)
 * - trend: continuando como está (média recente de gastos)
 */
export function projection(ahead = 6) {
  const start = currentMonth();
  const income = store.state.settings.monthlyIncome;
  const { averages, months: historyMonths } = categoryAverages(start);
  const limits = store.state.budgets.byCategory;
  const expenseCats = categoriesOf('expense');

  const planned = store.state.budgets.total || sum(expenseCats, (c) => limits[c.id] ?? averages[c.id] ?? 0);
  const trend = sum(Object.values(averages));

  const now = budgetOverview(start);
  const currentIncome = Math.max(totals(txInMonth(start)).income, income);

  const rows = [];
  let accPlan = 0;
  let accTrend = 0;
  for (let i = 0; i <= ahead; i++) {
    const key = addMonths(start, i);
    const monthIncome = i === 0 ? currentIncome : income;
    const allProjected = sum(now.rows, (r) => r.projected);
    const planExpense = i === 0 ? Math.max(now.totalSpent, planned) : planned;
    const trendExpense = i === 0 ? Math.max(now.totalSpent, allProjected) : trend;
    accPlan += monthIncome - planExpense;
    accTrend += monthIncome - trendExpense;
    rows.push({ key, income: monthIncome, planExpense, trendExpense, accPlan, accTrend });
  }
  return { rows, income, planned, trend, historyMonths };
}

/* ---------- Objetivos ---------- */

export function goalContributions(goalId) {
  return store.state.transactions.filter((t) => t.goalId === goalId && t.type === 'expense');
}

/**
 * Situação de um objetivo: quanto já foi guardado, quanto falta por mês até o prazo
 * e, no ritmo dos aportes recentes, quando ele deve ser alcançado.
 */
export function goalStatus(goal) {
  const cur = currentMonth();
  const contributions = goalContributions(goal.id);
  const saved = goal.initial + sum(contributions, (t) => t.amount);
  const remaining = Math.max(0, goal.target - saved);
  const pct = Math.min(1, saved / goal.target);

  const monthsLeft = goal.deadline ? monthsBetween(cur, goal.deadline) + 1 : null; // inclui o mês atual
  const neededPerMonth = monthsLeft !== null && monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : null;

  // Ritmo: média mensal dos aportes nos últimos 3 meses (ou desde o início, se o objetivo for mais novo).
  const startMonth = [toISO(new Date(goal.createdAt)).slice(0, 7), ...contributions.map((t) => t.date.slice(0, 7))].sort()[0];
  const window = Math.max(1, Math.min(3, monthsBetween(startMonth, cur) + 1));
  const since = addMonths(cur, -(window - 1));
  const pace = Math.round(sum(contributions.filter((t) => t.date.slice(0, 7) >= since && t.date.slice(0, 7) <= cur), (t) => t.amount) / window);

  let eta = null;
  let status;
  if (remaining === 0) status = 'done';
  else if (pace > 0) {
    eta = addMonths(cur, Math.ceil(remaining / pace));
    if (!goal.deadline) status = 'no-deadline';
    else status = eta <= goal.deadline ? 'on-track' : 'late';
  } else status = 'no-pace';
  if (status !== 'done' && goal.deadline && goal.deadline < cur) status = 'expired';

  return { saved, remaining, pct, monthsLeft, neededPerMonth, pace, eta, status, lateBy: eta && goal.deadline ? monthsBetween(goal.deadline, eta) : 0 };
}
