"use strict";
/* =====================================================================
   PEÇAS COMPARTILHADAS — formulário genérico, quadro (kanban), filtros
   Usadas por Social media, Financeiro, Comercial e Processos.
   ===================================================================== */
const nomeCliente = id => ((Store.state.clientes || []).find(c => c.id === id) || {}).nome || null;
const pad2 = n => String(n).padStart(2, "0");
const addMes = (comp, n) => { const [y, m] = comp.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
const addDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
const dataCurta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${m[3]}/${m[2]}` : Fmt.NA; };
const isUrl = s => /^https?:\/\/\S+$/i.test(String(s || ""));
const DATA_OK = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return false; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]; };

/** Seletor de mês "‹ outubro de 2026 ›" */
function mesNav(comp, onChange) {
  return h("div", { class: "mes-nav" },
    h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Mês anterior", onclick: () => onChange(addMes(comp, -1)) }, "‹"),
    h("span", { class: "mes-nav-t" }, Fmt.month(comp)),
    h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Próximo mês", onclick: () => onChange(addMes(comp, 1)) }, "›"),
    comp !== Fmt.currentComp() ? h("button", { class: "linkbtn", type: "button", onclick: () => onChange(Fmt.currentComp()) }, "Hoje") : null);
}
/** Seletor de cliente para as áreas da agência ("" = todos) */
function clienteFiltro(id, valor, onChange, opts = {}) {
  const lista = clientesOrdenados().filter(c => opts.incluir ? opts.incluir(c) : (c.status || "ativo") !== "encerrado");
  return h("label", { class: "inline-field" }, h("span", null, opts.label || "Cliente"),
    h("select", { id, onchange: e => onChange(e.target.value) },
      opts.semTodos ? null : h("option", { value: "" }, "Todos os clientes"),
      lista.map(c => h("option", { value: c.id, selected: c.id === valor }, c.nome))));
}
function segFiltro(label, opcoes, valor, onChange) {
  return h("div", { class: "seg", role: "group", "aria-label": label },
    opcoes.map(([k, l]) => h("button", { type: "button", "aria-pressed": String(valor === k), onclick: () => onChange(k) }, l)));
}
function kpi(label, valor, sub, cls) {
  return h("div", { class: "panel kpi-card" + (cls ? " " + cls : "") }, h("span", { class: "kpi-card-k" }, label), h("span", { class: "kpi-card-v" }, valor), sub ? h("span", { class: "kpi-card-s" }, sub) : null);
}

/**
 * Formulário em gaveta a partir de uma lista de campos.
 * Campo: { k, l, type: text|textarea|money|int|date|select|url|bool, req, max, opts, blank, def, help, ph, rows }
 * Itens especiais: { section: "Título" }, { row: [campo, campo] }, { note: "texto" }.
 */
function gavetaForm({ title, spec, values, onSave, onDelete, deleteLabel, validate, saveLabel }) {
  const v = values || {};
  const campos = [];
  const mk = f => {
    campos.push(f);
    const id = "gf-" + f.k, val = v[f.k] !== undefined ? v[f.k] : f.def;
    let c;
    if (f.type === "money") c = h("div", { class: "prefix" }, h("span", null, "R$"), h("input", { id, name: f.k, type: "text", inputmode: "decimal", value: Fmt.moneyInput(val), placeholder: "0,00", autocomplete: "off" }));
    else if (f.type === "int") c = h("input", { id, name: f.k, type: "text", inputmode: "numeric", value: val == null ? "" : String(val), autocomplete: "off", placeholder: f.ph || null });
    else if (f.type === "date") c = h("input", { id, name: f.k, type: "date", value: val || "" });
    else if (f.type === "textarea") c = h("textarea", { id, name: f.k, maxlength: f.max || 30000, rows: f.rows || 5, placeholder: f.ph || null }, val || "");
    else if (f.type === "select") {
      const opts = typeof f.opts === "function" ? f.opts() : f.opts;
      c = h("select", { id, name: f.k }, f.blank != null ? h("option", { value: "" }, f.blank) : null,
        (Array.isArray(opts) ? opts : Object.entries(opts)).map(([k, l]) => h("option", { value: k, selected: String(val ?? "") === k }, l)));
    }
    else if (f.type === "bool") c = h("label", { class: "check" }, h("input", { id, name: f.k, type: "checkbox", checked: !!val }), h("span", null, f.l));
    else c = h("input", { id, name: f.k, type: f.type === "url" ? "url" : "text", value: val || "", maxlength: f.max || 200, autocomplete: "off", placeholder: f.ph || (f.type === "url" ? "https://" : null) });
    return h("div", { class: "field", id: "gf-f-" + f.k },
      f.type === "bool" ? null : h("label", { for: id }, f.l, f.req ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null),
      c, f.help ? h("span", { class: "help" }, f.help) : null, h("span", { class: "err", id: "gf-e-" + f.k, hidden: true }));
  };
  const body = spec.map(it => it.section ? h("div", { class: "form-section" }, it.section) : it.note ? h("p", { class: "form-note" }, it.note) : it.row ? h("div", { class: "grid2" }, it.row.map(mk)) : mk(it));
  const formErr = h("div", { class: "form-error", role: "alert", hidden: true });
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, saveLabel || "Salvar");
  const form = h("form", { class: "drawer", novalidate: true, "aria-labelledby": "gf-title" },
    h("div", { class: "drawer-head" }, h("h2", { id: "gf-title" }, title), h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" }, formErr, body),
    h("div", { class: "drawer-foot" }, h("div", { class: "foot-btns", style: "justify-content:space-between;width:100%" },
      onDelete ? h("button", { class: "btn btn-ghost danger-link", type: "button", onclick: () => { close(); onDelete(); } }, deleteLabel || "Excluir") : h("span"),
      h("div", { class: "actions-row" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), submit))));
  const close = openOverlay(form);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    formErr.hidden = true;
    form.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
    form.querySelectorAll(".err").forEach(el => { el.hidden = true; el.textContent = ""; });
    if (!canWrite()) { formErr.hidden = false; formErr.textContent = "O banco não está disponível. Nada foi salvo."; return; }
    const data = {}, errors = {};
    for (const f of campos) {
      const el = form.elements[f.k];
      if (f.type === "bool") { data[f.k] = el.checked; continue; }
      const raw = String(el.value ?? "");
      const t = f.type === "textarea" ? raw.replace(/\s+$/, "") : raw.trim();
      if (f.type === "money") { const r = Fmt.parseMoney(t); if (!r.ok) errors[f.k] = r.error; data[f.k] = r.value; }
      else if (f.type === "int") { const r = Fmt.parseInt(t); if (!r.ok) errors[f.k] = r.error; data[f.k] = r.value; }
      else if (f.type === "date") { if (t && !DATA_OK(t)) errors[f.k] = "Data inválida."; data[f.k] = t || null; }
      else if (f.type === "url") { if (t && !isUrl(t)) errors[f.k] = "Use um link completo, começando com https://"; data[f.k] = t || null; }
      else { if (f.max && t.length > f.max) errors[f.k] = `Use no máximo ${f.max} caracteres.`; data[f.k] = t || null; }
      if (f.req && (data[f.k] == null || data[f.k] === "") && !errors[f.k]) errors[f.k] = "Campo obrigatório.";
    }
    if (validate) Object.assign(errors, validate(data) || {});
    if (Object.keys(errors).length) {
      let first = null;
      for (const [k, msg] of Object.entries(errors)) {
        const f = form.querySelector("#gf-f-" + k), el = form.querySelector("#gf-e-" + k);
        if (f) { f.classList.add("invalid"); first = first || f.querySelector("input,select,textarea"); }
        if (el) { el.hidden = false; el.textContent = msg; }
      }
      formErr.hidden = false; formErr.textContent = `Corrija ${Object.keys(errors).length === 1 ? "o campo destacado" : "os campos destacados"} para salvar.`;
      first && first.focus(); return;
    }
    submit.disabled = true; submit.textContent = "Salvando…";
    try { const msg = await onSave(data); close(); toast(msg || "Salvo."); }
    catch (x) { formErr.hidden = false; formErr.textContent = Store.message(x); submit.disabled = false; submit.textContent = saveLabel || "Salvar"; }
  });
  return close;
}

/** Confirmação simples de exclusão */
function excluirDoc(col, doc, nome, depois) {
  confirmDialog({ title: `Excluir ${nome}?`, text: "A exclusão é definitiva e não pode ser desfeita.", confirmLabel: "Excluir",
    onConfirm: async () => { await Store.remove(col, doc.id); depois && depois(); return "Excluído."; } });
}

/** Leitura em gaveta: cabeçalho, fatos, texto formatado e ações */
/** actions: (fechar) => [botões] */
function gavetaLeitura({ title, eyebrow, facts, conteudo, onToggle, actions, extra }) {
  const acts = h("div", { class: "actions-row wrap" });
  const box = h("div", { class: "drawer drawer-wide", role: "dialog", "aria-modal": "true", "aria-labelledby": "gl-title" },
    h("div", { class: "drawer-head" }, h("div", { style: "min-width:0" }, eyebrow ? h("div", { class: "eyebrow" }, eyebrow) : null, h("h2", { id: "gl-title" }, title)),
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" },
      acts,
      facts && facts.length ? h("dl", { class: "dl" }, facts.filter(f => f && f[1] != null && f[1] !== "").map(([k, val]) => h("div", null, h("dt", null, k), h("dd", null, val)))) : null,
      extra || null,
      conteudo ? MD.render(conteudo, onToggle) : null));
  const close = openOverlay(box);
  const lista = actions ? [].concat(actions(close)).flat().filter(Boolean) : [];
  if (lista.length) acts.append(...lista); else acts.remove();
  return close;
}

/**
 * Quadro (kanban). colunas: [[status, rótulo]]. itens com .status.
 * card(item) devolve o conteúdo do cartão; onMove(item, novoStatus); onOpen(item).
 */
function quadro({ colunas, itens, card, onMove, onOpen, vazio }) {
  const ordem = colunas.map(c => c[0]);
  const board = h("div", { class: "board", role: "list" });
  for (const [st, label] of colunas) {
    const doCol = itens.filter(i => i.status === st);
    const col = h("section", { class: "board-col", "data-st": st, "aria-label": label },
      h("div", { class: "board-col-h" }, h("span", null, label), h("span", { class: "count" }, String(doCol.length))));
    const list = h("div", { class: "board-list" });
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("over"); });
    col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("over");
      const id = e.dataTransfer.getData("text/plain"); const it = itens.find(x => x.id === id);
      if (it && it.status !== st) onMove(it, st);
    });
    for (const it of doCol) {
      const i = ordem.indexOf(st);
      const el = h("article", { class: "bcard", draggable: "true", role: "listitem" },
        h("button", { class: "bcard-open", type: "button", onclick: () => onOpen(it) }, card(it)),
        h("div", { class: "bcard-move" },
          i > 0 ? h("button", { class: "btn btn-ghost btn-xs", type: "button", "aria-label": `Voltar para ${colunas[i - 1][1]}`, title: `Voltar para ${colunas[i - 1][1]}`, onclick: () => onMove(it, ordem[i - 1]) }, "‹") : h("span"),
          i < ordem.length - 1 ? h("button", { class: "btn btn-ghost btn-xs", type: "button", "aria-label": `Avançar para ${colunas[i + 1][1]}`, title: `Avançar para ${colunas[i + 1][1]}`, onclick: () => onMove(it, ordem[i + 1]) }, "›") : h("span")));
      el.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      list.append(el);
    }
    if (!doCol.length) list.append(h("p", { class: "board-empty" }, vazio || "Nada aqui."));
    col.append(list);
    board.append(col);
  }
  return h("div", { class: "board-wrap" }, board);
}
