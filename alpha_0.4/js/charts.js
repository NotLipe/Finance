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

/**
 * Gráfico de linhas (usado na projeção). Aceita valores negativos.
 * @param {string[]} labels rótulos do eixo X
 * @param {{name:string,color:string,values:number[],dashed?:boolean}[]} lines
 */
export function lineChart(labels, lines) {
  const W = 640, H = 260, pl = 74, pr = 18, pt = 16, pb = 34;
  const pw = W - pl - pr;
  const ph = H - pt - pb;
  const all = lines.flatMap((l) => l.values);
  const hi = Math.max(0, ...all);
  const lo = Math.min(0, ...all);
  // Passo "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) para o eixo ter valores fáceis de ler.
  const rough = Math.max((hi - lo) / 4, 100);
  const p = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= rough);
  const bottom = Math.floor(lo / step) * step;
  const top = Math.max(Math.ceil(hi / step) * step, bottom + step);
  const range = top - bottom;
  const ticks = Math.round(range / step);
  const x = (i) => pl + (labels.length > 1 ? (i * pw) / (labels.length - 1) : pw / 2);
  const y = (v) => pt + ((top - v) / range) * ph;

  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = bottom + step * i;
    grid += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${pl - 12}" y="${y(v) + 4}" text-anchor="end">${compactMoney(v)}</text>`;
  }
  if (bottom < 0) grid += `<line class="zero" x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}"/>`;

  const xLabels = labels
    .map((l, i) => `<text class="axis month${i === 0 ? ' active' : ''}" x="${x(i)}" y="${H - 10}" text-anchor="middle">${escapeHtml(l)}</text>`)
    .join('');

  const paths = lines
    .map((l) => {
      const d = l.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      const dots = l.values
        .map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#fff" stroke="${escapeHtml(l.color)}" stroke-width="2.5">
            <title>${escapeHtml(l.name)} · ${escapeHtml(labels[i])}: ${money(v)}</title></circle>`)
        .join('');
      return `<path d="${d}" fill="none" stroke="${escapeHtml(l.color)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        ${l.dashed ? 'stroke-dasharray="7 7"' : ''}/>${dots}`;
    })
    .join('');

  return `<svg class="bars line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção da sobra acumulada">${grid}${xLabels}${paths}</svg>`;
}
