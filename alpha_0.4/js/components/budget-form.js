import { store } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatAmountInput, parseAmount, money } from '../utils.js';
import { openModal } from './modal.js';
import { toast, categoryIcon } from './ui.js';

/** Campo de valor grande (R$), igual ao do formulário de transação. */
const amountField = (name, cents, label) => `
  <label class="amount-field">
    <span>R$</span>
    <input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="${label}"
      value="${cents ? formatAmountInput(cents) : ''}" autofocus>
  </label>`;

function readAmount(input) {
  const value = input.value.trim();
  if (!value) return 0;
  const cents = Math.abs(parseAmount(value));
  return Number.isFinite(cents) ? cents : NaN;
}

function formatOnBlur(input) {
  input.addEventListener('blur', () => {
    const cents = parseAmount(input.value);
    if (Number.isFinite(cents) && cents !== 0) input.value = formatAmountInput(Math.abs(cents));
  });
}

/** Limite mensal de uma categoria de despesa (e se ela é gasto fixo). */
export function openBudgetModal(category, { avg = 0 } = {}) {
  const current = store.state.budgets.byCategory[category.id] ?? 0;

  openModal({
    title: `Limite de ${category.name}`,
    size: 'sm',
    content: `
      <form class="form" novalidate>
        <div class="cat-preview">${categoryIcon(category, 22)}
          <div><strong>${escapeHtml(category.name)}</strong><small>Limite mensal de gasto</small></div></div>
        ${amountField('limit', current, 'Limite mensal')}
        ${avg ? `<div class="hint-row"><span>Média dos últimos meses: <strong>${money(avg)}</strong></span>
          <button type="button" class="link" data-use-avg>Usar média</button></div>` : ''}
        <label class="check-card">
          <input type="checkbox" name="fixed" ${category.fixed ? 'checked' : ''}>
          <span><strong>Gasto fixo</strong><small>Valor parecido todo mês (aluguel, assinaturas). A previsão usa a média, não o ritmo do mês.</small></span>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">
          ${current ? `<button type="button" class="btn btn-danger-ghost" data-remove>${icon('trash', 18)} Remover limite</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const input = form.elements.limit;
      const error = el.querySelector('.form-error');
      formatOnBlur(input);

      el.querySelector('[data-use-avg]')?.addEventListener('click', () => {
        input.value = formatAmountInput(Math.ceil(avg / 5000) * 5000);
      });

      el.querySelector('[data-remove]')?.addEventListener('click', () => {
        store.setCategoryBudget(category.id, 0, { fixed: form.elements.fixed.checked });
        toast('Limite removido');
        close();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cents = readAmount(input);
        if (!Number.isFinite(cents) || cents <= 0) {
          error.textContent = 'Informe um limite maior que zero.';
          error.hidden = false;
          return;
        }
        store.setCategoryBudget(category.id, cents, { fixed: form.elements.fixed.checked });
        toast('Limite salvo');
        close();
      });
    },
  });
}

/** Teto de gastos do mês inteiro. Vazio = usar a soma dos limites por categoria. */
export function openTotalBudgetModal(sumOfLimits) {
  const current = store.state.budgets.total;

  openModal({
    title: 'Teto mensal de gastos',
    size: 'sm',
    content: `
      <form class="form" novalidate>
        <p class="confirm-msg">Quanto você quer gastar, no máximo, no mês inteiro. Deixe em branco para usar a soma dos limites por categoria
        (${money(sumOfLimits)}).</p>
        ${amountField('total', current, 'Teto mensal')}
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">
          ${current ? `<button type="button" class="btn btn-danger-ghost" data-remove>${icon('trash', 18)} Usar a soma</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const input = form.elements.total;
      const error = el.querySelector('.form-error');
      formatOnBlur(input);

      el.querySelector('[data-remove]')?.addEventListener('click', () => {
        store.setTotalBudget(0);
        toast('Teto definido pela soma das categorias');
        close();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cents = readAmount(input);
        if (!Number.isFinite(cents)) {
          error.textContent = 'Valor inválido.';
          error.hidden = false;
          return;
        }
        store.setTotalBudget(cents);
        toast(cents ? 'Teto mensal salvo' : 'Teto definido pela soma das categorias');
        close();
      });
    },
  });
}
