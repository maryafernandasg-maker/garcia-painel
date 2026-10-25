"use strict";
/* =====================================================================
   PROCESSOS — jornada do cliente, SOPs, checklists, guias e materiais
   Coleção: documentos (texto formatado com caixinhas clicáveis)
   Um checklist pode ser copiado para um cliente: a cópia fica em "Em andamento".
   ===================================================================== */
const CATEG_DOC = [["jornada", "Jornada e políticas"], ["sop", "SOPs"], ["checklist", "Checklists"], ["guia", "Guias e padrões"], ["material", "Materiais e modelos"], ["execucao", "Em andamento por cliente"]];
const CATEG_DOC_NOME = Object.fromEntries(CATEG_DOC);
const FASES_DOC = { comercial: "Comercial", entrada: "Entrada do cliente", gestao: "Gestão contínua", saida: "Risco e saída", geral: "Geral" };
const STATUS_DOC = { rascunho: "Rascunho", revisado: "Revisado", pronto: "Pronto", a_criar: "A criar" };
UI.docId = Prefs.get("docId");
UI.docBusca = "";

const ordemDoc = (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || (a.numero ?? 999) - (b.numero ?? 999) || (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");
function viewProcessos() {
  const docs = AG("documentos");
  const top = head("Agência", "Processos", "Jornada do cliente, SOPs, checklists e materiais da Garcia. As caixinhas podem ser marcadas direto aqui.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openDocForm(null) }, "Novo documento"));
  if (docs == null || Store.state.clientes == null) return [top, loadingPanel()];
  if (!docs.length) return [top, emptyPanel("Nenhum documento ainda", "Crie o primeiro processo, SOP ou checklist da agência.", h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openDocForm(null) }, "Novo documento"))];
  const q = Domain.norm(UI.docBusca);
  const lista = docs.filter(d => !q || Domain.norm([d.titulo, d.conteudo, d.gatilho, nomeCliente(d.clienteId)].join(" ")).includes(q));
  const sel = docs.find(d => d.id === UI.docId) || docs.slice().sort(ordemDoc).find(d => d.categoria === "jornada") || docs.slice().sort(ordemDoc)[0];
  const busca = h("input", { class: "search", id: "docBusca", type: "search", placeholder: "Buscar nos processos", value: UI.docBusca, "aria-label": "Buscar nos processos",
    oninput: e => { UI.docBusca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("docBusca"); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } });
  const nav = h("nav", { class: "doc-nav", "aria-label": "Documentos" }, busca,
    CATEG_DOC.map(([cat, label]) => {
      const itens = lista.filter(d => (d.categoria || "guia") === cat).sort(ordemDoc);
      if (!itens.length) return null;
      return h("div", { class: "doc-group" }, h("div", { class: "nav-label" }, label),
        itens.map(d => { const pr = MD.progresso(d.conteudo);
          return h("button", { type: "button", class: "doc-link", "aria-current": d.id === sel.id ? "true" : null, onclick: () => { UI.docId = d.id; Prefs.set("docId", d.id); render(); if (innerWidth < 900) document.getElementById("docMain")?.scrollIntoView({ behavior: "smooth" }); } },
            h("span", null, d.titulo), cat === "execucao" && pr.total ? h("span", { class: "doc-pr" }, `${pr.feitas}/${pr.total}`) : d.status === "a_criar" ? h("span", { class: "doc-pr" }, "a criar") : null); }));
    }), !lista.length ? h("p", { class: "muted-line" }, "Nada encontrado.") : null);
  return [top, h("div", { class: "doc-layout" }, h("div", { class: "panel doc-side" }, nav), h("div", { class: "panel doc-main", id: "docMain" }, docView(sel)))];
}
function docView(d) {
  const atual = () => (AG("documentos") || []).find(x => x.id === d.id) || d;
  const pr = MD.progresso(d.conteudo);
  const facts = [["Categoria", CATEG_DOC_NOME[d.categoria]], ["Cliente", d.clienteId ? nomeCliente(d.clienteId) : null], ["Fase", FASES_DOC[d.fase]], ["Gatilho", d.gatilho], ["Frequência", d.frequencia],
    ["Responsável e prazos", d.responsavel], ["Status", STATUS_DOC[d.status]], ["Última revisão", d.revisao ? Fmt.date(d.revisao) : null],
    ["Link", d.link ? h("a", { href: d.link, target: "_blank", rel: "noopener noreferrer" }, "Abrir") : null]].filter(f => f[1]);
  return h("article", { class: "doc" },
    h("div", { class: "doc-head" }, h("div", { style: "min-width:0" }, h("div", { class: "eyebrow" }, [CATEG_DOC_NOME[d.categoria], d.numero != null ? `Nº ${pad2(d.numero)}` : null].filter(Boolean).join(" · ")), h("h2", null, d.titulo)),
      h("div", { class: "actions-row wrap" },
        pr.total && d.categoria !== "execucao" ? h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: () => usarComCliente(d) }, "Usar com um cliente") : null,
        pr.feitas ? h("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !canWrite(), onclick: async () => { try { await Store.patch("documentos", d.id, { conteudo: MD.reset(atual().conteudo) }); toast("Caixinhas desmarcadas."); } catch (x) { toast(Store.message(x), "bad"); } } }, "Desmarcar tudo") : null,
        h("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !canWrite(), onclick: () => openDocForm(d) }, "Editar"))),
    facts.length ? h("dl", { class: "dl" }, facts.map(([k, v]) => h("div", null, h("dt", null, k), h("dd", null, v)))) : null,
    pr.total ? h("div", { class: "doc-progress" }, h("span", null, `${pr.feitas} de ${pr.total} itens marcados`), h("span", { class: "bar" }, h("i", { style: `width:${Math.round(pr.feitas / pr.total * 100)}%` }))) : null,
    MD.render(d.conteudo || "Sem conteúdo.", async (idx, checked) => { try { const cur = atual(); await Store.patch("documentos", cur.id, { conteudo: MD.toggle(cur.conteudo, idx, checked) }); } catch (x) { toast(Store.message(x), "bad"); } }));
}
function usarComCliente(d) {
  const clientes = clientesOrdenados().filter(c => (c.status || "ativo") !== "encerrado");
  const sel = h("select", { id: "ucCli" }, clientes.map(c => h("option", { value: c.id }, c.nome)));
  const err = h("p", { class: "err-text", hidden: true });
  const ok = h("button", { class: "btn btn-primary", type: "button", disabled: !clientes.length }, "Criar cópia");
  const box = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "uc-t" }, h("h2", { id: "uc-t" }, `Usar “${d.titulo}” com um cliente`),
    h("p", null, "Será criada uma cópia com as caixinhas desmarcadas, em “Em andamento por cliente”. O modelo original continua igual."),
    clientes.length ? h("div", { class: "field" }, h("label", { for: "ucCli" }, "Cliente"), sel) : h("p", { class: "muted-line" }, "Cadastre um cliente primeiro."), err,
    h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), ok));
  const close = openOverlay(box, true);
  ok.addEventListener("click", async () => {
    ok.disabled = true;
    const c = clientes.find(x => x.id === sel.value);
    const id = Domain.novoId(`${d.titulo} ${c.nome}`);
    try {
      await Store.put("documentos", id, { titulo: `${d.titulo.replace(/^.*?—\s*/, "")} · ${c.nome}`, categoria: "execucao", clienteId: c.id, baseId: d.id, conteudo: MD.reset(d.conteudo), ordem: 0, schema: Domain.SCHEMA });
      UI.docId = id; Prefs.set("docId", id); close(); toast("Cópia criada para " + c.nome + ".");
    } catch (x) { err.hidden = false; err.textContent = Store.message(x); ok.disabled = false; }
  });
}
function openDocForm(d) {
  gavetaForm({
    title: d ? "Editar documento" : "Novo documento", values: d || { categoria: "guia" },
    spec: [
      { k: "titulo", l: "Título", req: true, max: 160 },
      { row: [{ k: "categoria", l: "Categoria", type: "select", opts: CATEG_DOC }, { k: "status", l: "Status", type: "select", blank: "Sem status", opts: STATUS_DOC }] },
      { row: [{ k: "numero", l: "Número", type: "int", help: "Para ordenar SOPs." }, { k: "fase", l: "Fase da jornada", type: "select", blank: "Nenhuma", opts: FASES_DOC }] },
      { k: "clienteId", l: "Cliente", type: "select", blank: "Nenhum (modelo da agência)", opts: () => clientesOrdenados().map(c => [c.id, c.nome]) },
      { k: "gatilho", l: "Gatilho (quando usar)", type: "textarea", rows: 2, max: 400 },
      { row: [{ k: "frequencia", l: "Frequência", max: 80 }, { k: "revisao", l: "Última revisão", type: "date" }] },
      { k: "responsavel", l: "Responsável e prazos", max: 200 },
      { k: "link", l: "Link externo", type: "url" },
      { k: "conteudo", l: "Conteúdo", type: "textarea", rows: 22, help: "Use ## para títulos, - para listas, 1. para passos e - [ ] para caixinhas. Tabelas: | coluna | coluna |." },
    ],
    onDelete: d ? () => excluirDoc("documentos", d, "este documento", () => { UI.docId = null; Prefs.set("docId", null); }) : null,
    onSave: async v => {
      if (d) await Store.patch("documentos", d.id, v);
      else { const id = Domain.novoId(v.titulo); await Store.put("documentos", id, { ...v, ordem: 50, schema: Domain.SCHEMA }); UI.docId = id; Prefs.set("docId", id); }
      return "Documento salvo.";
    },
  });
}
