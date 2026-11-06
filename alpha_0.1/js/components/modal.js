import { icon } from '../icons.js';
import { escapeHtml } from '../utils.js';

/**
 * Abre um modal. `content` é HTML; `onMount(el, close)` liga os eventos.
 * Fecha com Esc, clique fora ou qualquer elemento com [data-close].
 */
export function openModal({ title, content, size = 'md', onMount, onClose }) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <h2>${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="modal-body">${content}</div>
    </div>`;
  root.appendChild(backdrop);
  document.body.classList.add('modal-open');

  const previousFocus = document.activeElement;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.classList.add('closing');
    setTimeout(() => {
      backdrop.remove();
      if (!root.children.length) document.body.classList.remove('modal-open');
    }, 140);
    previousFocus?.focus?.();
    onClose?.();
  }

  function onKey(e) {
    // Só o modal do topo reage ao Esc (ex.: confirmação aberta por cima de um formulário).
    if (e.key === 'Escape' && root.lastElementChild === backdrop) close();
  }

  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

  const modal = backdrop.querySelector('.modal');
  onMount?.(modal, close);
  requestAnimationFrame(() => (modal.querySelector('[autofocus]') ?? modal.querySelector('input, select, textarea, button'))?.focus());
  return close;
}

/** Diálogo de confirmação. Resolve true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    openModal({
      title,
      size: 'sm',
      content: `
        <p class="confirm-msg">${message}</p>
        <div class="modal-actions">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok autofocus>${escapeHtml(confirmLabel)}</button>
        </div>`,
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => { confirmed = true; close(); });
      },
      onClose: () => resolve(confirmed),
    });
  });
}
