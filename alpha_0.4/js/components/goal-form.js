import { store } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatAmountInput, parseAmount, currentMonth, addMonths } from '../utils.js';
import { openModal } from './modal.js';
import { toast } from './ui.js';
import { CATEGORY_COLORS } from './category-form.js';

const GOAL_ICONS = ['target', 'plane', 'car', 'home', 'graduation', 'piggy', 'gift', 'laptop', 'phone', 'heart', 'baby', 'paw', 'briefcase', 'wallet', 'sparkles'];

/** Modal de criar/editar objetivo de economia. */
export function openGoalModal(goal = null) {
  const editing = Boolean(goal);
  const data = { color: goal?.color ?? '#1f9bd1', icon: goal?.icon ?? 'target' };

  const amount = (name, cents, label, extra = '') => `
    <div class="field">
      <label for="goal-${name}">${label}</label>
      <label class="amount-field sm"><span>R$</span>
        <input id="goal-${name}" name="${name}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${cents ? formatAmountInput(cents) : ''}" ${extra}>
      </label>
    </div>`;

  openModal({
    title: editing ? 'Editar objetivo' : 'Novo objetivo',
    size: 'lg',
    content: `
      <form class="form" novalidate>
        <div class="form-cols">
          <div class="form">
            <div class="field">
              <label for="goal-name">Nome</label>
              <input class="input" id="goal-name" name="name" maxlength="40" placeholder="Ex.: Viagem, Reserva de emergência, Carro"
                value="${escapeHtml(goal?.name ?? '')}" autofocus>
            </div>
            ${amount('target', goal?.target, 'Quanto você quer juntar')}
            ${amount('initial', goal?.initial, 'Quanto já tem guardado <span class="opt">(opcional)</span>')}
            <div class="field">
              <label for="goal-deadline">Prazo <span class="opt">(opcional)</span></label>
              <input class="input" type="month" id="goal-deadline" name="deadline" min="${currentMonth()}"
                value="${escapeHtml(editing ? goal.deadline ?? '' : addMonths(currentMonth(), 12))}">
            </div>
          </div>
          <div class="form">
            <div class="cat-preview" data-preview></div>
            <div class="field">
              <span class="field-label">Cor</span>
              <div class="swatches">
                ${CATEGORY_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join('')}
              </div>
            </div>
            <div class="field">
              <span class="field-label">Ícone</span>
              <div class="icon-grid">
                ${GOAL_ICONS.map((n) => `<button type="button" class="icon-choice" data-icon="${n}" aria-label="${n}">${icon(n)}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const f = form.elements;
      const error = el.querySelector('.form-error');

      function paint() {
        el.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('selected', b.dataset.color === data.color));
        el.querySelectorAll('[data-icon]').forEach((b) => {
          b.classList.toggle('selected', b.dataset.icon === data.icon);
          b.style.setProperty('--c', data.color);
        });
        el.querySelector('[data-preview]').innerHTML = `
          <span class="tx-icon lg" style="--c:${data.color}">${icon(data.icon, 26)}</span>
          <div><strong>${escapeHtml(f.name.value.trim() || 'Nome do objetivo')}</strong><small>Objetivo de economia</small></div>`;
      }

      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-color],[data-icon]');
        if (!t) return;
        if (t.dataset.color) data.color = t.dataset.color;
        if (t.dataset.icon) data.icon = t.dataset.icon;
        paint();
      });
      f.name.addEventListener('input', paint);
      for (const input of [f.target, f.initial]) {
        input.addEventListener('blur', () => {
          const c = parseAmount(input.value);
          if (Number.isFinite(c) && c !== 0) input.value = formatAmountInput(Math.abs(c));
        });
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fail = (msg) => { error.textContent = msg; error.hidden = false; };
        const name = f.name.value.trim();
        const target = Math.abs(parseAmount(f.target.value));
        const initial = f.initial.value.trim() ? Math.abs(parseAmount(f.initial.value)) : 0;
        const deadline = f.deadline.value || null;
        if (!name) return fail('Dê um nome para o objetivo.');
        if (!Number.isFinite(target) || target <= 0) return fail('Informe quanto você quer juntar.');
        if (!Number.isFinite(initial)) return fail('Valor guardado inválido.');
        if (deadline && !/^\d{4}-\d{2}$/.test(deadline)) return fail('Prazo inválido.');

        const payload = { name, target, initial, deadline, color: data.color, icon: data.icon };
        if (editing) store.updateGoal(goal.id, payload);
        else store.addGoal(payload);
        toast(editing ? 'Objetivo atualizado' : 'Objetivo criado');
        close();
      });

      paint();
    },
  });
}
