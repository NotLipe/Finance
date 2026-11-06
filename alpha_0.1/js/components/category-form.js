import { store, categoriesOf } from '../store.js';
import { icon, CATEGORY_ICONS } from '../icons.js';
import { escapeHtml, normalize } from '../utils.js';
import { openModal } from './modal.js';
import { toast } from './ui.js';

export const CATEGORY_COLORS = [
  '#3fbf63', '#2fae5b', '#2bb5a8', '#1f9bd1', '#4b8ef0', '#5b5fe0',
  '#7c4ddb', '#c34fd6', '#e8608f', '#e5484d', '#f28c38', '#f2b631', '#8a8aa3',
];

/** Modal de criar/editar categoria. */
export function openCategoryModal(cat = null, defaults = {}) {
  const editing = Boolean(cat);
  const data = {
    name: cat?.name ?? '',
    type: cat?.type ?? defaults.type ?? 'expense',
    color: cat?.color ?? CATEGORY_COLORS[4],
    icon: cat?.icon ?? 'tag',
  };

  const content = `
    <form class="form" novalidate>
      <div class="cat-preview" data-preview></div>
      <div class="field-row">
        <div class="field">
          <label for="cat-name">Nome</label>
          <input class="input" id="cat-name" name="name" maxlength="40" placeholder="Ex.: Pets, Viagens" value="${escapeHtml(data.name)}" autofocus>
        </div>
        <div class="field">
          <span class="field-label">Tipo</span>
          <div class="segmented full" role="group" aria-label="Tipo">
            <button type="button" data-type="expense" ${editing ? 'disabled' : ''}>Despesa</button>
            <button type="button" data-type="income" ${editing ? 'disabled' : ''}>Receita</button>
          </div>
        </div>
      </div>
      <div class="field">
        <span class="field-label">Cor</span>
        <div class="swatches">
          ${CATEGORY_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="field-label">Ícone</span>
        <div class="icon-grid">
          ${CATEGORY_ICONS.map((n) => `<button type="button" class="icon-choice" data-icon="${n}" aria-label="${n}">${icon(n)}</button>`).join('')}
        </div>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
      </div>
    </form>`;

  openModal({
    title: editing ? 'Editar categoria' : 'Nova categoria',
    size: 'md',
    content,
    onMount(el, close) {
      const form = el.querySelector('form');
      const nameInput = form.elements.name;
      const error = el.querySelector('.form-error');

      function paint() {
        el.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === data.type));
        el.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('selected', b.dataset.color === data.color));
        el.querySelectorAll('[data-icon]').forEach((b) => {
          b.classList.toggle('selected', b.dataset.icon === data.icon);
          b.style.setProperty('--c', data.color);
        });
        el.querySelector('[data-preview]').innerHTML = `
          <span class="tx-icon lg" style="--c:${data.color}">${icon(data.icon, 26)}</span>
          <div><strong>${escapeHtml(nameInput.value.trim() || 'Nome da categoria')}</strong>
          <small>${data.type === 'income' ? 'Receita' : 'Despesa'}</small></div>`;
      }

      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-type],[data-color],[data-icon]');
        if (!t || t.disabled) return;
        if (t.dataset.type) data.type = t.dataset.type;
        if (t.dataset.color) data.color = t.dataset.color;
        if (t.dataset.icon) data.icon = t.dataset.icon;
        paint();
      });
      nameInput.addEventListener('input', paint);

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const fail = (msg) => { error.textContent = msg; error.hidden = false; };
        if (!name) return fail('Dê um nome para a categoria.');
        const duplicate = categoriesOf(data.type).some((c) => c.id !== cat?.id && normalize(c.name) === normalize(name));
        if (duplicate) return fail('Já existe uma categoria com esse nome.');

        if (editing) store.updateCategory(cat.id, { name, color: data.color, icon: data.icon });
        else store.addCategory({ name, type: data.type, color: data.color, icon: data.icon });
        toast(editing ? 'Categoria atualizada' : 'Categoria criada');
        close();
      });

      paint();
    },
  });
}
