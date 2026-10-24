"use strict";
/* =====================================================================
   GRÁFICOS — gera SVG como texto. O mesmo SVG aparece na tela e no PDF.
   Recebe cores prontas (não usa variáveis CSS) para funcionar nos dois.
   ===================================================================== */
const Charts = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  /**
   * opts: { labels[], values[] (null = sem dado), fmt, kind: "bar"|"line", width, height,
   *         colors: {mark, markMuted, text, muted, grid, bg}, font, highlightLast }
   */
  function svg(opts) {
    const W = opts.width || 640, H = opts.height || 220;
    const c = opts.colors, font = opts.font || "Jost, sans-serif";
    const fmt = opts.fmt || "int";
    const fs = opts.fontSize || 10;
    const vals = opts.values.map(v => (typeof v === "number" && isFinite(v) ? v : null));
    const max = niceMax(Math.max(0, ...vals.filter(v => v != null)));
    const left = opts.fontSize ? 46 : 56, right = 12, top = 22, bottom = 30;
    const iw = W - left - right, ih = H - top - bottom;
    const n = vals.length;
    const step = iw / Math.max(n, 1);
    const y = v => top + ih - (v / max) * ih;
    const xC = i => left + step * i + step / 2;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(font)}">`;
    // grade e eixo
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, yy = y(v).toFixed(1);
      s += `<line x1="${left}" x2="${W - right}" y1="${yy}" y2="${yy}" stroke="${c.grid}" stroke-width="1"/>`;
      s += `<text x="${left - 8}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${c.muted}">${esc(Fmt.compact(fmt, v))}</text>`;
    }
    const showVal = n <= 12 && step >= fs * 3.2;
    const every = Math.max(1, Math.ceil((fs * 3.6) / step));
    if (opts.kind === "line") {
      let d = "", pen = false;
      vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${xC(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
      if (d) s += `<path d="${d.trim()}" fill="none" stroke="${c.mark}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      vals.forEach((v, i) => {
        if (v == null) return;
        const last = opts.highlightLast !== false && i === n - 1;
        s += `<circle cx="${xC(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${last ? 4.5 : 3}" fill="${last ? c.mark : c.bg}" stroke="${c.mark}" stroke-width="2"/>`;
        if (showVal) s += `<text x="${xC(i).toFixed(1)}" y="${(y(v) - 9).toFixed(1)}" text-anchor="middle" font-size="${fs}" fill="${c.text}">${esc(Fmt.compact(fmt, v))}</text>`;
      });
    } else {
      const bw = Math.min(42, step * 0.62);
      vals.forEach((v, i) => {
        if (v == null) {
          s += `<text x="${xC(i).toFixed(1)}" y="${(top + ih - 6).toFixed(1)}" text-anchor="middle" font-size="${fs}" fill="${c.muted}">—</text>`;
          return;
        }
        const last = opts.highlightLast !== false && i === n - 1;
        const yy = y(v), hh = Math.max(top + ih - yy, v > 0 ? 1 : 0);
        s += `<rect x="${(xC(i) - bw / 2).toFixed(1)}" y="${(top + ih - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${last ? c.mark : c.markMuted}"/>`;
        if (showVal) s += `<text x="${xC(i).toFixed(1)}" y="${(top + ih - hh - 6).toFixed(1)}" text-anchor="middle" font-size="${fs}" fill="${c.text}">${esc(Fmt.compact(fmt, v))}</text>`;
      });
    }
    s += `<line x1="${left}" x2="${W - right}" y1="${top + ih}" y2="${top + ih}" stroke="${c.muted}" stroke-width="1"/>`;
    opts.labels.forEach((l, i) => { if ((n - 1 - i) % every) return; s += `<text x="${xC(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="${fs + 0.5}" fill="${c.muted}">${esc(l)}</text>`; });
    return s + "</svg>";
  }
  return { svg, niceMax };
})();
