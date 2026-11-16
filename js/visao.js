"use strict";
/* =====================================================================
   VISÃO GERAL DO TRÁFEGO
   - Todos os clientes: números da carteira, gráfico e tabela por cliente.
   - Por cliente: indicadores com metas, funil e evolução.
   Toda conta passa por Desempenho (núcleo).
   ===================================================================== */
UI.visaoModo = Prefs.get("visaoModo") === "cliente" ? "cliente" : "todos";
UI.cartSort = { k: "investimentoCentavos", dir: -1 };
const DIND = Desempenho.IND;

/* ---------- dados ---------- */
const dadosTrafegoProntos = () => ["relatorios", "resultados_comerciais", "campanhas"].every(c => AG(c) != null);
function indiceTrafego() {
  const com = {}, camps = {};
  for (const d of AG("resultados_comerciais") || []) com[d.id] = d;
  for (const d of AG("campanhas") || []) (camps[d.relatorioId] ||= []).push(d);
  return { com, camps, rels: AG("relatorios") || [] };
}
function linhasDe(c, comps, idx) {
  idx = idx || indiceTrafego();
  return idx.rels.filter(r => r.clienteId === c.id && comps.includes(r.competencia)).sort((a, b) => a.competencia.localeCompare(b.competencia))
    .map(r => Desempenho.linha({ comp: r.competencia, clienteId: c.id, resumo: r.resumo, com: idx.com[r.id], campanhas: idx.camps[r.id], metas: c.metas,
      periodoInicio: r.periodoInicio, periodoFim: r.periodoFim }));
}
function compsVisao() {
  const cur = Fmt.compsUntil(UI.comp, UI.dur);
  return { cur, prev: Fmt.compsUntil(Fmt.previousComp(cur[0]), UI.dur) };
}
/** Clientes que entram na carteira de tráfego */
function clientesTrafego(idx) {
  const comRel = new Set(idx.rels.map(r => r.clienteId));
  return clientesOrdenados().filter(c => !c.interno && (comRel.has(c.id) || ((c.servicos || []).includes("trafego") && (c.status || "ativo") === "ativo")));
}

/* ---------- peças ---------- */
function modoVisao() {
  const set = m => { UI.visaoModo = m; Prefs.set("visaoModo", m); render(); };
  return h("div", { class: "seg", role: "group", "aria-label": "Modo da visão geral" },
    h("button", { type: "button", "aria-pressed": String(UI.visaoModo === "todos"), onclick: () => set("todos") }, "Todos os clientes"),
    h("button", { type: "button", "aria-pressed": String(UI.visaoModo === "cliente"), onclick: () => set("cliente") }, "Por cliente"));
}
const SAUDE = { ok: "No alvo", perto: "Atenção", fora: "Fora da meta", sem: "Sem metas" };
function saudeTag(aval, curto) {
  const st = Desempenho.saude(aval);
  const det = aval.filter(a => a.status === "fora" || a.status === "perto").map(a => `${a.nome}: ${Fmt.metric(a.fmt, a.v)} (meta ${Fmt.metric(a.fmt, a.alvo)})`).join(" · ");
  return h("span", { class: "saude " + st, title: det || (st === "sem" ? "Cadastre metas para este cliente" : "Todas as metas avaliadas estão no alvo") },
    h("i", { "aria-hidden": "true" }), curto ? null : SAUDE[st], curto ? h("span", { class: "sr" }, SAUDE[st]) : null);
}
/** Cartão de indicador com comparação, nota e meta */
function kpiInd(k, cur, prev, aval, label) {
  const d = DIND[k], el = kpi(label || d.nome, cur[k], prev && prev[k], d.fmt, d.dir);
  el.title = d.formula;
  if (cur[k] && cur[k].nota) el.append(h("span", { class: "tile-m" }, cur[k].nota));
  const m = (aval || []).find(a => a.ind === k);
  if (m) {
    const alvo = m.volume && d.fmt === "int" ? Math.round(m.alvo) : m.alvo;
    const pre = m.status === "info" ? "Planejado" : d.dir > 0 || m.volume ? "Meta ≥" : "Meta ≤";
    el.append(h("span", { class: "meta-tag " + m.status }, `${pre} ${Fmt.metric(d.fmt, alvo)}`, m.status === "info" && m.pct != null ? ` · ${Fmt.integer(m.pct)}% usado` : ""));
    el.classList.add("kpi-meta-" + m.status);
  }
  return el;
}
const grupoKpis = (titulo, ks, cur, prev, aval) => [h("h3", { class: "group-h" }, titulo), h("div", { class: "kpis vg" }, ks.map(k => kpiInd(k, cur, prev, aval)))];
function notaPeriodo(cur, prev, linhasCur, linhasPrev) {
  const parciais = linhasCur.filter(r => r.dias != null && r.dias < r.diasMes);
  return [h("p", { class: "period-note" }, `Período: ${Fmt.periodLabel(cur)} · comparado com ${Fmt.periodLabel(prev)}${linhasPrev.length ? "" : " (sem dados)"}`),
    parciais.length ? h("p", { class: "period-note partial" }, "Há mês parcial no período. Totais não são comparáveis com meses completos; compare taxas e custos. Metas de volume foram ajustadas aos dias lançados.") : null];
}

/* =====================================================================
   ENTRADA
   ===================================================================== */
function viewVisaoGeral() {
  // o dashboard abre no mês atual (dados sincronizados até ontem); depois respeita o período escolhido
  if (!UI.dashIni) { UI.dashIni = true; UI.comp = Fmt.currentComp(); }
  if (Store.state.clientes == null || !dadosTrafegoProntos()) return [head("Tráfego pago", "Dashboard"), loadingPanel()];
  const c = clienteAtual();
  if (UI.visaoModo === "cliente" && c) {
    const plats = Domain.plataformasDe(c);
    if (UI.dashPlat && !plats.includes(UI.dashPlat)) UI.dashPlat = null;
    return [abasCliente(c), ...(UI.dashPlat ? visaoPlataforma(c, UI.dashPlat) : visaoCliente(c))];
  }
  return viewDashboard();
}
function abrirCliente(id) {
  UI.clienteId = id; Prefs.set("cliente", id); UI.visaoModo = "cliente"; Prefs.set("visaoModo", "cliente"); UI.tab = "resumo"; UI.dashPlat = null;
  go("visao");
}

/* =====================================================================
   POR CLIENTE
   ===================================================================== */
function visaoCliente(c) {
  const idx = indiceTrafego(), PER = periodoDash();
  const lc = PER.linhas(c, "cur"), lp = PER.linhas(c, "prev");
  const K = Desempenho.consolidar(lc), P = lp.length ? Desempenho.consolidar(lp) : null;
  const aval = Desempenho.avaliar(K, c.metas, lc);
  const btnMetas = h("button", { class: "btn", type: "button", disabled: !canWrite(), onclick: () => openMetasForm(c) }, Object.values(c.metas || {}).some(Fmt.isNum) ? "Editar metas" : "Cadastrar metas");
  const temDiario = diariasDe(c).length > 0;
  const btnPdf = temDiario ? h("button", { class: "btn btn-primary", type: "button", onclick: () => { const b = PER.bounds(); UI.dCli = c.id; UI.dIni = b.ini; UI.dFim = b.fim; UI.calMes = b.fim.slice(0, 7); UI.pick = null; UI.dCamp = "todas"; openPdfPeriodo(c); } }, "Gerar PDF do período") : null;
  const top = head("Tráfego pago · Visão geral", c.nome, [c.segmento, c.cidade, c.objetivo && Domain.OBJETIVOS[c.objetivo]].filter(Boolean).join(" · ") || null, [btnPdf, btnMetas, ...seletorPeriodo()]);
  if (!idx.rels.some(r => r.clienteId === c.id) && !temDiario) return [top, emptyPanel("Nenhum dado deste cliente ainda", "Ligue a conta em Conexões ou lance os dados de um mês para ver a visão geral.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  if (!lc.length) return [top, ...notaDash(PER, lc, lp), emptyPanel(`Sem dados em ${PER.rotulo}`, PER.modo === "dias" ? "Não há veiculação registrada nesses dias. Escolha outro período." : "Escolha outro período ou lance os dados deste mês.",
    PER.modo === "dias" ? null : h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  const extras = PER.modo === "mes" && allLoaded() ? [evolucao(Fmt.compsUntil(UI.comp, 12)), leituraPanel(periodo(UI.comp, UI.dur).cons, prevConsLegado(), c)] : [];
  const grupos = PER.modo === "dias"
    ? [["Investimento", ["investimentoCentavos", "orcamentoDiario", "impressoes", "cpm", "cliquesLink", "ctr"]], ["Leads", ["cpc", "conversas", "leadsForm", "leads", "cpl", "taxaCliqueLead"]]]
    : [["Investimento e alcance", ["investimentoCentavos", "orcamentoDiario", "alcance", "impressoes", "frequencia", "cpm"]], ["Cliques e leads", ["cliquesLink", "ctr", "cpc", "conversas", "leadsForm", "cpl"]],
       ["Conversão", ["taxaCliqueLead", "leadsQualificados", "vendas", "taxaLeadVenda", "custoVenda", "cac"]], ["Retorno", ["receita", "faturamentoTotal", "participacao", "ticket", "roas", "lucro"]]];
  return [top, ...notaDash(PER, lc, lp),
    h("div", { class: "panel panel-pad" },
      h("div", { class: "saude-row" }, saudeTag(aval), h("span", { class: "saude-t" }, aval.length ? resumoMetas(aval) : "Cadastre metas para acompanhar se o cliente está no alvo.")),
      ...grupos.flatMap(([t, ks]) => grupoKpis(t, ks, K, P, aval))),
    Domain.plataformasDe(c).length > 1 ? comparaPlataformas(c) : null,
    h("div", { class: "funnel-grid" }, funilCliente(K, P), metasPanel(c, aval)),
    ...extras];
}
function prevConsLegado() { const p = periodo(Fmt.previousComp(Fmt.compsUntil(UI.comp, UI.dur)[0]), UI.dur); return p.lancados.length ? p.cons : null; }
function resumoMetas(aval) {
  const n = s => aval.filter(a => a.status === s).length;
  return [n("ok") ? `${n("ok")} no alvo` : null, n("perto") ? `${n("perto")} em atenção` : null, n("fora") ? `${n("fora")} fora da meta` : null, n("sem") ? `${n("sem")} sem dado para avaliar` : null].filter(Boolean).join(" · ") || "Metas só de acompanhamento.";
}

/* ---------- funil ---------- */
function funilCliente(K, P) {
  const E = [
    { k: "impressoes", nome: "Impressões", o: "meta" },
    { taxa: "frequencia", t: "vezes por pessoa (frequência)", fmt: "dec" },
    { k: "alcance", nome: "Alcance", o: "meta" },
    { taxa: "ctr", t: "das impressões viraram clique (CTR)" },
    { k: "cliquesLink", nome: "Cliques no link", o: "meta" },
    { taxa: "taxaCliqueLead", t: "dos cliques viraram conversa ou lead" },
    { k: "leads", nome: "Conversas + leads", o: "meta" },
    { taxa: "taxaQualificacao", t: "tinham perfil de compra" },
    { k: "leadsQualificados", nome: "Leads qualificados", o: "cliente" },
    { taxa: "taxaLeadVenda", t: "dos leads compraram" },
    { k: "vendas", nome: "Vendas", o: "cliente" },
    { taxa: "ticket", t: "por venda (ticket médio)", fmt: "moeda" },
    { k: "receita", nome: "Faturamento", o: "cliente" },
  ];
  let i = 0;
  const n = E.filter(e => e.k).length;
  const lista = h("ol", { class: "funil" }, E.map(e => {
    if (e.taxa) {
      const x = K[e.taxa], vr = e.fmt ? null : Metrics.variacao(x.v, P && P[e.taxa] && P[e.taxa].v, 1);
      return h("li", { class: "funil-taxa" }, h("span", { class: "ft-v" + (x.v == null ? " na" : "") }, Fmt.metric(e.fmt || "pct", x.v)),
        h("span", { class: "ft-t" }, x.v == null ? x.m : e.t), vr && vr.abs ? h("span", { class: "delta " + vr.sentido }, Fmt.signed("pct", vr.abs)) : null);
    }
    const x = K[e.k], d = DIND[e.k], w = 100 - (i++) * (34 / (n - 1));
    const vr = Metrics.variacao(x.v, P && P[e.k] && P[e.k].v, 1);
    return h("li", { class: "funil-etapa" }, h("div", { class: "funil-bar " + e.o, style: `width:${w.toFixed(1)}%` },
      h("span", { class: "fb-n" }, e.nome), h("span", { class: "fb-v" + (x.v == null ? " na" : ""), title: x.v == null ? x.m : null }, Fmt.metric(d.fmt, x.v))),
      h("span", { class: "fb-d" }, vr && vr.pct != null ? h("span", { class: "delta " + vr.sentido }, Fmt.signedPct(vr.pct)) : null));
  }));
  const fim = h("div", { class: "funil-fim" }, ["roas", "cac", "custoVenda", "lucro"].map(k => h("div", null, h("span", null, DIND[k].nome),
    h("strong", { class: K[k].v == null ? "na" : null, title: K[k].v == null ? K[k].m : DIND[k].formula }, Fmt.metric(DIND[k].fmt, K[k].v)))));
  return h("div", { class: "panel panel-pad" }, h("h2", null, "Funil"),
    h("p", { class: "lead", style: "margin:4px 0 14px" }, "Da impressão ao faturamento. ",
      h("span", { class: "src meta" }, "Meta Ads"), " ", h("span", { class: "src cliente" }, "Informado pelo cliente")), lista, fim);
}

/* ---------- metas ---------- */
const STATUS_META = { ok: "No alvo", perto: "Atenção", fora: "Fora da meta", sem: "Sem dado", info: "Acompanhamento" };
function metasPanel(c, aval) {
  const btn = h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: () => openMetasForm(c) }, aval.length ? "Editar metas" : "Cadastrar metas");
  if (!aval.length) return h("div", { class: "panel panel-pad" }, h("h2", null, "Metas"),
    h("p", { class: "muted-line" }, "Nenhuma meta cadastrada. Com metas, cada indicador mostra se está no alvo e o cliente ganha um selo na visão de todos os clientes."), btn);
  return h("div", { class: "panel panel-pad" }, h("div", { class: "chart-head" }, h("h2", null, "Metas"), btn),
    h("ul", { class: "metas" }, aval.map(a => {
      const alvo = a.volume && a.fmt === "int" ? Math.round(a.alvo) : a.alvo;
      const prog = a.pct == null ? 0 : Math.max(0, Math.min(100, a.volume || DIND[a.ind].dir > 0 ? a.pct : (a.v <= a.alvo ? 100 : a.alvo / a.v * 100)));
      return h("li", { class: a.status }, h("div", { class: "mt-h" }, h("span", null, a.nome), h("span", { class: "meta-tag " + a.status }, STATUS_META[a.status])),
        h("div", { class: "mt-v" }, h("strong", null, Fmt.metric(a.fmt, a.v)), ` de ${Fmt.metric(a.fmt, alvo)}`, a.volume ? h("span", { class: "sub" }, " (ajustado ao período)") : null),
        h("span", { class: "bar" }, h("i", { style: `width:${prog.toFixed(0)}%` })));
    })),
    Fmt.isNum((c.metas || {}).margemPct) ? h("p", { class: "table-note", style: "padding:10px 0 0" }, `Margem de lucro usada no lucro estimado: ${Fmt.dec(c.metas.margemPct)}%.`) : null);
}
function openMetasForm(c) {
  gavetaForm({
    title: `Metas · ${c.nome}`, values: c.metas || {},
    spec: [
      { note: "Preencha só o que fizer sentido para este cliente. Metas de volume são mensais: em mês parcial ou em períodos de vários meses, o painel ajusta proporcionalmente. “Atenção” = até 15% fora da meta." },
      { section: "Investimento e margem" },
      { row: [{ k: "investimentoMensalCentavos", l: "Investimento mensal planejado", type: "money" }, { k: "margemPct", l: "Margem de lucro do cliente", type: "dec", unid: "%", help: "Usada no lucro estimado. Ex.: 30." }] },
      { section: "Custos máximos" },
      { row: [{ k: "cplMaxCentavos", l: "CPL máximo", type: "money" }, { k: "cpcMaxCentavos", l: "CPC máximo", type: "money" }] },
      { row: [{ k: "cpmMaxCentavos", l: "CPM máximo", type: "money" }, { k: "cacMaxCentavos", l: "CAC máximo", type: "money" }] },
      { section: "Taxas e retorno mínimos" },
      { row: [{ k: "ctrMin", l: "CTR mínimo", type: "dec", unid: "%", ph: "1,5" }, { k: "roasMin", l: "ROAS mínimo", type: "dec", unid: "x", ph: "4" }] },
      { section: "Volume por mês" },
      { row: [{ k: "leadsMin", l: "Leads (conversas + cadastros)", type: "int" }, { k: "vendasMin", l: "Vendas", type: "int" }] },
      { k: "faturamentoMinCentavos", l: "Faturamento dos anúncios", type: "money" },
    ],
    validate: d => {
      const e = {};
      if (d.margemPct != null && d.margemPct > 100) e.margemPct = "Use um valor entre 0 e 100.";
      if (d.ctrMin != null && d.ctrMin > 100) e.ctrMin = "Use um valor entre 0 e 100.";
      return e;
    },
    onSave: async d => { await Store.patch("clientes", c.id, { metas: d }); return "Metas salvas."; },
  });
}
