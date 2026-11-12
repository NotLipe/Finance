import { store, categoriesOf } from '../store.js';
import { icon } from '../icons.js';
import { pageHeader, toast } from '../components/ui.js';
import { parseCSV, guessMapping, buildImportItems } from '../csv.js';
import { escapeHtml, formatDateBR, signedMoney, money, readTextFile, download, todayISO, currentMonth } from '../utils.js';

// Estado do assistente de importação (mantido enquanto o app está aberto).
let session = null; // { fileName, rows, mapping, signMode, items, invalid }

function recompute() {
  const { items, invalid } = buildImportItems(session.rows, session.mapping, session.signMode);
  session.items = items;
  session.invalid = invalid;
}

async function loadFile(file, rerender) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast('Arquivo muito grande (máx. 5 MB).', 'error');
  try {
    const { rows } = parseCSV(await readTextFile(file));
    if (rows.length < 1) return toast('Não encontramos linhas nesse arquivo.', 'error');
    session = { fileName: file.name, rows, mapping: guessMapping(rows), signMode: 'negative-expense' };
    recompute();
    rerender();
  } catch (err) {
    console.error(err);
    toast('Não foi possível ler esse arquivo.', 'error');
  }
}

export function render(root, ctx) {
  const rerender = () => render(root, ctx);
  const header = pageHeader({
    title: 'Importe seu <span class="ring">extrato</span>',
    subtitle: 'Traga transações de um arquivo CSV exportado pelo seu banco ou cartão',
    actions: session ? `<button type="button" class="btn btn-glass" data-reset>${icon('x', 18)} Cancelar importação</button>` : '',
  });

  root.innerHTML = header + (session ? mappingView() : uploadView());

  if (!session) {
    const zone = root.querySelector('[data-dropzone]');
    const input = root.querySelector('input[type=file]');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => loadFile(input.files[0], rerender));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag');
      loadFile(e.dataTransfer.files[0], rerender);
    });
    root.querySelector('[data-sample-csv]').addEventListener('click', downloadSampleCSV);
    return;
  }

  root.querySelector('[data-reset]').addEventListener('click', () => { session = null; rerender(); });

  root.querySelectorAll('[data-map]').forEach((sel) =>
    sel.addEventListener('change', () => { session.mapping[sel.dataset.map] = Number(sel.value); recompute(); rerender(); }));
  root.querySelector('[data-has-header]').addEventListener('change', (e) => {
    session.mapping.hasHeader = e.target.checked; recompute(); rerender();
  });
  root.querySelectorAll('[name=sign]').forEach((r) =>
    r.addEventListener('change', () => { session.signMode = r.value; recompute(); rerender(); }));

  const table = root.querySelector('[data-table]');
  const importBtn = root.querySelector('[data-import]');
  const refreshCount = () => {
    const n = session.items.filter((i) => i.selected).length;
    importBtn.disabled = n === 0;
    importBtn.querySelector('span').textContent = `Importar ${n} transaç${n === 1 ? 'ão' : 'ões'}`;
  };

  table?.addEventListener('change', (e) => {
    const idx = Number(e.target.closest('tr')?.dataset.idx);
    const item = session.items[idx];
    if (!item) return;
    if (e.target.matches('[data-select]')) item.selected = e.target.checked;
    if (e.target.matches('[data-cat]')) item.categoryId = e.target.value;
    refreshCount();
  });
  root.querySelector('[data-select-all]')?.addEventListener('change', (e) => {
    session.items.forEach((i) => { i.selected = e.target.checked; });
    table.querySelectorAll('[data-select]').forEach((c) => { c.checked = e.target.checked; });
    refreshCount();
  });

  importBtn.addEventListener('click', () => {
    const chosen = session.items.filter((i) => i.selected);
    if (!chosen.length) return;
    const count = store.addTransactions(chosen.map(({ date, description, amount, type, categoryId }) => ({ date, description, amount, type, categoryId })));
    const latest = chosen.reduce((a, i) => (i.date > a ? i.date : a), '0000-00-00').slice(0, 7);
    session = null;
    toast(`${count} transaç${count === 1 ? 'ão importada' : 'ões importadas'}`);
    ctx.setMonth(latest, false);
    location.hash = '#/transacoes';
  });

  refreshCount();
}

function uploadView() {
  return `<div class="import-layout">
    <section class="card">
      <div class="dropzone" data-dropzone tabindex="0" role="button" aria-label="Selecionar arquivo CSV">
        <span class="big-ico">${icon('upload', 32)}</span>
        <h2>Arraste seu arquivo CSV aqui</h2>
        <p class="muted">ou clique para escolher no computador</p>
        <span class="chip">.csv · até 5 MB</span>
        <input type="file" accept=".csv,text/csv" hidden>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Como funciona</h2></div>
      <ol class="steps">
        <li><div><strong>Exporte o extrato</strong><small>No app ou site do banco, procure por “exportar extrato” em CSV. Fatura de cartão também funciona.</small></div></li>
        <li><div><strong>Confira as colunas</strong><small>Detectamos automaticamente data, descrição e valor. Você pode ajustar se precisar.</small></div></li>
        <li><div><strong>Revise e importe</strong><small>As categorias são sugeridas pela descrição e transações repetidas são marcadas para não duplicar.</small></div></li>
      </ol>
      <button type="button" class="btn btn-ghost" data-sample-csv>${icon('download', 18)} Baixar CSV de exemplo</button>
    </section>
  </div>`;
}

function mappingView() {
  const { fileName, rows, mapping, signMode, items, invalid } = session;
  const width = Math.max(...rows.map((r) => r.length));
  const headerRow = rows[0];
  const colName = (i) => (mapping.hasHeader && headerRow[i]?.trim() ? headerRow[i].trim() : `Coluna ${i + 1}`);
  const select = (key, label) => `
    <div class="field">
      <label for="map-${key}">${label}</label>
      <select class="select input" id="map-${key}" data-map="${key}">
        <option value="-1" ${mapping[key] < 0 ? 'selected' : ''}>— escolher —</option>
        ${[...Array(width).keys()].map((i) => `<option value="${i}" ${mapping[key] === i ? 'selected' : ''}>${escapeHtml(colName(i))}</option>`).join('')}
      </select>
    </div>`;

  const duplicates = items.filter((i) => i.duplicate).length;
  const catOptions = {
    expense: categoriesOf('expense'),
    income: categoriesOf('income'),
  };
  const missingMapping = mapping.date < 0 || mapping.amount < 0 || mapping.description < 0;

  return `<div class="mapping-layout">
    <section class="card">
      <div class="file-pill">${icon('file', 20)}<span>${escapeHtml(fileName)}</span></div>
      <p class="card-sub">${rows.length} linhas lidas</p>
      <div class="form">
        <label class="check"><input type="checkbox" data-has-header ${mapping.hasHeader ? 'checked' : ''}> A primeira linha é o cabeçalho</label>
        ${select('date', 'Coluna da data')}
        ${select('description', 'Coluna da descrição')}
        ${select('amount', 'Coluna do valor')}
        <div class="field">
          <span class="field-label">Como ler os valores</span>
          <label class="radio-card"><input type="radio" name="sign" value="negative-expense" ${signMode === 'negative-expense' ? 'checked' : ''}>
            <span><strong>Negativo = despesa</strong><small>Extrato de conta corrente</small></span></label>
          <label class="radio-card"><input type="radio" name="sign" value="positive-expense" ${signMode === 'positive-expense' ? 'checked' : ''}>
            <span><strong>Positivo = despesa</strong><small>Fatura de cartão de crédito</small></span></label>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div><h2>Pré-visualização</h2>
          <p class="card-sub">${items.length} transações encontradas${duplicates ? ` · ${duplicates} já existem` : ''}${invalid ? ` · ${invalid} linhas ignoradas` : ''}</p>
        </div>
        <button type="button" class="btn btn-primary" data-import>${icon('check', 18)} <span>Importar</span></button>
      </div>
      ${missingMapping
        ? `<div class="notice">${icon('info', 18)} Escolha as colunas de data, descrição e valor ao lado.</div>`
        : !items.length
          ? `<div class="notice">${icon('alert', 18)} Nenhuma linha válida com essas colunas. Confira o mapeamento ao lado.</div>`
          : `<div class="table-wrap">
              <table class="preview" data-table>
                <thead><tr>
                  <th><input type="checkbox" data-select-all aria-label="Selecionar todas" ${items.every((i) => i.selected) ? 'checked' : ''}></th>
                  <th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th>
                </tr></thead>
                <tbody>
                  ${items.map((it, idx) => `<tr data-idx="${idx}" class="${it.duplicate ? 'dup' : ''}">
                    <td><input type="checkbox" data-select ${it.selected ? 'checked' : ''} aria-label="Importar linha"></td>
                    <td class="nowrap">${formatDateBR(it.date)}</td>
                    <td>${escapeHtml(it.description)}${it.duplicate ? '<span class="badge">já existe</span>' : ''}</td>
                    <td><select class="select sm" data-cat aria-label="Categoria">
                      ${catOptions[it.type].map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === it.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                    </select></td>
                    <td class="num tx-amount ${it.type}">${signedMoney(it.amount, it.type)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <p class="card-sub total-line">Total selecionado: ${money(items.filter((i) => i.selected && i.type === 'income').reduce((a, i) => a + i.amount, 0))} em receitas ·
              ${money(items.filter((i) => i.selected && i.type === 'expense').reduce((a, i) => a + i.amount, 0))} em despesas</p>`}
    </section>
  </div>`;
}

function downloadSampleCSV() {
  const month = currentMonth();
  const todayDay = Number(todayISO().slice(8, 10));
  const d = (day) => `${String(Math.min(day, todayDay)).padStart(2, '0')}/${month.slice(5, 7)}/${month.slice(0, 4)}`;
  const lines = [
    'Data;Descrição;Valor',
    `${d(1)};Supermercado Bom Preço;-287,45`,
    `${d(2)};Uber *Trip;-23,90`,
    `${d(3)};iFood *Restaurante;-58,70`,
    `${d(5)};Salário Empresa XYZ;6.500,00`,
    `${d(6)};Netflix.com;-55,90`,
    `${d(7)};Drogaria São Paulo;-42,15`,
    `${d(8)};Posto Shell;-180,00`,
    `${d(9)};Pix recebido - João;150,00`,
    `${d(10)};Aluguel;-1.800,00`,
  ];
  download('extrato-exemplo.csv', `﻿${lines.join('\r\n')}`, 'text/csv;charset=utf-8');
}
