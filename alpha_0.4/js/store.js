// Camada de dados. TODA leitura/escrita passa por aqui.
// Hoje persiste no localStorage; no futuro basta trocar load()/persist() por uma API ou banco local
// (ex.: SQLite no desktop/mobile) sem mexer nas telas.

import { uid, isValidISO, todayISO, addMonths, currentMonth } from './utils.js';
import { hasIcon } from './icons.js';

// Mesma chave da alpha 0.1, para que os dados já salvos continuem aparecendo nesta versão.
const STORAGE_KEY = 'finance:alpha-0.1';
const DATA_VERSION = 3;

/** Categoria usada quando uma categoria é excluída (as transações são movidas para ela). */
export const FALLBACK = { expense: 'cat-outros', income: 'cat-outras-receitas' };
export const isFallback = (id) => Object.values(FALLBACK).includes(id);

/** Categoria de despesa usada para aportes; transações nela podem ser destinadas a um objetivo. */
export const INVESTMENT_EXPENSE = 'cat-investimentos-despesa';

export const DEFAULT_CATEGORIES = [
  { id: 'cat-mercado', name: 'Mercado', type: 'expense', color: '#3fbf63', icon: 'cart' },
  { id: 'cat-moradia', name: 'Moradia', type: 'expense', color: '#4b8ef0', icon: 'home', fixed: true },
  { id: 'cat-restaurantes', name: 'Restaurantes', type: 'expense', color: '#e8608f', icon: 'utensils' },
  { id: 'cat-transporte', name: 'Transporte', type: 'expense', color: '#f28c38', icon: 'car' },
  { id: 'cat-educacao', name: 'Educação', type: 'expense', color: '#7c4ddb', icon: 'graduation', fixed: true },
  { id: 'cat-saude', name: 'Saúde', type: 'expense', color: '#e5484d', icon: 'heart' },
  { id: 'cat-lazer', name: 'Lazer', type: 'expense', color: '#f2b631', icon: 'film' },
  { id: 'cat-assinaturas', name: 'Assinaturas', type: 'expense', color: '#2bb5a8', icon: 'tv', fixed: true },
  { id: 'cat-compras', name: 'Compras', type: 'expense', color: '#c34fd6', icon: 'bag' },
  { id: 'cat-cartao', name: 'Cartão de crédito', type: 'expense', color: '#5b5fe0', icon: 'card', fixed: true },
  { id: 'cat-investimentos-despesa', name: 'Investimentos', type: 'expense', color: '#1f9bd1', icon: 'piggy', fixed: true },
  { id: 'cat-outros', name: 'Outros', type: 'expense', color: '#8a8aa3', icon: 'dots' },
  { id: 'cat-salario', name: 'Salário', type: 'income', color: '#2fae5b', icon: 'briefcase' },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', color: '#5b5fe0', icon: 'laptop' },
  { id: 'cat-investimentos', name: 'Investimentos', type: 'income', color: '#1f9bd1', icon: 'trending-up' },
  { id: 'cat-outras-receitas', name: 'Outras receitas', type: 'income', color: '#8a8aa3', icon: 'plus' },
];

/* ---------- Validação / saneamento (protege contra dados corrompidos ou backups adulterados) ---------- */

function sanitizeCategory(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  return {
    id: c.id.slice(0, 64),
    name: c.name.trim().slice(0, 40) || 'Sem nome',
    type: c.type === 'income' ? 'income' : 'expense',
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8a8aa3',
    icon: typeof c.icon === 'string' && hasIcon(c.icon) ? c.icon : 'tag',
    // Gasto fixo: não é projetado pelo ritmo do mês (ex.: aluguel, assinaturas).
    fixed: c.type !== 'income' && Boolean(c.fixed),
  };
}

function sanitizeTransaction(t) {
  if (!t) return null;
  const amount = Math.round(Number(t.amount));
  if (!Number.isFinite(amount) || amount <= 0 || !isValidISO(t.date)) return null;
  return {
    id: typeof t.id === 'string' && t.id ? t.id.slice(0, 64) : uid(),
    type: t.type === 'income' ? 'income' : 'expense',
    amount, // centavos
    description: String(t.description ?? '').trim().slice(0, 120) || 'Sem descrição',
    categoryId: typeof t.categoryId === 'string' ? t.categoryId : null,
    date: t.date,
    notes: String(t.notes ?? '').slice(0, 500),
    goalId: typeof t.goalId === 'string' && t.goalId ? t.goalId.slice(0, 64) : null,
    createdAt: Number(t.createdAt) || Date.now(),
  };
}

function ensureFallbacks(categories) {
  for (const def of DEFAULT_CATEGORIES) {
    if (isFallback(def.id) && !categories.some((c) => c.id === def.id)) categories.push({ ...def });
  }
  return categories;
}

// Categorias padrão que entraram na versão 2 dos dados (alpha 0.2).
const ADDED_IN_V2 = ['cat-cartao', 'cat-investimentos-despesa'];

/** Atualiza dados de versões anteriores: adiciona as categorias novas uma única vez. */
function migrate(categories, version) {
  if (version < 2) {
    for (const id of ADDED_IN_V2) {
      const def = DEFAULT_CATEGORIES.find((c) => c.id === id);
      if (!categories.some((c) => c.id === id)) categories.push({ ...def });
    }
  }
  if (version < 3) {
    // alpha 0.4: marca como "gasto fixo" as categorias padrão que costumam ter valor fixo no mês.
    for (const c of categories) {
      const def = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
      if (def?.fixed) c.fixed = true;
    }
  }
  return categories;
}

const cents = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function sanitizeBudgets(b, categories) {
  const byCategory = {};
  const source = b && typeof b.byCategory === 'object' && b.byCategory ? b.byCategory : {};
  for (const [id, value] of Object.entries(source)) {
    if (cents(value) && categories.some((c) => c.id === id && c.type === 'expense')) byCategory[id] = cents(value);
  }
  return { total: cents(b?.total), byCategory };
}

function sanitizeGoal(g) {
  if (!g || typeof g.name !== 'string' || !cents(g.target)) return null;
  return {
    id: typeof g.id === 'string' && g.id ? g.id.slice(0, 64) : uid(),
    name: g.name.trim().slice(0, 40) || 'Objetivo',
    target: cents(g.target),
    initial: cents(g.initial), // valor que já estava guardado ao criar o objetivo
    deadline: typeof g.deadline === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(g.deadline) ? g.deadline : null,
    color: /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : '#1f9bd1',
    icon: typeof g.icon === 'string' && hasIcon(g.icon) ? g.icon : 'target',
    createdAt: Number(g.createdAt) || Date.now(),
  };
}

function sanitizeState(data) {
  const version = Number(data?.version) || 1;
  const categories = migrate(
    ensureFallbacks((Array.isArray(data?.categories) ? data.categories : []).map(sanitizeCategory).filter(Boolean)),
    version,
  );
  const goals = (Array.isArray(data?.goals) ? data.goals : []).map(sanitizeGoal).filter(Boolean);
  const transactions = (Array.isArray(data?.transactions) ? data.transactions : [])
    .map(sanitizeTransaction)
    .filter(Boolean)
    .map((t) => (t.goalId && !goals.some((g) => g.id === t.goalId) ? { ...t, goalId: null } : t));
  return {
    version: DATA_VERSION,
    categories,
    transactions,
    budgets: sanitizeBudgets(data?.budgets, categories),
    goals,
    settings: { monthlyIncome: cents(data?.settings?.monthlyIncome) },
  };
}

const fresh = () => ({
  version: DATA_VERSION,
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  transactions: [],
  budgets: { total: 0, byCategory: {} },
  goals: [],
  settings: { monthlyIncome: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = sanitizeState(parsed);
      // Dados de uma versão anterior: grava já migrado para não repetir a migração.
      if (Number(parsed?.version) !== DATA_VERSION) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.error('Falha ao ler dados salvos', err);
  }
  return fresh();
}

/* ---------- Estado e assinaturas ---------- */

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Falha ao salvar dados', err);
  }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get state() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /* Transações */
  addTransaction(data) {
    const t = sanitizeTransaction({ ...data, id: uid(), createdAt: Date.now() });
    if (!t) throw new Error('Transação inválida');
    state.transactions.push(t);
    persist();
    return t;
  },

  addTransactions(list) {
    const now = Date.now();
    const clean = list.map((t, i) => sanitizeTransaction({ ...t, id: uid(), createdAt: now + i })).filter(Boolean);
    state.transactions.push(...clean);
    persist();
    return clean.length;
  },

  updateTransaction(id, patch) {
    const i = state.transactions.findIndex((t) => t.id === id);
    if (i < 0) return;
    const t = sanitizeTransaction({ ...state.transactions[i], ...patch, id });
    if (!t) throw new Error('Transação inválida');
    state.transactions[i] = t;
    persist();
  },

  deleteTransaction(id) {
    state.transactions = state.transactions.filter((t) => t.id !== id);
    persist();
  },

  /* Categorias */
  addCategory(data) {
    const c = sanitizeCategory({ ...data, id: uid() });
    state.categories.push(c);
    persist();
    return c;
  },

  /** O tipo (despesa/receita) não muda na edição, para não quebrar as transações já associadas. */
  updateCategory(id, patch) {
    const i = state.categories.findIndex((c) => c.id === id);
    if (i < 0) return;
    const current = state.categories[i];
    state.categories[i] = sanitizeCategory({ ...current, ...patch, id, type: current.type });
    persist();
  },

  /** Exclui a categoria e move as transações dela para a categoria "Outros" do mesmo tipo. */
  deleteCategory(id) {
    const cat = state.categories.find((c) => c.id === id);
    if (!cat || isFallback(id)) return 0;
    let moved = 0;
    for (const t of state.transactions) {
      if (t.categoryId === id) { t.categoryId = FALLBACK[cat.type]; moved++; }
    }
    state.categories = state.categories.filter((c) => c.id !== id);
    delete state.budgets.byCategory[id];
    persist();
    return moved;
  },

  /* Dados em massa */
  replaceAll(data) {
    state = sanitizeState(data);
    persist();
  },

  /** Substitui as transações por dados fictícios e, se ainda não houver, preenche renda, objetivos e limites de exemplo. */
  loadSample() {
    for (const def of DEFAULT_CATEGORIES) {
      if (!state.categories.some((c) => c.id === def.id)) state.categories.push({ ...def });
    }
    state.transactions = buildSample();
    // Renda de exemplo ≈ média das receitas fictícias (salário + freelas).
    if (!state.settings.monthlyIncome) state.settings.monthlyIncome = 740000;
    if (!state.goals.length) {
      const goals = sampleGoals();
      state.goals = goals;
      state.transactions.push(...sampleContributions(goals));
    }
    if (!Object.keys(state.budgets.byCategory).length) state.budgets.byCategory = sampleBudgets(state.transactions);
    persist();
  },

  /* Metas: renda, orçamento e objetivos */
  setMonthlyIncome(value) {
    state.settings.monthlyIncome = cents(value);
    persist();
  },

  setTotalBudget(value) {
    state.budgets.total = cents(value);
    persist();
  },

  /** Define (ou remove, com 0) o limite mensal de uma categoria de despesa. */
  setCategoryBudget(id, value, { fixed } = {}) {
    const cat = state.categories.find((c) => c.id === id && c.type === 'expense');
    if (!cat) return;
    if (cents(value)) state.budgets.byCategory[id] = cents(value);
    else delete state.budgets.byCategory[id];
    if (typeof fixed === 'boolean') cat.fixed = fixed;
    persist();
  },

  /** Aplica vários limites de uma vez: { categoryId: centavos }. */
  setCategoryBudgets(map) {
    for (const [id, value] of Object.entries(map)) {
      if (cents(value) && state.categories.some((c) => c.id === id && c.type === 'expense')) state.budgets.byCategory[id] = cents(value);
    }
    persist();
  },

  addGoal(data) {
    const g = sanitizeGoal({ ...data, id: uid(), createdAt: Date.now() });
    if (!g) throw new Error('Objetivo inválido');
    state.goals.push(g);
    persist();
    return g;
  },

  updateGoal(id, patch) {
    const i = state.goals.findIndex((g) => g.id === id);
    if (i < 0) return;
    const g = sanitizeGoal({ ...state.goals[i], ...patch, id });
    if (!g) throw new Error('Objetivo inválido');
    state.goals[i] = g;
    persist();
  },

  /** Exclui o objetivo. Os aportes continuam como transações, só deixam de apontar para ele. */
  deleteGoal(id) {
    state.goals = state.goals.filter((g) => g.id !== id);
    for (const t of state.transactions) if (t.goalId === id) t.goalId = null;
    persist();
  },

  reset() {
    state = fresh();
    persist();
  },

  exportData() {
    return { app: 'finance', exportedAt: new Date().toISOString(), ...state };
  },
};

/* ---------- Consultas (selectors) ---------- */

export function getCategory(id, type = 'expense') {
  return (
    state.categories.find((c) => c.id === id) ??
    state.categories.find((c) => c.id === FALLBACK[type]) ?? { id: '', name: 'Sem categoria', type, color: '#8a8aa3', icon: 'dots' }
  );
}

export const categoriesOf = (type) => state.categories.filter((c) => c.type === type);

export const txInMonth = (month, list = state.transactions) => list.filter((t) => t.date.startsWith(month));

export function totals(list) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Agrupa por categoria: [{ category, value, count, pct }] em ordem decrescente. */
export function byCategory(list, type) {
  const map = new Map();
  for (const t of list) {
    if (t.type !== type) continue;
    const key = getCategory(t.categoryId, type).id;
    const cur = map.get(key) ?? { value: 0, count: 0 };
    cur.value += t.amount;
    cur.count++;
    map.set(key, cur);
  }
  const total = [...map.values()].reduce((a, b) => a + b.value, 0);
  return [...map]
    .map(([id, { value, count }]) => ({ category: getCategory(id, type), value, count, pct: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export const sortByDateDesc = (list) =>
  [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

/* ---------- Dados de exemplo (determinísticos) ---------- */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGoals() {
  const now = Date.now();
  return [
    { id: uid(), name: 'Viagem de férias', target: 1000000, initial: 150000, deadline: addMonths(currentMonth(), 8), color: '#1f9bd1', icon: 'plane', createdAt: now },
    { id: uid(), name: 'Reserva de emergência', target: 2000000, initial: 600000, deadline: addMonths(currentMonth(), 18), color: '#2fae5b', icon: 'piggy', createdAt: now + 1 },
  ];
}

/** Aportes mensais de exemplo (categoria Investimentos de despesa) destinados aos objetivos. */
function sampleContributions([trip, reserve]) {
  const today = todayISO();
  const out = [];
  for (let i = 3; i >= 0; i--) {
    const date = `${addMonths(currentMonth(), -i)}-06`;
    if (date > today) continue;
    out.push(
      { id: uid(), type: 'expense', categoryId: INVESTMENT_EXPENSE, description: 'Aporte viagem', amount: 80000, date, notes: '', goalId: trip.id, createdAt: Date.now() + i },
      { id: uid(), type: 'expense', categoryId: INVESTMENT_EXPENSE, description: 'Aporte reserva', amount: 50000, date, notes: '', goalId: reserve.id, createdAt: Date.now() + 10 + i },
    );
  }
  return out;
}

/** Limites de exemplo: 10% abaixo da média dos 3 meses anteriores de cada categoria variável (múltiplos de R$ 50). */
function sampleBudgets(transactions) {
  const months = [1, 2, 3].map((n) => addMonths(currentMonth(), -n));
  const sums = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || !months.includes(t.date.slice(0, 7))) continue;
    sums[t.categoryId] = (sums[t.categoryId] ?? 0) + t.amount;
  }
  const out = {};
  for (const [id, total] of Object.entries(sums)) {
    const cat = state.categories.find((c) => c.id === id);
    if (cat && !cat.fixed) out[id] = Math.max(5000, Math.round((total / 3) * 0.9 / 5000) * 5000);
  }
  return out;
}

function buildSample() {
  const rnd = mulberry32(42);
  const between = (min, max) => Math.round((min + rnd() * (max - min)) * 100);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const day = () => 1 + Math.floor(rnd() * 28);
  const today = todayISO();
  const out = [];

  const add = (month, d, type, categoryId, description, amount) => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const date = `${month}-${String(Math.min(d, last)).padStart(2, '0')}`;
    if (date > today) return;
    out.push({ id: uid(), type, categoryId, description, amount, date, notes: '', createdAt: Date.now() + out.length });
  };

  for (let i = 5; i >= 0; i--) {
    const mo = addMonths(currentMonth(), -i);
    add(mo, 5, 'income', 'cat-salario', 'Salário', 650000);
    if (rnd() < 0.6) add(mo, 8 + Math.floor(rnd() * 15), 'income', 'cat-freelance', pick(['Projeto landing page', 'Manutenção de site', 'Consultoria front-end']), between(800, 2200));
    if (rnd() < 0.5) add(mo, 20, 'income', 'cat-investimentos', 'Rendimento CDB', between(40, 120));

    add(mo, 10, 'expense', 'cat-moradia', 'Aluguel', 180000);
    add(mo, 12, 'expense', 'cat-moradia', 'Conta de luz', between(140, 230));
    add(mo, 15, 'expense', 'cat-moradia', 'Internet', 11990);
    add(mo, 7, 'expense', 'cat-assinaturas', 'Netflix', 5590);
    add(mo, 9, 'expense', 'cat-assinaturas', 'Spotify', 2190);
    add(mo, 14, 'expense', 'cat-assinaturas', 'YouTube Premium', 2690);
    add(mo, 3, 'expense', 'cat-educacao', 'Curso de inglês', 29700);

    for (let w = 0; w < 4; w++) add(mo, 2 + w * 7 + Math.floor(rnd() * 3), 'expense', 'cat-mercado', pick(['Supermercado', 'Feira', 'Atacadão', 'Hortifruti']), between(90, 420));
    for (let k = 0; k < 5; k++) add(mo, day(), 'expense', 'cat-restaurantes', pick(['iFood', 'Restaurante', 'Padaria', 'Pizzaria', 'Café']), between(25, 140));
    for (let k = 0; k < 7; k++) add(mo, day(), 'expense', 'cat-transporte', pick(['Uber', '99', 'Combustível', 'Estacionamento']), between(15, 160));
    if (rnd() < 0.7) add(mo, day(), 'expense', 'cat-saude', pick(['Farmácia', 'Consulta médica', 'Exames']), between(60, 280));
    for (let k = 0; k < 2; k++) add(mo, day(), 'expense', 'cat-lazer', pick(['Cinema', 'Show', 'Bar com amigos', 'Passeio']), between(40, 220));
    if (rnd() < 0.5) add(mo, day(), 'expense', 'cat-compras', pick(['Roupas', 'Eletrônicos', 'Presente']), between(80, 600));
  }
  return out;
}
