import { store, getCategory, categoriesOf } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatAmountInput, parseAmount, todayISO, isValidISO } from '../utils.js';
import { openModal, confirmDialog } from './modal.js';
import { toast } from './ui.js';
import { openCategoryModal } from './category-form.js';

/** Modal de criar/editar transação. `tx` nulo = nova transação. */
export function openTransactionModal(tx = null, defaults = {}) {
  const editing = Boolean(tx);
  let type = tx?.type ?? defaults.type ?? 'expense';
  let categoryId = tx?.categoryId ?? null;

  const content = `
    <form class="form" novalidate>
      <div class="form-cols">
        <div class="form">
          <div class="segmented full" role="group" aria-label="Tipo">
            <button type="button" data-type="expense">${icon('trending-down', 16)} Despesa</button>
            <button type="button" data-type="income">${icon('trending-up', 16)} Receita</button>
          </div>
          <label class="amount-field">
            <span>R$</span>
            <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="Valor"
              value="${tx ? formatAmountInput(tx.amount) : ''}" autofocus>
          </label>
          <div class="field">
            <label for="tx-desc">Descrição</label>
            <input class="input" id="tx-desc" name="description" maxlength="120" placeholder="Ex.: Supermercado, Uber, Salário"
              value="${escapeHtml(tx?.description ?? '')}">
          </div>
          <div class="field">
            <label for="tx-date">Data</label>
            <input class="input" type="date" id="tx-date" name="date" value="${escapeHtml(tx?.date ?? defaults.date ?? todayISO())}">
          </div>
          <div class="field">
            <label for="tx-notes">Observação <span class="opt">(opcional)</span></label>
            <textarea class="input" id="tx-notes" name="notes" rows="2" maxlength="500">${escapeHtml(tx?.notes ?? '')}</textarea>
          </div>
        </div>
        <div class="field">
          <span class="field-label">Categoria</span>
          <div class="cat-picker" data-cat-picker></div>
        </div>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">
        ${editing ? `<button type="button" class="btn btn-danger-ghost" data-delete>${icon('trash', 18)} Excluir</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${icon('check', 18)} Salvar</button>
      </div>
    </form>`;

  openModal({
    title: editing ? 'Editar transação' : 'Nova transação',
    size: 'lg',
    content,
    onMount(el, close) {
      const form = el.querySelector('form');
      const f = form.elements;
      const picker = el.querySelector('[data-cat-picker]');
      const error = el.querySelector('.form-error');

      function paint() {
        el.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
        const cats = categoriesOf(type);
        if (!cats.some((c) => c.id === categoryId)) categoryId = null;
        picker.innerHTML = cats
          .map((c) => `<button type="button" class="cat-option${c.id === categoryId ? ' selected' : ''}" data-cat="${escapeHtml(c.id)}" style="--c:${escapeHtml(c.color)}">
              <span class="tx-icon">${icon(c.icon, 18)}</span><span>${escapeHtml(c.name)}</span></button>`)
          .join('')
          + `<button type="button" class="cat-option cat-add" data-add-cat>
              <span class="tx-icon">${icon('plus', 18)}</span><span>Nova categoria</span></button>`;
      }

      el.querySelectorAll('[data-type]').forEach((b) =>
        b.addEventListener('click', () => { type = b.dataset.type; paint(); }));

      picker.addEventListener('click', (e) => {
        // "+ Nova categoria": cria a categoria (já no tipo atual) e a deixa selecionada.
        if (e.target.closest('[data-add-cat]')) {
          openCategoryModal(null, {
            type,
            onSaved: (cat) => { categoryId = cat.id; error.hidden = true; paint(); },
          });
          return;
        }
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        categoryId = b.dataset.cat;
        picker.querySelectorAll('.cat-option').forEach((o) => o.classList.toggle('selected', o === b));
        error.hidden = true;
      });

      f.amount.addEventListener('blur', () => {
        const cents = parseAmount(f.amount.value);
        if (Number.isFinite(cents) && cents !== 0) f.amount.value = formatAmountInput(Math.abs(cents));
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fail = (msg) => { error.textContent = msg; error.hidden = false; };
        const amount = Math.abs(parseAmount(f.amount.value));
        if (!Number.isFinite(amount) || amount <= 0) return fail('Informe um valor maior que zero.');
        if (!categoryId) return fail('Escolha uma categoria.');
        if (!isValidISO(f.date.value)) return fail('Informe uma data válida.');

        const data = {
          type,
          amount,
          description: f.description.value.trim() || getCategory(categoryId, type).name,
          categoryId,
          date: f.date.value,
          notes: f.notes.value.trim(),
        };
        if (editing) store.updateTransaction(tx.id, data);
        else store.addTransaction(data);
        toast(editing ? 'Transação atualizada' : 'Transação adicionada');
        close();
      });

      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Excluir transação?',
          message: `“${escapeHtml(tx.description)}” será removida permanentemente.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        store.deleteTransaction(tx.id);
        toast('Transação excluída');
        close();
      });

      paint();
    },
  });
}
