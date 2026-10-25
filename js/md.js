"use strict";
/* =====================================================================
   TEXTO FORMATADO — subconjunto de Markdown, montado direto no DOM (sem innerHTML)
   Títulos (#, ##, ###), listas (-, 1.), caixinhas (- [ ] / - [x] / ☐ / ☑),
   tabelas (| a | b |), citação (>), linha (---), bloco de código (```),
   **negrito**, [link](https://…), links soltos e quebra de linha (<br>).
   ===================================================================== */
const MD = (() => {
  const CHECK = /^(\s*)(?:[-*]\s+)?(\[( |x|X)\]|☐|☑)\s?(.*)$/;
  const isCheck = line => CHECK.test(line);
  const safeUrl = u => /^https?:\/\//i.test(u) ? u : null;

  function inline(text) {
    const out = [];
    const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)<>]+)|(<br\s*\/?>)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[5]) out.push(h("br"));
      else if (m[1]) out.push(h("strong", null, m[1]));
      else if (m[2]) { const u = safeUrl(m[3]); out.push(u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, m[2]) : m[2]); }
      else { const u = m[4].replace(/[.,;:]+$/, ""); out.push(h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, u.replace(/^https?:\/\//, "").slice(0, 60) + (u.length > 68 ? "…" : ""))); if (u.length < m[4].length) out.push(m[4].slice(u.length)); }
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  /** Monta o conteúdo. onToggle(indiceDaLinha, marcado) torna as caixinhas clicáveis. */
  function render(src, onToggle) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const root = h("div", { class: "md" });
    let list = null, listType = null, para = [];
    const flushPara = () => { if (para.length) { root.append(h("p", null, inline(para.join(" ")))); para = []; } };
    const closeList = () => { list = null; listType = null; };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i], line = raw.trim();
      if (line.startsWith("```")) {
        flushPara(); closeList();
        const buf = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
        root.append(h("pre", { class: "md-pre" }, buf.join("\n")));
        continue;
      }
      if (!line) { flushPara(); closeList(); continue; }
      if (/^\|.*\|$/.test(line)) {
        flushPara(); closeList();
        const rows = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(lines[i++].trim());
        i--;
        const cells = r => r.slice(1, -1).split("|").map(c => c.trim());
        const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
        const [first, ...rest] = body;
        root.append(h("div", { class: "table-wrap md-table" }, h("table", { class: "data" },
          first ? h("thead", null, h("tr", null, cells(first).map(c => h("th", null, inline(c))))) : null,
          h("tbody", null, rest.map(r => h("tr", null, cells(r).map(c => h("td", null, inline(c)))))))));
        continue;
      }
      const hm = /^(#{1,4})\s+(.*)$/.exec(line);
      if (hm) { flushPara(); closeList(); root.append(h(["h2", "h3", "h4", "h5"][hm[1].length - 1], { class: "md-h" }, inline(hm[2]))); continue; }
      if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) { flushPara(); closeList(); root.append(h("hr")); continue; }
      if (line.startsWith(">")) {
        flushPara(); closeList();
        const prev = root.lastElementChild, p = h("p", null, inline(line.replace(/^>\s?/, "")));
        if (prev && prev.tagName === "BLOCKQUOTE" && /^\s*>/.test(lines[i - 1] || "")) prev.append(p); else root.append(h("blockquote", null, p));
        continue;
      }
      if (isCheck(line)) {
        flushPara();
        const m = CHECK.exec(line), done = m[2] === "☑" || /x/i.test(m[3] || "");
        if (listType !== "check") { list = h("ul", { class: "md-checks" }); listType = "check"; root.append(list); }
        const idx = i;
        const box = h("input", { type: "checkbox", checked: done, disabled: !onToggle, "aria-label": m[4] || "Item" });
        if (onToggle) box.addEventListener("change", () => onToggle(idx, box.checked));
        list.append(h("li", { class: done ? "done" : null }, h("label", { class: "check" }, box, h("span", null, inline(m[4] || "")))));
        continue;
      }
      const ul = /^[-*•]\s+(.*)$/.exec(line), ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        const t = ul ? "ul" : "ol";
        if (listType !== t) { list = h(t, { class: "md-list" }); listType = t; root.append(list); }
        list.append(h("li", null, inline(ul ? ul[1] : ol[2])));
        continue;
      }
      closeList();
      para.push(line);
    }
    flushPara();
    return root;
  }

  /** Marca ou desmarca a caixinha da linha indicada e devolve o texto novo. */
  function toggle(src, idx, checked) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const l = lines[idx];
    if (l == null || !isCheck(l.trim())) return src;
    lines[idx] = l.replace(/\[( |x|X)\]|☐|☑/, m => m.startsWith("[") ? (checked ? "[x]" : "[ ]") : (checked ? "☑" : "☐"));
    return lines.join("\n");
  }
  /** Desmarca todas as caixinhas. */
  function reset(src) {
    return String(src || "").replace(/\r\n?/g, "\n").split("\n").map(l => isCheck(l.trim()) ? l.replace(/\[(x|X)\]|☑/, m => m.startsWith("[") ? "[ ]" : "☐") : l).join("\n");
  }
  /** Conta caixinhas: { total, feitas } */
  function progresso(src) {
    let total = 0, feitas = 0;
    for (const l of String(src || "").split("\n")) {
      const t = l.trim();
      if (!isCheck(t)) continue;
      total++;
      const m = CHECK.exec(t); if (m[2] === "☑" || /x/i.test(m[3] || "")) feitas++;
    }
    return { total, feitas };
  }
  return { render, toggle, reset, progresso };
})();
if (typeof module !== "undefined") module.exports = { MD };
