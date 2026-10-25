"use strict";
/* =====================================================================
   INTERFACE
   ===================================================================== */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const SECTIONS = [
  { group: "Agência", items: [
    { id: "inicio", label: "Início" },
    { id: "clientes", label: "Clientes" },
    { id: "comercial", label: "Comercial" },
    { id: "financeiro", label: "Financeiro" },
    { id: "processos", label: "Processos" },
  ]},
  { group: "Social media", items: [
    { id: "social", label: "Calendário editorial" },
    { id: "producao", label: "Produção" },
    { id: "planejamento", label: "Planejamento do mês" },
  ]},
  { group: "Tráfego", cliente: true, items: [
    { id: "visao", label: "Visão geral" },
    { id: "dias", label: "Calendário diário" },
    { id: "campanhas", label: "Campanhas" },
    { id: "conjuntos", label: "Conjuntos de anúncios" },
    { id: "anuncios", label: "Anúncios e criativos" },
    { id: "funil", label: "Funil de conversão" },
    { id: "analise", label: "Análise estratégica" },
    { id: "lancamentos", label: "Lançar dados do mês" },
    { id: "relatorios", label: "Relatórios mensais" },
    { id: "historico", label: "Histórico" },
  ]},
  { group: "Sistema", items: [
    { id: "dados", label: "Dados e backup" },
  ]},
];
const ALL = SECTIONS.flatMap(g => g.items);

const UI = {
  view: "inicio",
  clienteId: Prefs.get("cliente"),
  comp: /^\d{4}-\d{2}$/.test(Prefs.get("comp") || "") ? Prefs.get("comp") : Fmt.previousComp(Fmt.currentComp()),
  tab: "resumo",
  dur: [1, 3, 6, 12].includes(Number(Prefs.get("dur"))) ? Number(Prefs.get("dur")) : 1,
  chartMetric: "investimento",
  objFiltro: "todos",
  aberto: null,
  cmpA: null, cmpB: null,
  filtroStatus: "ativo",
  busca: "",
};

const NENHUM = "__nenhum";
const clientesOrdenados = () => (Store.state.clientes || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
const clienteAtual = () => (Store.state.clientes || []).find(c => c.id === UI.clienteId) || null;
/* acesso aos dados do cliente selecionado (null = carregando) */
const CD = col => Store.state.cd ? Store.state.cd[col] : null;
const mesCol = (col, relId) => { const a = CD(col); return a == null ? null : a.filter(d => d.relatorioId === relId); };
const docDe = (col, id) => { const a = CD(col); return a == null ? undefined : (a.find(d => d.id === id) || null); };
const relatorioAtual = () => { const c = clienteAtual(); return c && (CD("relatorios") || []).find(r => r.id === Domain.relatorioId(c.id, UI.comp)) || null; };
const MC = col => { const rel = relatorioAtual(); return rel ? mesCol(col, rel.id) : null; };
const MCom = () => { const rel = relatorioAtual(); return rel ? docDe("resultados_comerciais", rel.id) : undefined; };
const canWrite = () => Store.ready && Store.state.clientes != null;
const byNome = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR");

function toast(msg, kind) {
  document.querySelectorAll(".toast").forEach(el => el.remove());
  const t = h("div", { class: "toast" + (kind === "bad" ? " bad" : ""), role: "status" }, msg);
  document.getElementById("layer").append(t);
  setTimeout(() => t.remove(), kind === "bad" ? 6000 : 3200);
}

/* ---------- menu e seletor de cliente ---------- */
function renderNav() {
  document.getElementById("nav").replaceChildren(...SECTIONS.map(g => h("div", { class: "nav-group" },
    h("div", { class: "nav-label" }, g.group),
    g.items.map(it => h("a", { href: "#" + it.id, "aria-current": UI.view === it.id ? "page" : null, onclick: e => { e.preventDefault(); go(it.id); } },
      h("span", null, it.label), it.stage ? h("span", { class: "soon", title: `Chega na fase ${it.stage}` }, `Fase ${it.stage}`) : null)))));
}
function renderClientPicker() {
  const sel = document.getElementById("clientSelect"), hint = document.getElementById("clientHint");
  const list = clientesOrdenados();
  if (Store.state.clientes == null) { sel.disabled = true; sel.replaceChildren(h("option", null, Store.state.status === "unavailable" ? "Sem banco" : "Carregando…")); hint.textContent = ""; return; }
  if (!list.length) { sel.disabled = true; sel.replaceChildren(h("option", null, "Nenhum cliente")); hint.textContent = "Cadastre em Clientes."; return; }
  if (UI.clienteId !== NENHUM && !list.some(c => c.id === UI.clienteId)) { UI.clienteId = (list.find(c => c.status === "ativo" && !c.interno) || list.find(c => c.status === "ativo") || list[0]).id; Prefs.set("cliente", UI.clienteId); }
  sel.disabled = false;
  sel.replaceChildren(h("option", { value: NENHUM, selected: UI.clienteId === NENHUM }, "Nenhum"), ...[["ativo", "Ativos"], ["pausado", "Pausados"], ["encerrado", "Encerrados"]].map(([st, label]) => {
    const items = list.filter(c => (c.status || "ativo") === st);
    return items.length ? h("optgroup", { label }, items.map(c => h("option", { value: c.id, selected: c.id === UI.clienteId }, c.nome))) : null;
  }).filter(Boolean));
  hint.textContent = "";
}
document.getElementById("clientSelect").addEventListener("change", e => { UI.clienteId = e.target.value; Prefs.set("cliente", UI.clienteId); UI.tab = "resumo"; render(); });
function renderDbStatus() {
  const dot = document.getElementById("dbDot"), txt = document.getElementById("dbText"), s = Store.state.status;
  dot.className = "dot " + (s === "ready" ? "ok" : s === "connecting" ? "wait" : "bad");
  txt.textContent = s === "ready" ? (Store.state.clientes == null ? "Carregando dados…" : "Banco conectado") : s === "connecting" ? "Conectando ao banco…" : "Banco indisponível";
}

/* ---------- navegação e renderização ---------- */
function go(id) {
  if (!ALL.some(s => s.id === id)) id = "inicio";
  UI.view = id;
  try { history.replaceState(null, "", "#" + id); } catch {}
  closeMenu(); render(); window.scrollTo(0, 0);
}
function syncWatches() {
  if (!Store.ready || Store.state.clientes == null) return;
  const c = clienteAtual();
  Store.watchCliente(c ? c.id : null);
}
function render() {
  const st = Store.state.status;
  document.body.classList.toggle("auth", st === "login" || st === "config" || st === "connecting");
  if (st === "login" || st === "config" || st === "connecting") { renderAuth(st); return; }
  renderNav(); renderClientPicker(); syncWatches(); renderDbStatus(); renderUser();
  const VIEWS = { inicio: viewInicio, comercial: viewComercial, financeiro: viewFinanceiro, processos: viewProcessos, social: viewSocial, producao: viewProducao, planejamento: viewPlanejamento, visao: viewVisao, dias: viewDias, campanhas: viewCampanhasA, conjuntos: viewConjuntosA, anuncios: viewAnunciosA, funil: viewFunil,
    analise: viewAnalise, lancamentos: viewLancar, relatorios: viewRelatorios, historico: viewHistorico, clientes: viewClientes, dados: viewDados };
  const body = (VIEWS[UI.view] || viewInicio)();
  document.getElementById("view").replaceChildren(...[dbBanner(), ...[].concat(body)].flat(Infinity).filter(Boolean));
}
function dbBanner() {
  const s = Store.state;
  if (s.error) return h("div", { class: "banner bad", role: "alert" }, h("div", null, h("strong", null, "Algo não funcionou com o banco"), s.error, " ",
    h("button", { class: "btn btn-sm", type: "button", onclick: () => location.reload() }, "Recarregar")));
  return null;
}
function head(eyebrow, title, lead, actions) {
  return h("div", { class: "page-head" },
    h("div", { style: "min-width:0" }, h("div", { class: "eyebrow" }, eyebrow), h("h1", null, title), lead ? h("p", { class: "lead" }, lead) : null),
    actions ? h("div", { class: "actions-row" }, actions) : null);
}
function loadingPanel() {
  return h("div", { class: "panel panel-pad", "aria-busy": "true" }, h("div", { style: "display:flex;flex-direction:column;gap:12px" },
    h("div", { class: "skeleton", style: "width:40%" }), h("div", { class: "skeleton", style: "width:75%" }), h("div", { class: "skeleton", style: "width:60%" })));
}
function emptyPanel(title, text, action) {
  return h("div", { class: "panel" }, h("div", { class: "empty" }, h("div", { class: "empty-title" }, title), text ? h("p", null, text) : null, action || null));
}

/* =====================================================================
   LANÇAR DADOS DO MÊS
   ===================================================================== */
const TABS = [["resumo", "Resumo do mês"], ["campanhas", "Campanhas"], ["conjuntos", "Conjuntos"], ["anuncios", "Anúncios"], ["comercial", "Resultados comerciais"]];

function compPicker() {
  const [y, m] = UI.comp.split("-").map(Number);
  const maxComp = Fmt.currentComp(), maxY = Number(maxComp.slice(0, 4));
  const years = []; for (let a = maxY; a >= 2023; a--) years.push(a);
  const setComp = (yy, mm) => {
    let comp = `${yy}-${String(mm).padStart(2, "0")}`;
    if (comp > maxComp) { comp = maxComp; toast("Não é possível lançar meses futuros."); }
    UI.comp = comp; Prefs.set("comp", comp); render();
  };
  return h("div", { class: "comp-picker" },
    h("label", { for: "compMes", class: "sr" }, "Mês"),
    h("select", { id: "compMes", onchange: e => setComp(y, Number(e.target.value)) }, Fmt.MESES.map((n, i) => h("option", { value: i + 1, selected: i + 1 === m }, n[0].toUpperCase() + n.slice(1)))),
    h("label", { for: "compAno", class: "sr" }, "Ano"),
    h("select", { id: "compAno", onchange: e => setComp(Number(e.target.value), m) }, years.map(a => h("option", { value: a, selected: a === y }, a))));
}

function viewLancar() {
  if (Store.state.clientes == null) return [head("Lançar dados do mês", "Carregando…"), loadingPanel()];
  const c = clienteAtual();
  if (!c && (Store.state.clientes || []).length) return semCliente("Lançar dados do mês");
  if (!c) return [head("Entregas", "Lançar dados do mês"), emptyPanel("Cadastre um cliente primeiro", "Os dados de cada mês ficam ligados a um cliente.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  const top = head(c.nome, "Lançar dados do mês", null, compPicker());
  if (CD("relatorios") == null) return [top, loadingPanel()];
  const rels = CD("relatorios").slice().sort((a, b) => b.competencia.localeCompare(a.competencia));
  const chips = rels.length ? h("div", { class: "chips", "aria-label": "Meses lançados" }, h("span", { class: "chips-label" }, "Meses lançados:"),
    rels.map(r => h("button", { class: "chip", type: "button", "aria-pressed": String(r.competencia === UI.comp),
      onclick: () => { UI.comp = r.competencia; Prefs.set("comp", UI.comp); render(); } }, Fmt.monthShort(r.competencia)))) : null;
  const rel = relatorioAtual();
  if (!rel) {
    const btn = h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite() }, `Criar relatório de ${Fmt.month(UI.comp)}`);
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "Criando…";
      const b = Fmt.monthBounds(UI.comp);
      try {
        const created = await Store.ensureRelatorio(Domain.relatorioId(c.id, UI.comp), {
          clienteId: c.id, competencia: UI.comp, periodoInicio: b.inicio, periodoFim: b.fim, status: "rascunho",
          resumo: {}, observacoes: null, fonte: "Gerenciador de Anúncios da Meta (lançamento manual)", moeda: "BRL", schema: Domain.SCHEMA,
        });
        UI.tab = "resumo";
        toast(created ? `Relatório de ${Fmt.month(UI.comp)} criado.` : "Esse mês já tinha relatório. Abrindo o existente.");
      } catch (e) { toast(Store.message(e), "bad"); btn.disabled = false; btn.textContent = `Criar relatório de ${Fmt.month(UI.comp)}`; }
    });
    return [top, chips, emptyPanel(`Ainda não há relatório de ${Fmt.month(UI.comp)}`,
      "Crie o relatório do mês para lançar o resumo da conta, as campanhas, os conjuntos, os anúncios e os resultados informados pelo cliente. Cada cliente tem um único relatório por mês.", btn)];
  }
  const counts = { campanhas: MC("campanhas")?.length, conjuntos: MC("conjuntos")?.length, anuncios: MC("anuncios")?.length };
  const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Níveis de dados" }, TABS.map(([k, l]) => h("button", {
    type: "button", role: "tab", "aria-selected": String(UI.tab === k), id: "tab-" + k, onclick: () => { UI.tab = k; render(); },
  }, l, counts[k] != null ? h("span", { class: "count" }, counts[k]) : null)));
  const content = UI.tab === "campanhas" ? tabCampanhas(rel) : UI.tab === "conjuntos" ? tabConjuntos(rel) : UI.tab === "anuncios" ? tabAnuncios(rel)
    : UI.tab === "comercial" ? tabComercial(rel) : tabResumo(rel);
  const delBtn = h("button", { class: "btn btn-ghost btn-sm danger-link", type: "button", disabled: !canWrite(), onclick: () => confirmDeleteRelatorio(rel, c) }, `Excluir relatório de ${Fmt.month(rel.competencia)}`);
  return [top, chips, h("div", { class: "panel" }, tabs, h("div", { role: "tabpanel", "aria-labelledby": "tab-" + UI.tab }, content)),
    h("div", { class: "foot-meta" }, h("span", null, `Fonte: ${rel.fonte || "Gerenciador de Anúncios da Meta"} · Moeda: R$ · Atualizado em ${Fmt.datetime(rel.atualizadoEm)}`), delBtn)];
}

/* ---------- peças de exibição ---------- */
function tile(label, value, motivo, cls) {
  return h("div", { class: "tile" + (cls ? " " + cls : "") }, h("span", { class: "tile-k" }, label),
    h("span", { class: "tile-v" + (value === Fmt.NA ? " na" : "") }, value), motivo ? h("span", { class: "tile-m" }, motivo) : null);
}
function metricTile(key, r) { const d = Metrics.DEFS[key]; return tile(d.nome, Fmt.metric(d.fmt, r.v), r.v == null ? r.m : null); }
function resultadoTexto(row) {
  if (!Fmt.isNum(row.resultados)) return Fmt.NA;
  return Domain.qtdTipo(row.resultados, row.tipoResultado, row.tipoResultadoOutro);
}
function mcell(r, fmt) { return h("td", { class: "num" + (r.v == null ? " na" : ""), title: r.v == null ? r.m : null }, Fmt.metric(fmt, r.v)); }
function ncell(v, fmt) { return h("td", { class: "num" + (Fmt.isNum(v) ? "" : " na") }, fmt === "moeda" ? Fmt.money(v) : Fmt.integer(v)); }
function definicoes(keys) {
  return h("details", { class: "defs" }, h("summary", null, "Como cada métrica é calculada"),
    h("dl", null, keys.map(k => { const d = Metrics.DEFS[k]; return [h("dt", null, d.nome), h("dd", null, d.formula, ". ", d.desc)]; })),
    h("p", { class: "defs-note" }, "Campos vazios significam “não informado” e nunca entram como zero. Quando falta um dado ou o divisor é zero, a métrica aparece como “—” com o motivo. Percentuais consolidados são ponderados pelo volume, nunca médias simples."));
}
function rowActions(onEdit, onDelete) {
  return h("div", { class: "row-actions" },
    h("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !canWrite(), onclick: onEdit }, "Editar"),
    h("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !canWrite(), onclick: onDelete }, "Excluir"));
}
function tabBar(text, button) { return h("div", { class: "tab-bar" }, h("p", null, text), button || null); }

/* ---------- contexto de validação ---------- */
function formCtx(rel, kind, currentId) {
  const camps = (MC("campanhas") || []).slice().sort(byNome), conjs = (MC("conjuntos") || []).slice().sort(byNome);
  const pool = kind === "campanha" ? camps : kind === "conjunto" ? conjs : kind === "anuncio" ? (MC("anuncios") || []) : [];
  const R = rel.resumo || {};
  return {
    bounds: Fmt.monthBounds(rel.competencia),
    campanhas: Object.fromEntries(camps.map(c => [c.id, c.nome])),
    conjuntosDe: cid => Object.fromEntries(conjs.filter(s => s.campanhaId === cid).map(s => [s.id, s.nome])),
    nomesExistentes: pool.filter(x => x.id !== currentId).map(x => x.nome),
    leads: ["conversas", "leads"].includes(R.tipoResultado) ? R.resultados : null,
  };
}
const METRIC_KEYS = ["investimentoCentavos", "alcance", "impressoes", "cliquesLink", "tipoResultado", "tipoResultadoOutro", "resultados"];
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k] ?? null]));
function previewBasicas(comAlcance) {
  return data => {
    const b = Metrics.basicas(data);
    return h("div", { class: "tiles tiles-sm" }, metricTile("cpm", b.cpm), metricTile("ctr", b.ctr), metricTile("cpc", b.cpc),
      comAlcance ? metricTile("frequencia", b.frequencia) : null, metricTile("cpr", b.cpr));
  };
}

/* ---------- Resumo do mês ---------- */
function tabResumo(rel) {
  const R = rel.resumo || {};
  const filled = METRIC_KEYS.some(k => R[k] != null);
  const b = Metrics.basicas(R);
  const edit = h("button", { class: "btn " + (filled ? "" : "btn-primary"), type: "button", disabled: !canWrite(), onclick: () => openResumoForm(rel) }, filled ? "Editar resumo" : "Preencher resumo");
  const out = [tabBar(`Totais da conta de ${Fmt.date(rel.periodoInicio)} a ${Fmt.date(rel.periodoFim)}, como aparecem no Gerenciador de Anúncios.`, edit)];
  if (!filled) {
    out.push(h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Resumo ainda não preenchido"),
      h("p", null, "Comece pelos totais da conta no mês: investimento, alcance, impressões, cliques no link e o resultado principal. As métricas são calculadas automaticamente."),
      h("p", null, "Ou importe o relatório de campanhas exportado do Gerenciador de Anúncios: ele preenche as campanhas e os totais do resumo."), importBtn(rel)));
  } else {
    out.push(h("div", { class: "pad-x" },
      h("h3", { class: "group-h" }, "Números do Meta Ads"),
      h("div", { class: "tiles" },
        tile("Investimento", Fmt.money(R.investimentoCentavos)), tile("Alcance", Fmt.integer(R.alcance)), tile("Impressões", Fmt.integer(R.impressoes)),
        tile("Cliques no link", Fmt.integer(R.cliquesLink)),
        tile(R.tipoResultado ? Domain.tipoLabel(R.tipoResultado, R.tipoResultadoOutro) : "Resultado principal", Fmt.integer(R.resultados))),
      h("h3", { class: "group-h" }, "Calculados pelo sistema"),
      h("div", { class: "tiles" }, ["cpm", "ctr", "cpc", "frequencia", "cpr"].map(k => metricTile(k, b[k]))),
      rel.observacoes ? h("p", { class: "obs" }, h("strong", null, "Observações: "), rel.observacoes) : null));
  }
  // conferência com a soma das campanhas
  const camps = MC("campanhas");
  if (filled && camps && camps.length) {
    const ag = Metrics.agregar(camps), avisos = [];
    if (Fmt.isNum(R.investimentoCentavos) && ag.investimentoCentavos.v != null && ag.investimentoCentavos.v !== R.investimentoCentavos)
      avisos.push(`A soma do investimento das campanhas (${Fmt.money(ag.investimentoCentavos.v)}) é diferente do resumo (${Fmt.money(R.investimentoCentavos)}).`);
    if (Fmt.isNum(R.impressoes) && ag.impressoes.v != null && ag.impressoes.v !== R.impressoes)
      avisos.push(`A soma das impressões das campanhas (${Fmt.integer(ag.impressoes.v)}) é diferente do resumo (${Fmt.integer(R.impressoes)}).`);
    if (avisos.length) out.push(h("div", { class: "pad-x" }, h("div", { class: "banner warn" }, h("div", null, h("strong", null, "Confira os números"),
      avisos.join(" "), " Pode faltar alguma campanha ou haver diferença de período."))));
  }
  out.push(h("div", { class: "pad-x pad-b" }, definicoes(["cpm", "ctr", "cpc", "frequencia", "cpr"])));
  return out;
}
function openResumoForm(rel) {
  const R = rel.resumo || {};
  openEntityForm({
    title: `Resumo de ${Fmt.month(rel.competencia)}`, kind: "resumo",
    values: { ...R, periodoInicio: rel.periodoInicio, periodoFim: rel.periodoFim, observacoes: rel.observacoes,
      tipoResultado: R.tipoResultado ?? Domain.TIPO_PADRAO[clienteAtual()?.objetivo] ?? null },
    ctx: formCtx(rel, "resumo"), preview: previewBasicas(true),
    onSave: async d => {
      await Store.patch("relatorios", rel.id, { periodoInicio: d.periodoInicio, periodoFim: d.periodoFim, observacoes: d.observacoes, resumo: pick(d, METRIC_KEYS) });
      return "Resumo salvo.";
    },
  });
}

/* ---------- Campanhas ---------- */
function baseDoc(rel) { return { clienteId: rel.clienteId, relatorioId: rel.id, competencia: rel.competencia, schema: Domain.SCHEMA }; }
function tabCampanhas(rel) {
  const camps = MC("campanhas");
  if (camps == null) return loadingPanel();
  const add = h("div", { class: "actions-row" }, importBtn(rel), h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openCampanhaForm(rel, null) }, "Adicionar campanha"));
  if (!camps.length) return [tabBar("Uma linha por campanha, com os números do mês. Você pode importar o arquivo exportado do Gerenciador de Anúncios.", add),
    h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Nenhuma campanha lançada"),
      h("p", null, "Sem campanhas lançadas, as análises deste mês ficam só no resumo da conta. Lance as campanhas para comparar objetivos, custos e resultados."))];
  const list = camps.slice().sort(byNome);
  const ag = Metrics.agregar(list);
  const resTot = ag.resultados.length === 1 ? `${Fmt.integer(ag.resultados[0].resultados)} ${Domain.tipoLabel(ag.resultados[0].tipo, ag.resultados[0].rotulo, true)}`
    : ag.resultados.length > 1 ? "Tipos diferentes" : Fmt.NA;
  const cprTot = ag.resultados.length === 1 ? ag.resultados[0].cpr : { v: null, m: ag.resultados.length > 1 ? "Resultados de tipos diferentes não são somados" : "Sem resultados" };
  const parcial = ["investimentoCentavos", "impressoes", "cliquesLink"].some(k => ag[k].faltando > 0);
  return [tabBar("Uma linha por campanha, com os números do mês. Passe o mouse sobre “—” para ver o motivo.", add),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Campanha", "Status", "Investimento", "Alcance", "Impressões", "Freq.", "Cliques", "CTR", "CPC", "CPM", "Resultados", "Custo/resultado", ""]
        .map((t, i) => h("th", { class: i >= 2 && i <= 11 ? "num" : null }, t)))),
      h("tbody", null, list.map(c => { const b = Metrics.basicas(c); return h("tr", null,
        h("td", null, h("div", { class: "name" }, c.nome), h("div", { class: "sub" }, c.objetivo ? Domain.OBJ_META[c.objetivo] : "Objetivo não informado")),
        h("td", null, c.status ? Domain.STATUS_CAMP[c.status] : h("span", { class: "na" }, Fmt.NA)),
        ncell(c.investimentoCentavos, "moeda"), ncell(c.alcance), ncell(c.impressoes), mcell(b.frequencia, "dec"), ncell(c.cliquesLink),
        mcell(b.ctr, "pct"), mcell(b.cpc, "moeda"), mcell(b.cpm, "moeda"),
        h("td", { class: "num" }, resultadoTexto(c)), mcell(b.cpr, "moeda"),
        h("td", null, rowActions(() => openCampanhaForm(rel, c), () => confirmDeleteCampanha(c)))); })),
      h("tfoot", null, h("tr", null,
        h("td", null, h("div", { class: "name" }, "Total das campanhas"), parcial ? h("div", { class: "sub" }, "Parcial: há campanhas sem todos os dados") : null),
        h("td", null), h("td", { class: "num" }, Fmt.money(ag.investimentoCentavos.v)),
        h("td", { class: "num na", title: ag.alcance.m }, Fmt.NA), h("td", { class: "num" }, Fmt.integer(ag.impressoes.v)),
        h("td", { class: "num na", title: ag.frequencia.m }, Fmt.NA), h("td", { class: "num" }, Fmt.integer(ag.cliquesLink.v)),
        mcell(ag.ctr, "pct"), mcell(ag.cpc, "moeda"), mcell(ag.cpm, "moeda"), h("td", { class: "num" }, resTot), mcell(cprTot, "moeda"), h("td", null))))),
    h("p", { class: "table-note" }, "No total, alcance e frequência ficam de fora porque o Meta remove pessoas repetidas entre campanhas: use os números do resumo do mês. CTR, CPC e CPM do total são ponderados pelo volume.")];
}
function openCampanhaForm(rel, c) {
  const cli = clienteAtual();
  openEntityForm({
    title: c ? "Editar campanha" : "Nova campanha", kind: "campanha",
    values: c || { tipoResultado: Domain.TIPO_PADRAO[cli?.objetivo] ?? null, status: "ativa" },
    ctx: formCtx(rel, "campanha", c?.id), preview: previewBasicas(true),
    onSave: async d => {
      if (c) { await Store.patch("campanhas", c.id, d); return "Campanha atualizada."; }
      await Store.put("campanhas", Domain.novoId(d.nome), { ...baseDoc(rel), ...d }); return "Campanha adicionada.";
    },
  });
}
function confirmDeleteCampanha(c) {
  const conjs = (MC("conjuntos") || []).filter(s => s.campanhaId === c.id), ads = (MC("anuncios") || []).filter(a => a.campanhaId === c.id);
  const extra = [conjs.length && `${conjs.length} ${conjs.length === 1 ? "conjunto" : "conjuntos"}`, ads.length && `${ads.length} ${ads.length === 1 ? "anúncio" : "anúncios"}`].filter(Boolean);
  confirmDialog({
    title: `Excluir ${c.nome}?`,
    text: extra.length ? `A campanha tem ${extra.join(" e ")} ligados a ela, que também serão excluídos. A exclusão é definitiva.` : "A exclusão é definitiva e não pode ser desfeita.",
    confirmLabel: "Excluir campanha",
    onConfirm: async () => { await Store.removeAll([...ads.map(a => ["anuncios", a.id]), ...conjs.map(s => ["conjuntos", s.id]), ["campanhas", c.id]]); return "Campanha excluída."; },
  });
}

/* ---------- Conjuntos ---------- */
function tabConjuntos(rel) {
  const conjs = MC("conjuntos"), camps = MC("campanhas");
  if (conjs == null || camps == null) return loadingPanel();
  const add = h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite() || !camps.length, onclick: () => openConjuntoForm(rel, null) }, "Adicionar conjunto");
  if (!camps.length) return [tabBar("Cada conjunto fica ligado a uma campanha.", add), h("div", { class: "empty" }, h("p", null, "Lance as campanhas primeiro. Depois você liga cada conjunto à campanha correspondente."))];
  if (!conjs.length) return [tabBar("Cada conjunto fica ligado a uma campanha.", add), h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Nenhum conjunto lançado"),
    h("p", null, "Opcional. Sem conjuntos, a análise deste mês fica no nível da campanha, sem comparação entre públicos ou posicionamentos."))];
  const campNome = Object.fromEntries(camps.map(c => [c.id, c.nome]));
  const list = conjs.slice().sort((a, b) => (campNome[a.campanhaId] || "").localeCompare(campNome[b.campanhaId] || "", "pt-BR") || byNome(a, b));
  return [tabBar("Cada conjunto fica ligado a uma campanha.", add),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Conjunto", "Campanha", "Investimento", "Alcance", "Impressões", "Cliques", "CTR", "CPC", "Resultados", "Custo/resultado", ""]
        .map((t, i) => h("th", { class: i >= 2 && i <= 9 ? "num" : null }, t)))),
      h("tbody", null, list.map(s => { const b = Metrics.basicas(s); return h("tr", null,
        h("td", null, h("div", { class: "name" }, s.nome), h("div", { class: "sub clamp" }, [s.publico, s.posicionamentos].filter(Boolean).join(" · ") || "Público não informado")),
        h("td", null, campNome[s.campanhaId] || h("span", { class: "na" }, "Campanha removida")),
        ncell(s.investimentoCentavos, "moeda"), ncell(s.alcance), ncell(s.impressoes), ncell(s.cliquesLink),
        mcell(b.ctr, "pct"), mcell(b.cpc, "moeda"), h("td", { class: "num" }, resultadoTexto(s)), mcell(b.cpr, "moeda"),
        h("td", null, rowActions(() => openConjuntoForm(rel, s), () => confirmDeleteConjunto(s)))); }))))];
}
function openConjuntoForm(rel, s) {
  const cli = clienteAtual();
  openEntityForm({
    title: s ? "Editar conjunto" : "Novo conjunto", kind: "conjunto",
    values: s || { tipoResultado: Domain.TIPO_PADRAO[cli?.objetivo] ?? null, campanhaId: (MC("campanhas") || []).length === 1 ? MC("campanhas")[0].id : null },
    ctx: formCtx(rel, "conjunto", s?.id), preview: previewBasicas(true),
    onSave: async d => {
      if (s) {
        await Store.patch("conjuntos", s.id, d);
        // se o conjunto mudou de campanha, os anúncios dele acompanham
        if (d.campanhaId !== s.campanhaId) for (const a of (MC("anuncios") || []).filter(a => a.conjuntoId === s.id)) await Store.patch("anuncios", a.id, { campanhaId: d.campanhaId });
        return "Conjunto atualizado.";
      }
      await Store.put("conjuntos", Domain.novoId(d.nome), { ...baseDoc(rel), ...d }); return "Conjunto adicionado.";
    },
  });
}
function confirmDeleteConjunto(s) {
  const ads = (MC("anuncios") || []).filter(a => a.conjuntoId === s.id);
  confirmDialog({
    title: `Excluir ${s.nome}?`,
    text: ads.length ? `O conjunto tem ${ads.length} ${ads.length === 1 ? "anúncio ligado" : "anúncios ligados"}, que também serão excluídos. A exclusão é definitiva.` : "A exclusão é definitiva e não pode ser desfeita.",
    confirmLabel: "Excluir conjunto",
    onConfirm: async () => { await Store.removeAll([...ads.map(a => ["anuncios", a.id]), ["conjuntos", s.id]]); return "Conjunto excluído."; },
  });
}

/* ---------- Anúncios ---------- */
function tabAnuncios(rel) {
  const ads = MC("anuncios"), camps = MC("campanhas"), conjs = MC("conjuntos");
  if (ads == null || camps == null || conjs == null) return loadingPanel();
  const add = h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite() || !camps.length, onclick: () => openAnuncioForm(rel, null) }, "Adicionar anúncio");
  const txt = "Cada anúncio fica ligado a uma campanha e, quando houver, ao conjunto.";
  if (!camps.length) return [tabBar(txt, add), h("div", { class: "empty" }, h("p", null, "Lance as campanhas primeiro. Depois você liga cada anúncio à campanha e ao conjunto."))];
  if (!ads.length) return [tabBar(txt, add), h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Nenhum anúncio lançado"),
    h("p", null, "Opcional. Sem anúncios lançados, não há como comparar criativos neste mês."))];
  const campNome = Object.fromEntries(camps.map(c => [c.id, c.nome])), conjNome = Object.fromEntries(conjs.map(c => [c.id, c.nome]));
  const list = ads.slice().sort((a, b) => (campNome[a.campanhaId] || "").localeCompare(campNome[b.campanhaId] || "", "pt-BR") || byNome(a, b));
  return [tabBar(txt, add),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Anúncio", "Campanha / conjunto", "Ângulo e oferta", "Investimento", "Impressões", "Cliques", "CTR", "CPC", "Resultados", "Custo/resultado", ""]
        .map((t, i) => h("th", { class: i >= 3 && i <= 9 ? "num" : null }, t)))),
      h("tbody", null, list.map(a => { const b = Metrics.basicas(a); return h("tr", null,
        h("td", null, h("div", { class: "name" }, a.nome), h("div", { class: "sub" }, a.formato ? Domain.FORMATOS[a.formato] : "Formato não informado")),
        h("td", null, h("div", null, campNome[a.campanhaId] || "Campanha removida"), h("div", { class: "sub" }, a.conjuntoId ? (conjNome[a.conjuntoId] || "Conjunto removido") : "Sem conjunto informado")),
        h("td", null, h("div", { class: "clamp" }, [a.angulo, a.oferta].filter(Boolean).join(" · ") || h("span", { class: "na" }, Fmt.NA))),
        ncell(a.investimentoCentavos, "moeda"), ncell(a.impressoes), ncell(a.cliquesLink), mcell(b.ctr, "pct"), mcell(b.cpc, "moeda"),
        h("td", { class: "num" }, resultadoTexto(a)), mcell(b.cpr, "moeda"),
        h("td", null, rowActions(() => openAnuncioForm(rel, a), () => confirmDialog({
          title: `Excluir ${a.nome}?`, text: "A exclusão é definitiva e não pode ser desfeita.", confirmLabel: "Excluir anúncio",
          onConfirm: async () => { await Store.remove("anuncios", a.id); return "Anúncio excluído."; } })))); }))))];
}
function openAnuncioForm(rel, a) {
  const cli = clienteAtual();
  openEntityForm({
    title: a ? "Editar anúncio" : "Novo anúncio", kind: "anuncio",
    values: a || { tipoResultado: Domain.TIPO_PADRAO[cli?.objetivo] ?? null, campanhaId: (MC("campanhas") || []).length === 1 ? MC("campanhas")[0].id : null },
    ctx: formCtx(rel, "anuncio", a?.id), preview: previewBasicas(false),
    onSave: async d => {
      if (a) { await Store.patch("anuncios", a.id, d); return "Anúncio atualizado."; }
      await Store.put("anuncios", Domain.novoId(d.nome), { ...baseDoc(rel), ...d }); return "Anúncio adicionado.";
    },
  });
}

/* ---------- Resultados comerciais ---------- */
function funilView(rel, com) {
  const f = Metrics.funil(rel.resumo, com);
  const badge = o => h("span", { class: "src " + o }, o === "meta" ? "Meta Ads" : "Informado pelo cliente");
  return h("div", { class: "pad-x" },
    h("h3", { class: "group-h" }, "Etapas do funil"),
    h("ol", { class: "funnel" }, f.etapas.map(e => h("li", null,
      h("span", { class: "f-name" }, e.nome), badge(e.origem),
      h("span", { class: "f-val" + (e.v == null ? " na" : ""), title: e.v == null ? (e.motivo || "Não informado") : null }, e.fmt === "moeda" ? Fmt.money(e.v) : Fmt.integer(e.v))))),
    h("h3", { class: "group-h" }, "Taxas e custos"),
    h("div", { class: "tiles" }, ["ctr", "taxaCliqueLead", "taxaQualificacao", "taxaLeadVenda", "cpl", "cplq", "cacMidia", "cacTotal", "roas"].map(k => metricTile(k, f.taxas[k]))));
}
function tabComercial(rel) {
  const com = MCom();
  if (com === undefined) return loadingPanel();
  const edit = h("button", { class: "btn " + (com ? "" : "btn-primary"), type: "button", disabled: !canWrite(), onclick: () => openComercialForm(rel, com) }, com ? "Editar resultados" : "Registrar resultados comerciais");
  const bar = tabBar("O que aconteceu depois do anúncio, segundo o cliente: qualificação, vendas e receita. Fica separado dos números do Meta Ads.", edit);
  if (!com) return [bar, h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Nenhum resultado comercial informado"),
    h("p", null, "Opcional. Sem esses dados, o relatório mostra só os resultados do Meta Ads e indica que vendas e receita não foram informadas.")),
    h("div", { class: "pad-x pad-b" }, funilView(rel, null))];
  const info = (k, v) => v ? h("div", null, h("dt", null, k), h("dd", null, v)) : null;
  return [bar, funilView(rel, com),
    h("div", { class: "pad-x pad-b" },
      h("dl", { class: "info" },
        info("Critério de qualificação", com.criterioQualificacao),
        info("Atribuição das vendas", [com.criterioAtribuicao && Domain.ATRIBUICAO[com.criterioAtribuicao], com.atribuicaoDetalhe].filter(Boolean).join(" · ")),
        info("Fonte dos números", com.fonteInformacao),
        info("Custos além da mídia", com.custosExtrasCentavos != null ? `${Fmt.money(com.custosExtrasCentavos)}${com.custosExtrasDescricao ? " · " + com.custosExtrasDescricao : ""}${com.custosCompletos ? " · confirmados como completos" : " · não confirmados como completos"}` : null)),
      h("div", { class: "actions-row", style: "margin-top:12px" }, h("button", { class: "btn btn-ghost btn-sm danger-link", type: "button", disabled: !canWrite(),
        onclick: () => confirmDialog({ title: "Remover resultados comerciais?", text: "Os números informados pelo cliente neste mês serão apagados. Os dados do Meta Ads continuam.", confirmLabel: "Remover",
          onConfirm: async () => { await Store.remove("resultados_comerciais", rel.id); return "Resultados comerciais removidos."; } }) }, "Remover resultados comerciais")),
      definicoes(["taxaCliqueLead", "taxaQualificacao", "taxaLeadVenda", "cpl", "cplq", "cacMidia", "cacTotal", "roas"]))];
}
function openComercialForm(rel, com) {
  openEntityForm({
    title: `Resultados comerciais · ${Fmt.monthShort(rel.competencia)}`, kind: "comercial", values: com || {},
    ctx: formCtx(rel, "comercial"),
    preview: d => { const f = Metrics.funil(rel.resumo, d); return h("div", { class: "tiles tiles-sm" }, ["taxaQualificacao", "taxaLeadVenda", "cplq", "cacMidia", "cacTotal", "roas"].map(k => metricTile(k, f.taxas[k]))); },
    onSave: async d => {
      await Store.put("resultados_comerciais", rel.id, { ...baseDoc(rel), ...d, origem: "informado_pelo_cliente", criadoEm: com?.criadoEm });
      return "Resultados comerciais salvos.";
    },
  });
}

/* ---------- Exclusão do relatório inteiro ---------- */
async function confirmDeleteRelatorio(rel, c) {
  confirmDialog({
    title: `Excluir o relatório de ${Fmt.month(rel.competencia)}?`, loading: true,
    plan: async () => {
      const list = [];
      for (const col of ["anuncios", "conjuntos", "campanhas", "analises"]) (await Store.find(col, "relatorioId", rel.id)).forEach(d => list.push([col, d.id]));
      if (MCom()) list.push(["resultados_comerciais", rel.id]);
      const n = col => list.filter(x => x[0] === col).length;
      const parts = [["campanhas", "campanha", "campanhas"], ["conjuntos", "conjunto", "conjuntos"], ["anuncios", "anúncio", "anúncios"]].filter(([k]) => n(k)).map(([k, um, varios]) => `${n(k)} ${n(k) === 1 ? um : varios}`);
      if (n("resultados_comerciais")) parts.push("os resultados comerciais");
      if (n("analises")) parts.push("a análise estratégica do mês");
      list.push(["relatorios", rel.id]);
      return { list, text: `Serão apagados o resumo de ${c.nome}${parts.length ? ", " + parts.join(", ") : ""}. A exclusão é definitiva.` };
    },
    confirmLabel: "Excluir relatório",
    onConfirm: async plan => { await Store.removeAll(plan.list); UI.tab = "resumo"; return "Relatório excluído."; },
  });
}

/* =====================================================================
   FORMULÁRIOS E DIÁLOGOS
   ===================================================================== */
function openOverlay(node, center) {
  const prev = document.activeElement;
  const ov = h("div", { class: "overlay" + (center ? " center" : "") }, node);
  ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
  const onKey = e => { if (e.key === "Escape") close(); };
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    ov.remove(); document.removeEventListener("keydown", onKey);
    render();
    try { prev && document.contains(prev) && prev.focus(); } catch {}
  }
  document.addEventListener("keydown", onKey);
  document.getElementById("layer").append(ov);
  setTimeout(() => { const f = node.querySelector("input:not([type=hidden]),select,textarea,button.btn-primary,button.btn-danger"); f && f.focus(); }, 0);
  return close;
}

function confirmDialog({ title, text, confirmLabel, onConfirm, plan, busyLabel }) {
  const msg = h("p", null, plan ? "Verificando o que será apagado…" : text);
  const err = h("p", { class: "err-text", hidden: true });
  const btn = h("button", { class: "btn btn-danger", type: "button", disabled: !!plan }, confirmLabel);
  const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "cd-title" },
    h("h2", { id: "cd-title" }, title), msg, err,
    h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), btn));
  const close = openOverlay(box, true);
  let planned = null;
  if (plan) plan().then(p => { planned = p; msg.textContent = p.text; btn.disabled = false; btn.focus(); })
    .catch(e => { msg.textContent = Store.message(e); });
  btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = busyLabel || "Excluindo…"; err.hidden = true;
    try { const done = await onConfirm(planned); close(); toast(done || "Feito."); }
    catch (e) { err.hidden = false; err.textContent = Store.message(e); btn.disabled = false; btn.textContent = confirmLabel; }
  });
}

/** Constrói um campo a partir da especificação do núcleo (Domain.SPEC). */
function buildField(f, val, ctx, values) {
  const id = "ef-" + f.k;
  let control;
  if (f.type === "money") control = h("div", { class: "prefix" }, h("span", null, "R$"),
    h("input", { id, name: f.k, type: "text", inputmode: "decimal", value: Fmt.moneyInput(val), placeholder: "0,00", autocomplete: "off" }));
  else if (f.type === "int") control = h("input", { id, name: f.k, type: "text", inputmode: "numeric", value: Fmt.intInput(val), autocomplete: "off" });
  else if (f.type === "date") control = h("input", { id, name: f.k, type: "date", value: val || "", min: ctx.bounds?.inicio, max: ctx.bounds?.fim });
  else if (f.type === "textarea") control = h("textarea", { id, name: f.k, maxlength: f.max || 3000 }, val || "");
  else if (f.type === "bool") control = h("label", { class: "check" }, h("input", { id, name: f.k, type: "checkbox", checked: !!val }), h("span", null, f.l));
  else if (f.type === "select") control = h("select", { id, name: f.k }, selectOptions(f, val, ctx, values));
  else control = h("input", { id, name: f.k, type: "text", value: val || "", maxlength: f.max || 120, autocomplete: "off" });
  return h("div", { class: "field", id: "f-" + f.k },
    f.type === "bool" ? null : h("label", { for: id }, f.l, f.req ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null),
    control, f.help ? h("span", { class: "help" }, f.help) : null, h("span", { class: "err", id: "e-" + f.k, hidden: true }));
}
function selectOptions(f, val, ctx, values) {
  const opts = Domain.resolveOptions(f, ctx, values) || {};
  return [f.blank ? h("option", { value: "" }, f.blank) : null, Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: k === val }, l))];
}
function readForm(form, spec) {
  const raw = {};
  for (const f of Domain.flat(spec)) { const el = form.elements[f.k]; if (el) raw[f.k] = f.type === "bool" ? el.checked : el.value; }
  return raw;
}

function openEntityForm({ title, kind, values, ctx, preview, onSave, extra }) {
  const spec = Domain.SPEC[kind];
  const v = values || {};
  const body = spec.map(item => item.section ? h("div", { class: "form-section" }, item.section)
    : item.note ? h("p", { class: "form-note" }, item.note)
    : item.row ? h("div", { class: "grid2" }, item.row.map(f => buildField(f, v[f.k], ctx, v)))
    : buildField(item, v[item.k], ctx, v));
  const formErr = h("div", { class: "form-error", role: "alert", hidden: true });
  const warnBox = h("div", { class: "banner warn", role: "status", hidden: true });
  const previewBox = preview ? h("div", { class: "preview" }, h("div", { class: "form-section" }, "Calculado automaticamente"), h("div", { class: "preview-body" })) : null;
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, "Salvar");
  const form = h("form", { class: "drawer", novalidate: true, "aria-labelledby": "ef-title" },
    h("div", { class: "drawer-head" }, h("h2", { id: "ef-title" }, title), h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" }, formErr, body, extra ? extra.node : null, previewBox),
    h("div", { class: "drawer-foot" }, warnBox, h("div", { class: "foot-btns" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), submit)));
  const close = openOverlay(form);

  const refreshPreview = () => {
    if (!previewBox) return;
    const { data } = Domain.parseFields(spec, readForm(form, spec), ctx);
    previewBox.querySelector(".preview-body").replaceChildren(preview(data));
  };
  refreshPreview();
  let ack = null;
  form.addEventListener("input", () => { refreshPreview(); ack = null; submit.textContent = "Salvar"; warnBox.hidden = true; });
  form.addEventListener("change", e => {
    // opções que dependem de outro campo (ex.: conjuntos da campanha escolhida)
    const raw = readForm(form, spec);
    for (const f of Domain.flat(spec)) {
      if (f.type !== "select" || typeof f.options !== "function" || e.target.name === f.k) continue;
      const el = form.elements[f.k], keep = el.value;
      const opts = Domain.resolveOptions(f, ctx, raw) || {};
      el.replaceChildren(...selectOptions(f, Object.prototype.hasOwnProperty.call(opts, keep) ? keep : "", ctx, raw).flat().filter(Boolean));
    }
    refreshPreview();
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    formErr.hidden = true;
    if (!canWrite()) { formErr.hidden = false; formErr.textContent = "O banco não está disponível. Nada foi salvo."; return; }
    const res = Domain.validate(kind, readForm(form, spec), ctx);
    form.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
    form.querySelectorAll(".err").forEach(el => { el.hidden = true; el.textContent = ""; });
    if (!res.ok) {
      let first = null;
      for (const [k, msg] of Object.entries(res.errors)) {
        const f = form.querySelector("#f-" + k), el = form.querySelector("#e-" + k);
        if (f) { f.classList.add("invalid"); first = first || f.querySelector("input,select,textarea"); }
        if (el) { el.hidden = false; el.textContent = msg; }
      }
      formErr.hidden = false; formErr.textContent = `Corrija ${Object.keys(res.errors).length === 1 ? "o campo destacado" : "os campos destacados"} para salvar.`;
      first && first.focus();
      return;
    }
    let extraValue;
    if (extra) {
      const r2 = extra.collect();
      if (!r2.ok) { formErr.hidden = false; formErr.textContent = r2.message || "Corrija os campos destacados para salvar."; return; }
      extraValue = r2.value;
    }
    const wkey = JSON.stringify(res.warnings);
    if (res.warnings.length && ack !== wkey) {
      ack = wkey; warnBox.hidden = false; warnBox.replaceChildren(h("div", null, h("strong", null, "Antes de salvar, confira"), res.warnings.join(" ")));
      submit.textContent = "Salvar mesmo assim"; return;
    }
    submit.disabled = true; submit.textContent = "Salvando…";
    try { const msg = await onSave(res.data, extraValue); close(); toast(msg || "Salvo."); }
    catch (err) { formErr.hidden = false; formErr.textContent = Store.message(err); submit.disabled = false; submit.textContent = "Salvar"; }
  });
}

/* =====================================================================
   CLIENTES
   ===================================================================== */
function viewClientes() {
  const all = Store.state.clientes;
  const top = head("Gestão", "Clientes", "Cadastre os clientes da agência. O histórico de cada um fica separado por mês.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openClienteForm(null) }, "Novo cliente"));
  if (all == null) return [top, loadingPanel()];
  const counts = { ativo: 0, pausado: 0, encerrado: 0 };
  all.forEach(c => counts[c.status || "ativo"]++);
  const q = Domain.norm(UI.busca);
  const list = clientesOrdenados().filter(c => (UI.filtroStatus === "todos" || (c.status || "ativo") === UI.filtroStatus) && (!q || Domain.norm([c.nome, c.segmento, c.cidade].join(" ")).includes(q)));
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Filtrar por status" },
    [["ativo", `Ativos (${counts.ativo})`], ["pausado", `Pausados (${counts.pausado})`], ["encerrado", `Encerrados (${counts.encerrado})`], ["todos", `Todos (${all.length})`]]
      .map(([k, l]) => h("button", { type: "button", "aria-pressed": String(UI.filtroStatus === k), onclick: () => { UI.filtroStatus = k; render(); } }, l)));
  const search = h("input", { class: "search", id: "busca", type: "search", placeholder: "Buscar por nome, segmento ou cidade", value: UI.busca, "aria-label": "Buscar clientes",
    oninput: e => { UI.busca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("busca"); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } });
  let content;
  if (!all.length) content = h("div", { class: "empty" }, h("div", { class: "empty-title" }, "Nenhum cliente cadastrado"),
    h("p", null, "Comece pelo nome do cliente. Os outros campos são opcionais e podem ser preenchidos depois."),
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openClienteForm(null) }, "Cadastrar o primeiro cliente"));
  else if (!list.length) content = h("div", { class: "empty" }, h("p", null, "Nenhum cliente encontrado com esse filtro."));
  else {
    const acts = c => rowActions(() => openClienteForm(c), () => confirmDeleteCliente(c));
    const na = v => v ? v : h("span", { class: "na" }, Fmt.NA);
    content = [
      h("div", { class: "table-wrap clients" }, h("table", null,
        h("thead", null, h("tr", null, h("th", null, "Cliente"), h("th", null, "Serviços"), h("th", { class: "num" }, "Mensalidade"), h("th", null, "Vencimento"), h("th", null, "Status"), h("th", null, "Atualizado em"), h("th", null))),
        h("tbody", null, list.map(c => h("tr", null,
          h("td", null, h("div", { class: "name" }, c.nome), h("div", { class: "sub" }, [c.segmento, c.cidade].filter(Boolean).join(" · "))),
          h("td", null, (c.servicos || []).length ? h("div", { class: "tags" }, c.servicos.map(x => h("span", { class: "tag" }, Domain.SERVICOS[x]))) : na(null)),
          h("td", { class: "num" }, c.mensalidadeCentavos != null ? Fmt.money(c.mensalidadeCentavos) : na(null)),
          h("td", null, na(c.diaVencimento && `Dia ${c.diaVencimento}`)),
          h("td", null, h("span", { class: "pill " + (c.status || "ativo") }, Domain.STATUS[c.status || "ativo"])),
          h("td", { class: "sub" }, Fmt.datetime(c.atualizadoEm)), h("td", null, acts(c))))))),
      h("div", { class: "cards" }, list.map(c => h("div", { class: "card-row" },
        h("div", { class: "card-top" }, h("div", { style: "min-width:0" }, h("div", { class: "name" }, c.nome), h("div", { class: "sub" }, [c.segmento, c.cidade].filter(Boolean).join(" · "))),
          h("span", { class: "pill " + (c.status || "ativo") }, Domain.STATUS[c.status || "ativo"])),
        h("div", { class: "sub" }, [c.objetivo && Domain.OBJETIVOS[c.objetivo], c.ticketMedioCentavos != null && "Ticket " + Fmt.money(c.ticketMedioCentavos)].filter(Boolean).join(" · ")),
        acts(c)))),
    ];
  }
  return [top, h("div", { class: "panel" }, h("div", { class: "toolbar" }, seg, search), content)];
}

function openClienteForm(c) {
  const editing = !!c, v = c || { status: "ativo" };
  const field = (id, label, control, help, req) => h("div", { class: "field", id: "f-" + id },
    h("label", { for: "cf-" + id }, label, req ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null),
    control, help ? h("span", { class: "help" }, help) : null, h("span", { class: "err", id: "e-" + id, hidden: true }));
  const input = (id, attrs) => h("input", { id: "cf-" + id, name: id, ...attrs });
  const select = (id, opts, val, blank) => h("select", { id: "cf-" + id, name: id }, blank ? h("option", { value: "" }, blank) : null,
    Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: k === val }, l)));
  const formErr = h("div", { class: "form-error", role: "alert", hidden: true });
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, editing ? "Salvar alterações" : "Cadastrar cliente");
  const form = h("form", { class: "drawer", novalidate: true, "aria-labelledby": "cf-title" },
    h("div", { class: "drawer-head" }, h("h2", { id: "cf-title" }, editing ? "Editar cliente" : "Novo cliente"), h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" }, formErr,
      field("nome", "Nome do cliente", input("nome", { type: "text", value: v.nome || "", maxlength: 80, autocomplete: "off" }), null, true),
      h("div", { class: "grid2" },
        field("segmento", "Segmento", input("segmento", { type: "text", value: v.segmento || "", maxlength: 80, placeholder: "Ex.: clínica de estética" })),
        field("cidade", "Cidade", input("cidade", { type: "text", value: v.cidade || "", maxlength: 80, placeholder: "Ex.: Blumenau - SC" }))),
      field("objetivo", "Objetivo principal das campanhas", select("objetivo", Domain.OBJETIVOS, v.objetivo, "Não definido"), "Define o tipo de resultado sugerido nos lançamentos (conversas, leads ou compras)."),
      h("div", { class: "grid2" },
        field("ticketMedio", "Ticket médio", h("div", { class: "prefix" }, h("span", null, "R$"), input("ticketMedio", { type: "text", inputmode: "decimal", value: Fmt.moneyInput(v.ticketMedioCentavos), placeholder: "0,00" })), "Opcional. Ajuda a interpretar o custo por resultado."),
        field("inicioGestao", "Início da gestão", input("inicioGestao", { type: "date", value: v.inicioGestao || "", max: Fmt.todayISO() }))),
      field("status", "Status", select("status", Domain.STATUS, v.status || "ativo"), "Clientes encerrados continuam com o histórico guardado."),
      h("label", { class: "check" }, h("input", { type: "checkbox", name: "interno", value: "1", checked: !!v.interno }), h("span", null, "Perfil da própria agência (não entra na receita nem na contagem de clientes)")),
      h("div", { class: "form-section" }, "Contrato"),
      h("div", { class: "field", id: "f-servicos" }, h("span", { class: "flabel" }, "Serviços contratados"),
        h("div", { class: "checks" }, Object.entries(Domain.SERVICOS).map(([k, l]) => h("label", { class: "check" }, h("input", { type: "checkbox", name: "servicos", value: k, checked: (v.servicos || []).includes(k) }), h("span", null, l))))),
      h("div", { class: "grid2" },
        field("mensalidade", "Mensalidade", h("div", { class: "prefix" }, h("span", null, "R$"), input("mensalidade", { type: "text", inputmode: "decimal", value: Fmt.moneyInput(v.mensalidadeCentavos), placeholder: "0,00" })), "Valor que o cliente paga por mês."),
        field("diaVencimento", "Dia do vencimento", input("diaVencimento", { type: "text", inputmode: "numeric", value: v.diaVencimento || "", placeholder: "Ex.: 10" }))),
      h("div", { class: "form-section" }, "Contato"),
      h("div", { class: "grid2" },
        field("contatoNome", "Nome do contato", input("contatoNome", { type: "text", value: v.contatoNome || "", maxlength: 80 })),
        field("instagram", "Instagram", h("div", { class: "prefix" }, h("span", null, "@"), input("instagram", { type: "text", value: v.instagram || "", maxlength: 60 })))),
      h("div", { class: "grid2" },
        field("telefone", "Telefone / WhatsApp", input("telefone", { type: "tel", value: v.telefone || "", maxlength: 30 })),
        field("email", "E-mail", input("email", { type: "email", value: v.email || "", maxlength: 120 }))),
      field("observacoes", "Observações", h("textarea", { id: "cf-observacoes", name: "observacoes", maxlength: 2000 }, v.observacoes || ""))),
    h("div", { class: "drawer-foot" }, h("div", { class: "foot-btns" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), submit)));
  const close = openOverlay(form);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!canWrite()) { formErr.hidden = false; formErr.textContent = "O banco não está disponível. Nada foi salvo."; return; }
    const fd = new FormData(form); const raw = Object.fromEntries(fd.entries()); raw.servicos = fd.getAll("servicos"); raw.interno = fd.has("interno");
    const res = Domain.validateCliente(raw, Store.state.clientes || [], c?.id);
    form.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
    form.querySelectorAll(".err").forEach(el => { el.hidden = true; el.textContent = ""; });
    formErr.hidden = true;
    if (!res.ok) {
      let first = null;
      for (const [k, msg] of Object.entries(res.errors)) {
        const f = form.querySelector("#f-" + k), el = form.querySelector("#e-" + k);
        if (f) { f.classList.add("invalid"); first = first || f.querySelector("input,select,textarea"); }
        if (el) { el.hidden = false; el.textContent = msg; }
      }
      first && first.focus(); return;
    }
    submit.disabled = true; submit.textContent = "Salvando…";
    try {
      if (editing) await Store.patch("clientes", c.id, res.data);
      else { const id = Domain.novoId(res.data.nome); await Store.put("clientes", id, res.data); UI.clienteId = id; Prefs.set("cliente", id); }
      close(); toast(editing ? "Cadastro atualizado." : `${res.data.nome} cadastrado.`);
    } catch (err) { formErr.hidden = false; formErr.textContent = Store.message(err); submit.disabled = false; submit.textContent = editing ? "Salvar alterações" : "Cadastrar cliente"; }
  });
}

const NOMES_COLECAO = { relatorios: "relatórios", campanhas: "campanhas", conjuntos: "conjuntos", anuncios: "anúncios", resultados_comerciais: "resultados comerciais", analises: "análises", testes: "testes", diarios: "meses com dados diários", criativos: "imagens de criativos", instagram: "meses com dados do Instagram", financeiro: "lançamentos financeiros", tarefas: "tarefas", posts: "posts", planejamentos: "planejamentos", documentos: "documentos" };
function confirmDeleteCliente(c) {
  const msg = h("p", null, "Verificando se há dados ligados a este cliente…");
  const btn = h("button", { class: "btn btn-danger", type: "button", disabled: true }, "Excluir cliente");
  const alt = h("button", { class: "btn", type: "button", hidden: true }, "Marcar como encerrado");
  const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "dl-title" }, h("h2", { id: "dl-title" }, `Excluir ${c.nome}?`), msg,
    h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), alt, btn));
  const close = openOverlay(box, true);
  alt.addEventListener("click", async () => {
    try { await Store.patch("clientes", c.id, { status: "encerrado" }); close(); toast(`${c.nome} marcado como encerrado.`); } catch (e) { toast(Store.message(e), "bad"); }
  });
  Store.dependentes(c.id).then(deps => {
    const keys = Object.keys(deps);
    if (keys.length) {
      msg.textContent = `Este cliente tem dados registrados (${keys.map(k => `${deps[k]} ${NOMES_COLECAO[k]}`).join(", ")}). Para não deixar registros soltos, exclua esses dados antes ou marque o cliente como encerrado, o que mantém o histórico.`;
      alt.hidden = false; return;
    }
    msg.textContent = "Este cliente ainda não tem dados registrados. A exclusão é definitiva e não pode ser desfeita.";
    btn.disabled = false;
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "Excluindo…";
      try { await Store.remove("clientes", c.id); if (UI.clienteId === c.id) { UI.clienteId = null; Prefs.set("cliente", null); } close(); toast(`${c.nome} excluído.`); }
      catch (e) { msg.textContent = Store.message(e); btn.disabled = false; btn.textContent = "Excluir cliente"; }
    });
  }).catch(e => { msg.textContent = Store.message(e); });
}

/* =====================================================================
   DADOS E BACKUP
   ===================================================================== */
function viewDados() {
  const all = Store.state.clientes;
  const top = head("Gestão", "Dados e backup", "Os dados ficam no banco desta página e continuam salvos entre sessões e dispositivos. Exporte um backup de vez em quando.");
  if (all == null && Store.state.status !== "unavailable") return [top, loadingPanel()];
  const exportBtn = h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite() }, "Exportar backup completo (JSON)");
  const csvBtn = h("button", { class: "btn", type: "button", disabled: !canWrite() || !(all || []).length }, "Exportar clientes (CSV)");
  const stamp = () => { const d = new Date(); return `${Fmt.todayISO()}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`; };
  const handle = async (btn, label, fn) => {
    btn.disabled = true; btn.textContent = "Preparando…";
    try { await fn(); toast("Arquivo pronto para salvar."); }
    catch (e) {
      if (e?.code === "declined") toast("Download cancelado.");
      else if (["invalid_argument", "resource_exhausted", "quota_exceeded", "revoked"].includes(e?.code)) toast(Store.message(e), "bad");
      else toast("Não foi possível gerar o arquivo nesta visualização.", "bad");
    } finally { btn.disabled = false; btn.textContent = label; }
  };
  exportBtn.addEventListener("click", () => handle(exportBtn, "Exportar backup completo (JSON)", async () => {
    const data = await Store.dumpAll();
    await Downloads.save(`backup-garcia-relatorios_${stamp()}.json`, JSON.stringify({ sistema: "Relatórios Garcia Marketing", versaoEsquema: Domain.SCHEMA,
      exportadoEm: new Date().toISOString(), moeda: "BRL", observacao: "Valores monetários em centavos (campos terminados em Centavos). null = não informado.",
      definicoesMetricas: Object.fromEntries(Object.entries(Metrics.DEFS).map(([k, d]) => [k, d.formula])), colecoes: data }, null, 2));
  }));
  csvBtn.addEventListener("click", () => handle(csvBtn, "Exportar clientes (CSV)", async () => {
    const esc = v => { const s = v == null ? "" : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const cols = [["Nome", c => c.nome], ["Segmento", c => c.segmento], ["Cidade", c => c.cidade], ["Objetivo principal", c => c.objetivo && Domain.OBJETIVOS[c.objetivo]],
      ["Ticket médio (R$)", c => Fmt.moneyInput(c.ticketMedioCentavos)], ["Início da gestão", c => c.inicioGestao ? Fmt.date(c.inicioGestao) : ""],
      ["Status", c => Domain.STATUS[c.status || "ativo"]], ["Observações", c => c.observacoes]];
    const lines = [cols.map(c => esc(c[0])).join(";"), ...clientesOrdenados().map(c => cols.map(([, f]) => esc(f(c))).join(";"))];
    await Downloads.save(`clientes-garcia_${stamp()}.csv`, "﻿" + lines.join("\r\n"));
  }));
  const n = (all || []).length;
  return [top,
    h("div", { class: "stats" },
      h("div", { class: "panel stat" }, h("span", { class: "stat-v" }, Fmt.integer(n)), h("span", { class: "stat-k" }, "clientes cadastrados")),
      h("div", { class: "panel stat" }, h("span", { class: "stat-v" }, Fmt.integer((all || []).filter(c => (c.status || "ativo") === "ativo").length)), h("span", { class: "stat-k" }, "clientes ativos")),
      h("div", { class: "panel stat" }, h("span", { class: "stat-v", style: "font-size:22px;line-height:1.25" }, Store.state.status === "ready" ? "Conectado" : "Indisponível"), h("span", { class: "stat-k" }, "banco de dados"))),
    h("div", { class: "panel panel-pad", style: "display:flex;flex-direction:column;gap:14px" },
      h("h2", null, "Exportar"),
      h("p", { class: "lead", style: "margin:0" }, "O backup completo inclui todas as tabelas do sistema e as fórmulas usadas. O CSV de clientes abre direto no Excel ou no Google Planilhas."),
      h("div", { class: "actions-row" }, exportBtn, csvBtn),
      ),
    restorePanel(),
    sobrePanel(),
    h("div", { class: "panel panel-pad", style: "display:flex;flex-direction:column;gap:8px" },
      h("h2", null, "Acesso"),
      h("p", { class: "lead", style: "margin:0" }, "Só a sua conta lê e altera estes dados. Clientes recebem apenas os PDFs."))];
}

/* ---------- menu do celular ---------- */
const side = document.getElementById("side"), menuBtn = document.getElementById("menuBtn");
let scrim = null;
function closeMenu() { side.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); scrim && scrim.remove(); scrim = null; }
menuBtn.addEventListener("click", () => {
  if (side.classList.contains("open")) return closeMenu();
  side.classList.add("open"); menuBtn.setAttribute("aria-expanded", "true");
  scrim = h("div", { class: "scrim", onclick: closeMenu }); document.body.append(scrim);
});


/* ---------- restaurar backup ---------- */
const ID_OK = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
function lerBackup(obj) {
  if (!obj || typeof obj !== "object" || !obj.colecoes || typeof obj.colecoes !== "object") throw new Error("O arquivo não é um backup deste sistema.");
  const plano = [], contagem = {};
  for (const col of [...Domain.COLLECTIONS, ...Domain.AGENCIA]) {
    const arr = obj.colecoes[col];
    if (arr == null) continue;
    if (!Array.isArray(arr)) throw new Error(`A tabela “${col}” do backup está em formato inválido.`);
    for (const d of arr) {
      if (!d || typeof d !== "object" || !ID_OK.test(String(d.id || ""))) throw new Error(`Há um registro sem identificador válido em “${col}”.`);
      if (Domain.DEPENDENTES.includes(col) && !d.clienteId) throw new Error(`Há um registro sem cliente em “${col}”.`);
      const { id, ...data } = d;
      plano.push([col, id, data]);
    }
    contagem[col] = arr.length;
  }
  if (!plano.length) throw new Error("O backup não tem registros.");
  return { plano, contagem, exportadoEm: obj.exportadoEm };
}
const RESTORE = { status: null, b: null };
const RESTORE_NOMES = { clientes: "clientes", relatorios: "meses", campanhas: "campanhas", conjuntos: "conjuntos", anuncios: "anúncios", resultados_comerciais: "resultados comerciais", analises: "análises", testes: "testes", diarios: "meses com dados diários", criativos: "imagens de criativos", instagram: "meses com dados do Instagram", tarefas: "tarefas", financeiro: "lançamentos financeiros", recorrencias: "despesas fixas", reservas: "reservas", posts: "posts", planejamentos: "planejamentos", leads: "oportunidades comerciais", documentos: "documentos de processos" };
function restorePanel() {
  const status = h("p", { class: "lead", id: "restoreStatus", style: "margin:0" }, RESTORE.status || "Escolha um arquivo de backup (.json) exportado por este sistema. Registros com o mesmo identificador são substituídos pela versão do backup; registros que não estão no backup continuam como estão.");
  const input = h("input", { id: "restoreFile", type: "file", accept: ".json,application/json", class: "file", disabled: !canWrite() });
  const setStatus = t => { RESTORE.status = t; const el = document.getElementById("restoreStatus"); if (el) el.textContent = t; };
  input.addEventListener("change", () => {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { RESTORE.b = lerBackup(JSON.parse(String(rd.result))); }
      catch (e) { RESTORE.b = null; setStatus(e instanceof SyntaxError ? "O arquivo não é um JSON válido." : e.message); render(); return; }
      const b = RESTORE.b;
      setStatus(`Backup${b.exportadoEm ? " de " + Fmt.datetime(b.exportadoEm) : ""}: ${Object.entries(b.contagem).filter(([, n]) => n).map(([k, n]) => `${n} ${RESTORE_NOMES[k]}`).join(", ")}.`);
      render();
    };
    rd.onerror = () => { setStatus("Não foi possível ler o arquivo."); render(); };
    rd.readAsText(f);
  });
  const actions = h("div", { class: "actions-row" });
  if (RESTORE.b) {
    const b = RESTORE.b;
    actions.append(
      h("button", { class: "btn btn-primary", type: "button", id: "restoreGo", disabled: !canWrite(), onclick: () => confirmDialog({
        title: "Restaurar o backup?", text: `Serão gravados ${b.plano.length} registros. Os que já existem com o mesmo identificador serão substituídos pela versão do backup.`,
        confirmLabel: "Restaurar agora", busyLabel: "Restaurando…",
        onConfirm: async () => {
          let i = 0;
          for (let k = 0; k < b.plano.length; k += 50) { const lote = b.plano.slice(k, k + 50); await Store.putMany(lote); i += lote.length; setStatus(`Restaurando… ${i} de ${b.plano.length}`); }
          RESTORE.b = null; RESTORE.status = `Backup restaurado: ${i} registros gravados.`;
          return "Backup restaurado.";
        },
      }) }, "Restaurar este backup"),
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => { RESTORE.b = null; RESTORE.status = null; render(); } }, "Cancelar"));
  }
  return h("div", { class: "panel panel-pad", style: "display:flex;flex-direction:column;gap:12px" },
    h("h2", null, "Restaurar backup"), status, RESTORE.b ? null : [h("label", { for: "restoreFile", class: "sr" }, "Arquivo de backup"), input], actions);
}
function sobrePanel() {
  const item = (t, d) => h("li", null, h("strong", null, t + " "), d);
  return h("div", { class: "panel panel-pad", style: "display:flex;flex-direction:column;gap:10px" },
    h("h2", null, "Sobre o sistema"),
    h("ul", { class: "doc-list" },
      item("Origem dos dados.", "Lançamento manual a partir do Gerenciador de Anúncios da Meta, mais resultados comerciais informados pelo cliente. Não há importação automática nem integração com a API da Meta."),
      item("Onde ficam os dados.", "No banco PostgreSQL do Supabase (plano gratuito), protegido por login. As regras do banco só deixam a sua conta ler e gravar os dados."),
      item("Granularidade.", "Mensal nas análises gerais. No Calendário diário, com o CSV diário do Meta importado, qualquer intervalo de datas pode ser comparado com o período anterior ou com as mesmas datas do mês anterior; alcance e frequência ficam só no mensal, porque não são somáveis entre dias."),
      item("Cálculos.", "Todas as telas e o PDF usam o mesmo módulo de cálculo. Dinheiro é guardado em centavos, nada é arredondado antes da exibição, campos vazios nunca viram zero e percentuais consolidados são ponderados."),
      item("Alcance e frequência.", "Não são somados entre campanhas nem entre meses, porque o Meta remove pessoas repetidas."),
      item("Backup.", "O backup JSON inclui todas as tabelas (até mil registros por tabela por exportação) e as fórmulas usadas. A restauração grava por cima de registros com o mesmo identificador e não apaga os demais."),
      item("PDF.", "Gerado no navegador com as fontes da identidade. Sempre reflete os dados salvos no momento em que é gerado.")));
}

/* ---------- importação do CSV do Gerenciador de Anúncios ---------- */
function importBtn(rel) {
  const input = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, id: "metaCsv" });
  const btn = h("button", { class: "btn", type: "button", disabled: !canWrite(), onclick: () => input.click() }, "Importar CSV do Meta");
  input.addEventListener("change", () => {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { input.value = ""; openImportMeta(rel, String(rd.result), f.name); };
    rd.onerror = () => toast("Não foi possível ler o arquivo.", "bad");
    rd.readAsText(f, "utf-8");
  });
  return h("span", { class: "import-wrap" }, btn, input);
}
function openImportMeta(rel, text, fileName) {
  if (MetaCsv.importarDiario(text).ok) { openImportDiario(clienteAtual(), text, fileName); return; }
  const r = MetaCsv.importar(text, rel.competencia);
  if (!r.ok) {
    const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "im-t" },
      h("h2", { id: "im-t" }, "Não foi possível importar"), h("p", null, r.erro),
      h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => close() }, "Entendi")));
    const close = openOverlay(box, true); return;
  }
  const existentes = mesCol("campanhas", rel.id) || [];
  const porNome = Object.fromEntries(existentes.map(c => [Domain.norm(c.nome), c]));
  const R = rel.resumo || {};
  const resumoVazio = !METRIC_KEYS.some(k => R[k] != null);
  const chk = h("input", { type: "checkbox", id: "imResumo", checked: resumoVazio });
  const err = h("p", { class: "err-text", hidden: true });
  const go_ = h("button", { class: "btn btn-primary", type: "button" }, `Importar ${r.campanhas.length} ${r.campanhas.length === 1 ? "campanha" : "campanhas"}`);
  const drawer = h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "im-title" },
    h("div", { class: "drawer-head" }, h("h2", { id: "im-title" }, "Importar do Meta"), h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" },
      h("p", { class: "lead", style: "margin:0" }, `${fileName} · ${Fmt.date(r.periodo.inicio)} a ${Fmt.date(r.periodo.fim)}`),
      h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", null, h("tr", null, ["Campanha", "Investimento", "Impressões", "Resultados", ""].map((t, i) => h("th", { class: i && i < 4 ? "num" : null }, t)))),
        h("tbody", null, r.campanhas.map(c => h("tr", null, h("td", { style: "white-space:normal" }, c.nome), ncell(c.investimentoCentavos, "moeda"), ncell(c.impressoes),
          h("td", { class: "num" }, resultadoTexto(c)), h("td", null, porNome[Domain.norm(c.nome)] ? h("span", { class: "flag" }, "Atualiza") : h("span", { class: "flag ok" }, "Nova"))))))),
      r.semEntrega.length ? h("p", { class: "form-note", style: "margin:0" }, `Ignoradas por não terem veiculação no período: ${r.semEntrega.join(", ")}.`) : null,
      h("div", { class: "form-section" }, "Resumo do mês"),
      h("div", { class: "tiles tiles-sm" }, tile("Investimento", Fmt.money(r.resumo.investimentoCentavos)), tile("Impressões", Fmt.integer(r.resumo.impressoes)),
        tile("Cliques no link", Fmt.integer(r.resumo.cliquesLink)), tile(r.resumo.tipoResultado ? Domain.tipoLabel(r.resumo.tipoResultado, r.resumo.tipoResultadoOutro) : "Resultados", Fmt.integer(r.resumo.resultados))),
      h("label", { class: "check" }, chk, h("span", null, resumoVazio ? "Preencher o resumo do mês com estes totais" : "Substituir investimento, impressões, cliques e resultados do resumo por estes totais (o resumo já tem dados)")),
      h("div", { class: "banner warn" }, h("div", null, h("strong", null, "Antes de importar"), h("ul", { class: "doc-list", style: "margin-top:6px" }, r.avisos.map(a => h("li", null, a))))),
      h("p", { class: "form-note", style: "margin:0" }, "Campanhas com o mesmo nome de uma já lançada neste mês são atualizadas; as outras são criadas. Nada é apagado."),
      err),
    h("div", { class: "drawer-foot" }, h("div", { class: "foot-btns" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), go_)));
  const close = openOverlay(drawer);
  go_.addEventListener("click", async () => {
    go_.disabled = true; go_.textContent = "Importando…"; err.hidden = true;
    try {
      for (const c of r.campanhas) {
        const data = { nome: c.nome, investimentoCentavos: c.investimentoCentavos, alcance: c.alcance, impressoes: c.impressoes, cliquesLink: c.cliquesLink,
          resultados: c.resultados, tipoResultado: c.tipoResultado, tipoResultadoOutro: c.tipoResultadoOutro, origem: "meta_csv", indicadorMeta: c.indicadorMeta };
        const ex = porNome[Domain.norm(c.nome)];
        if (ex) await Store.patch("campanhas", ex.id, data);
        else await Store.put("campanhas", Domain.novoId(c.nome), { ...baseDoc(rel), objetivo: null, status: null, periodoInicio: null, periodoFim: null, observacoes: null, ...data });
      }
      if (chk.checked) {
        const p = r.principal, obs = p && p.outrosCentavos > 0
          ? `Importado do Meta. Custo por ${Domain.tipoLabel(p.tipo, p.outro, true)} só nas campanhas desse tipo: ${Fmt.money(p.investimentoCentavos / p.resultados)} (o resumo divide todo o investimento, incluindo ${Fmt.money(p.outrosCentavos)} de campanhas com outros objetivos).` : null;
        await Store.patch("relatorios", rel.id, { periodoInicio: r.periodo.inicio, periodoFim: r.periodo.fim, fonte: "Gerenciador de Anúncios da Meta (arquivo CSV importado)",
          resumo: { ...R, ...r.resumo, alcance: R.alcance ?? null }, ...(obs && !rel.observacoes ? { observacoes: obs } : {}) });
      }
      close(); UI.tab = "campanhas"; render(); toast("Importação concluída.");
    } catch (e) { err.hidden = false; err.textContent = Store.message(e); go_.disabled = false; go_.textContent = "Tentar de novo"; }
  });
}
