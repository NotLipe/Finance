import { store, txInMonth, isFallback, getCategory, FALLBACK } from '../store.js';
import { icon } from '../icons.js';
import { pageHeader, monthStrip, categoryIcon, progressBar, toast } from '../components/ui.js';
import { openCategoryModal } from '../components/category-form.js';
import { confirmDialog } from '../components/modal.js';
import { money, monthName, monthLabel, escapeHtml } from '../utils.js';

export function render(root, ctx) {
  const { month } = ctx;
  const monthList = txInMonth(month);

  const column = (type, title) => {
    const cats = store.state.categories.filter((c) => c.type === type);
    const stats = new Map(cats.map((c) => [c.id, { value: 0, count: 0, total: 0 }]));
    for (const t of store.state.transactions) {
      if (t.type !== type) continue;
      const s = stats.get(getCategory(t.categoryId, type).id);
      if (s) s.total++;
    }
    for (const t of monthList) {
      if (t.type !== type) continue;
      const s = stats.get(getCategory(t.categoryId, type).id);
      if (s) { s.value += t.amount; s.count++; }
    }
    const monthTotal = [...stats.values()].reduce((a, s) => a + s.value, 0);
    const rows = [...cats].sort((a, b) => stats.get(b.id).value - stats.get(a.id).value || a.name.localeCompare(b.name));

    return `<section class="card">
      <div class="card-head">
        <div><h2>${title}</h2><p class="card-sub">${money(monthTotal)} em ${monthName(month)} · ${cats.length} categorias</p></div>
        <button type="button" class="btn btn-ghost sm" data-new-cat="${type}">${icon('plus', 16)} Nova</button>
      </div>
      <ul class="cat-manage">
        ${rows.map((c) => {
          const s = stats.get(c.id);
          return `<li class="row">
            ${categoryIcon(c)}
            <div class="row-main">
              <span class="top-line"><strong>${escapeHtml(c.name)}</strong><span>${money(s.value)}</span></span>
              ${progressBar(monthTotal ? s.value / monthTotal : 0, c.color)}
              <small>${s.count} no mês · ${s.total} no total${isFallback(c.id) ? ' · categoria padrão' : ''}</small>
            </div>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-edit-cat="${escapeHtml(c.id)}" aria-label="Editar ${escapeHtml(c.name)}" title="Editar">${icon('pencil', 18)}</button>
              ${isFallback(c.id) ? '' : `<button type="button" class="icon-btn danger" data-del-cat="${escapeHtml(c.id)}" aria-label="Excluir ${escapeHtml(c.name)}" title="Excluir">${icon('trash', 18)}</button>`}
            </div>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
  };

  root.innerHTML = `
    ${pageHeader({
      title: 'Organize suas <span class="ring">categorias</span>',
      subtitle: `Valores de ${monthLabel(month)}`,
      actions: `<button type="button" class="btn btn-primary" data-new-cat="expense">${icon('plus', 18)} Nova categoria</button>`,
    })}
    ${monthStrip(month)}
    <div class="cat-columns">
      ${column('expense', 'Despesas')}
      ${column('income', 'Receitas')}
    </div>`;

  root.querySelectorAll('[data-new-cat]').forEach((b) =>
    b.addEventListener('click', () => openCategoryModal(null, { type: b.dataset.newCat })));

  root.querySelectorAll('[data-edit-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      const cat = store.state.categories.find((c) => c.id === b.dataset.editCat);
      if (cat) openCategoryModal(cat);
    }));

  root.querySelectorAll('[data-del-cat]').forEach((b) =>
    b.addEventListener('click', async () => {
      const cat = store.state.categories.find((c) => c.id === b.dataset.delCat);
      if (!cat) return;
      const used = store.state.transactions.filter((t) => t.categoryId === cat.id).length;
      const fallbackName = getCategory(FALLBACK[cat.type], cat.type).name;
      const ok = await confirmDialog({
        title: `Excluir “${cat.name}”?`,
        message: used
          ? `${used} transação(ões) desta categoria serão movidas para “${escapeHtml(fallbackName)}”.`
          : 'Nenhuma transação usa esta categoria.',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (!ok) return;
      store.deleteCategory(cat.id);
      toast('Categoria excluída');
    }));
}
