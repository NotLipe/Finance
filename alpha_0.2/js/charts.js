// Gráficos em SVG puro (sem bibliotecas).

import { escapeHtml, compactMoney, money } from './utils.js';

/**
 * Gráfico de rosca.
 * @param {{value:number,color:string,label:string}[]} segments
 * @param {{label?:string,value?:string}} center texto exibido no meio
 */
export function donut(segments, center = {}) {
  const R = 80;
  const SW = 28;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const gap = segments.length > 1 ? 1.6 : 0;
  let offset = 0;

  const arcs = segments
    .map((s) => {
      const len = total ? (s.value / total) * C : 0;
      const pct = total ? Math.round((s.value / total) * 100) : 0;
      const arc = `<circle class="donut-seg" cx="100" cy="100" r="${R}" stroke="${escapeHtml(s.color)}" stroke-width="${SW}"
        stroke-dasharray="${Math.max(len - gap, 0.01)} ${C}" stroke-dashoffset="${-offset}">
        <title>${escapeHtml(s.label)}: ${pct}%</title></circle>`;
      offset += len;
      return arc;
    })
    .join('');

  return `<div class="donut">
    <svg viewBox="0 0 200 200" role="img" aria-label="Distribuição por categoria">
      <g transform="rotate(-90 100 100)" fill="none">
        <circle cx="100" cy="100" r="${R}" stroke="#efeef8" stroke-width="${SW}"/>
        ${arcs}
      </g>
    </svg>
    <div class="donut-center"><small>${escapeHtml(center.label ?? '')}</small><strong>${escapeHtml(center.value ?? '')}</strong></div>
  </div>`;
}

/** Arredonda o máximo do eixo para um valor "bonito" divisível em 4 faixas. */
function niceCeil(cents) {
  const v = Math.max(cents / 100, 1);
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = [1, 2, 4, 6, 8, 10].find((x) => n <= x);
  return m * p * 100;
}

function roundTopBar(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Barras agrupadas de receitas x despesas por mês.
 * Cada grupo tem data-month, então clicar seleciona aquele mês (tratado em app.js).
 */
export function incomeExpenseBars(series, activeKey) {
  const W = 640, H = 250, pl = 70, pr = 10, pt = 14, pb = 34;
  const pw = W - pl - pr;
  const ph = H - pt - pb;
  const max = niceCeil(Math.max(...series.flatMap((s) => [s.income, s.expense])));
  const gw = pw / series.length;
  const bw = Math.min(26, gw * 0.26);
  const y = (v) => pt + ph - (v / max) * ph;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    grid += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${pl - 12}" y="${y(v) + 4}" text-anchor="end">${compactMoney(v)}</text>`;
  }

  const groups = series
    .map((s, i) => {
      const x0 = pl + gw * i;
      const cx = x0 + gw / 2;
      const active = s.key === activeKey;
      return `<g class="bar-group${active ? ' active' : ''}" data-month="${s.key}">
        <title>${s.label} — Receitas ${money(s.income)} · Despesas ${money(s.expense)}</title>
        <rect class="band" x="${x0 + 4}" y="${pt - 6}" width="${gw - 8}" height="${ph + 6 + pb - 4}" rx="14"/>
        <path class="bar-inc" d="${roundTopBar(cx - bw - 3, y(s.income), bw, pt + ph - y(s.income), 7)}"/>
        <path class="bar-exp" d="${roundTopBar(cx + 3, y(s.expense), bw, pt + ph - y(s.expense), 7)}"/>
        <text class="axis month${active ? ' active' : ''}" x="${cx}" y="${H - 10}" text-anchor="middle">${s.label}</text>
      </g>`;
    })
    .join('');

  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas e despesas por mês">${grid}${groups}</svg>`;
}
