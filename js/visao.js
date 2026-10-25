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
  if (Store.state.clientes == null || !dadosTrafegoProntos()) return [head("Tráfego", "Visão geral"), loadingPanel()];
  const c = clienteAtual();
  if (UI.visaoModo === "cliente" && c) return visaoCliente(c);
  if (UI.visaoModo === "cliente") {
    const idx = indiceTrafego(), lista = clientesTrafego(idx);
    return [head("Tráfego", "Visão geral", "Escolha um cliente", modoVisao()),
      lista.length ? h("div", { class: "panel" }, h("div", { class: "pick-list" }, lista.map(x => h("button", { type: "button", class: "pick", onclick: () => abrirCliente(x.id) }, h("strong", null, x.nome), h("span", null, [x.segmento, x.cidade].filter(Boolean).join(" · ") || "—")))))
        : emptyPanel("Nenhum cliente de tráfego", "Cadastre um cliente com o serviço Tráfego pago.", h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  }
  return visaoCarteira();
}
function abrirCliente(id) {
  UI.clienteId = id; Prefs.set("cliente", id); UI.visaoModo = "cliente"; Prefs.set("visaoModo", "cliente"); UI.tab = "resumo";
  render(); window.scrollTo(0, 0);
}

/* =====================================================================
   TODOS OS CLIENTES
   ===================================================================== */
function visaoCarteira() {
  const idx = indiceTrafego(), { cur, prev } = compsVisao();
  const clientes = clientesTrafego(idx);
  const top = head("Tráfego · Todos os clientes", "Visão geral", "Números somados de todos os clientes de tráfego no período.", [modoVisao(), periodPicker()]);
  if (!clientes.length) return [top, emptyPanel("Nenhum cliente de tráfego ainda", "Cadastre um cliente com o serviço Tráfego pago e lance os dados do mês.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  const porCliente = clientes.map(c => {
    const lc = linhasDe(c, cur, idx), lp = linhasDe(c, prev, idx);
    const k = Desempenho.consolidar(lc), p = Desempenho.consolidar(lp);
    return { c, lc, lp, k, p, aval: Desempenho.avaliar(k, c.metas, lc) };
  });
  const linhasCur = porCliente.flatMap(x => x.lc), linhasPrev = porCliente.flatMap(x => x.lp);
  const K = Desempenho.consolidar(linhasCur, { carteira: true }), P = linhasPrev.length ? Desempenho.consolidar(linhasPrev, { carteira: true }) : null;
  if (!linhasCur.length) return [top, ...notaPeriodo(cur, prev, linhasCur, linhasPrev), emptyPanel(`Nenhum mês lançado em ${Fmt.periodLabel(cur)}`, "Escolha outro período ou lance os dados do mês dos clientes.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  const ativos = porCliente.filter(x => x.lc.length);
  const cont = { ok: 0, perto: 0, fora: 0, sem: 0 };
  ativos.forEach(x => cont[Desempenho.saude(x.aval)]++);
  const resumoSaude = h("div", { class: "saude-row" }, h("span", { class: "saude-t" }, `${ativos.length} ${ativos.length === 1 ? "cliente" : "clientes"} com dados no período`),
    ["ok", "perto", "fora", "sem"].filter(s => cont[s]).map(s => h("span", { class: "saude " + s }, h("i", { "aria-hidden": "true" }), `${cont[s]} ${SAUDE[s].toLowerCase()}`)));
  return [top, ...notaPeriodo(cur, prev, linhasCur, linhasPrev),
    h("div", { class: "panel panel-pad" }, resumoSaude,
      ...grupoKpis("Resultado", ["investimentoCentavos", "receita", "roas", "faturamentoTotal", "participacao", "lucro"], K, P),
      ...grupoKpis("Leads e vendas", ["leads", "cpl", "leadsQualificados", "vendas", "custoVenda", "cac"], K, P),
      ...grupoKpis("Entrega", ["impressoes", "alcance", "cliquesLink", "ctr", "cpc", "cpm"], K, P)),
    graficoCarteira(clientes, idx),
    tabelaCarteira(porCliente)];
}
function graficoCarteira(clientes, idx) {
  const comps = Fmt.compsUntil(UI.comp, 12);
  const cons = comps.map(comp => { const ls = clientes.flatMap(c => linhasDe(c, [comp], idx)); return ls.length ? Desempenho.consolidar(ls, { carteira: true }) : null; });
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim();
  const box = h("div", { class: "chart" });
  const w = Math.max(320, Math.min(1100, (document.getElementById("view")?.clientWidth || 900) - 40));
  box.append(svgNode(Charts.duplo({ labels: comps.map(Fmt.monthTiny), a: cons.map(k => k && k.investimentoCentavos.v), b: cons.map(k => k && k.receita.v), nomeA: "Investimento", nomeB: "Faturamento dos anúncios",
    fmt: "moeda", width: w, height: 240, colors: { a: g("--hero-b"), b: g("--accent"), text: g("--fg"), muted: g("--soft"), grid: g("--line") }, font: "Jost, sans-serif" })));
  return h("div", { class: "panel panel-pad chart-panel" },
    h("div", { class: "chart-head" }, h("h2", null, "Investimento × faturamento dos anúncios"),
      h("div", { class: "legend" }, h("span", null, h("i", { class: "lg-a" }), "Investimento"), h("span", null, h("i", { class: "lg-b" }), "Faturamento dos anúncios"))),
    box, h("p", { class: "chart-note" }, "Todos os clientes somados, mês a mês. O faturamento aparece quando os clientes informam as vendas em Resultados comerciais."));
}
function tabelaCarteira(porCliente) {
  const cols = [
    { k: "nome", l: "Cliente", get: x => x.c.nome },
    { k: "saude", l: "Metas", get: x => ({ fora: 0, perto: 1, ok: 2, sem: 3 })[Desempenho.saude(x.aval)] },
    { k: "investimentoCentavos", l: "Investimento", fmt: "moeda" },
    { k: "varInv", l: "vs. anterior", get: x => { const vr = Metrics.variacao(x.k.investimentoCentavos.v, x.p.investimentoCentavos.v, 0); return vr ? vr.pct : null; } },
    { k: "leads", l: "Leads", fmt: "int" }, { k: "cpl", l: "CPL", fmt: "moeda" }, { k: "ctr", l: "CTR", fmt: "pct" }, { k: "cpm", l: "CPM", fmt: "moeda" },
    { k: "vendas", l: "Vendas", fmt: "int" }, { k: "receita", l: "Faturamento", fmt: "moeda" }, { k: "roas", l: "ROAS", fmt: "x" },
  ];
  const val = (x, col) => col.get ? col.get(x) : x.k[col.k] ? x.k[col.k].v : null;
  const s = UI.cartSort, col = cols.find(c => c.k === s.k) || cols[2];
  const rows = porCliente.slice().sort((a, b) => {
    const va = val(a, col), vb = val(b, col);
    if (va == null && vb == null) return a.c.nome.localeCompare(b.c.nome, "pt-BR");
    if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb) * s.dir;
  });
  const th = c => h("th", { class: c.fmt || c.k === "varInv" ? "num" : null, "aria-sort": s.k === c.k ? (s.dir > 0 ? "ascending" : "descending") : null },
    h("button", { type: "button", class: "sort", onclick: () => { UI.cartSort = { k: c.k, dir: s.k === c.k ? -s.dir : c.k === "nome" || c.k === "saude" ? 1 : -1 }; render(); } }, c.l, s.k === c.k ? (s.dir > 0 ? " ↑" : " ↓") : ""));
  const body = rows.map(x => {
    const sem = !x.lc.length;
    return h("tr", { class: "row-link" + (sem ? " muted-row" : ""), tabindex: "0", onclick: () => abrirCliente(x.c.id), onkeydown: e => { if (e.key === "Enter") abrirCliente(x.c.id); } },
      h("td", null, h("div", { class: "name" }, x.c.nome), h("div", { class: "sub" }, sem ? "Sem lançamento no período" : [x.c.segmento, x.lc.length > 1 ? `${x.lc.length} meses` : null].filter(Boolean).join(" · ") || "—")),
      h("td", null, sem ? h("span", { class: "na" }, "—") : saudeTag(x.aval)),
      ...cols.slice(2).map(c => {
        if (c.k === "varInv") { const v = val(x, c); return h("td", { class: "num" }, v == null ? h("span", { class: "na" }, "—") : Fmt.signedPct(v)); }
        const m = x.k[c.k], aval = x.aval.find(a => a.ind === c.k && (a.status === "fora" || a.status === "perto"));
        return h("td", { class: "num" + (aval ? " cell-" + aval.status : ""), title: m && m.v == null ? m.m : aval ? `Meta ${Fmt.metric(c.fmt, aval.alvo)}` : null }, m && m.v != null ? Fmt.metric(c.fmt, m.v) : h("span", { class: "na" }, "—"));
      }));
  });
  return h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Clientes. "), "Clique em um cliente para abrir a visão geral dele. Clique no título da coluna para ordenar.")),
    h("div", { class: "table-wrap" }, h("table", { class: "data carteira" }, h("thead", null, h("tr", null, cols.map(th))), h("tbody", null, body))),
    h("p", { class: "table-note" }, "Metas: “Atenção” = até 15% fora da meta; “Fora da meta” = mais que isso. Passe o mouse sobre o selo para ver quais metas."));
}

/* =====================================================================
   POR CLIENTE
   ===================================================================== */
function visaoCliente(c) {
  const idx = indiceTrafego(), { cur, prev } = compsVisao();
  const lc = linhasDe(c, cur, idx), lp = linhasDe(c, prev, idx);
  const K = Desempenho.consolidar(lc), P = lp.length ? Desempenho.consolidar(lp) : null;
  const aval = Desempenho.avaliar(K, c.metas, lc);
  const btnMetas = h("button", { class: "btn", type: "button", disabled: !canWrite(), onclick: () => openMetasForm(c) }, Object.values(c.metas || {}).some(Fmt.isNum) ? "Editar metas" : "Cadastrar metas");
  const top = head("Tráfego · Visão geral", c.nome, [c.segmento, c.cidade, c.objetivo && Domain.OBJETIVOS[c.objetivo]].filter(Boolean).join(" · ") || null, [modoVisao(), btnMetas, periodPicker()]);
  if (!idx.rels.some(r => r.clienteId === c.id)) return [top, emptyPanel("Nenhum mês lançado para este cliente", "Lance os dados de pelo menos um mês para ver a visão geral.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  if (!lc.length) return [top, ...notaPeriodo(cur, prev, lc, lp), emptyPanel(`Nenhum mês lançado em ${Fmt.periodLabel(cur)}`, "Escolha outro período ou lance os dados deste mês.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  const extras = allLoaded() ? [evolucao(Fmt.compsUntil(UI.comp, 12)), leituraPanel(periodo(UI.comp, UI.dur).cons, prevConsLegado(), c)] : [];
  return [top, ...notaPeriodo(cur, prev, lc, lp),
    h("div", { class: "panel panel-pad" },
      h("div", { class: "saude-row" }, saudeTag(aval), h("span", { class: "saude-t" }, aval.length ? resumoMetas(aval) : "Cadastre metas para acompanhar se o cliente está no alvo.")),
      ...grupoKpis("Investimento e alcance", ["investimentoCentavos", "orcamentoDiario", "alcance", "impressoes", "frequencia", "cpm"], K, P, aval),
      ...grupoKpis("Cliques e leads", ["cliquesLink", "ctr", "cpc", "conversas", "leadsForm", "cpl"], K, P, aval),
      ...grupoKpis("Conversão", ["taxaCliqueLead", "leadsQualificados", "vendas", "taxaLeadVenda", "custoVenda", "cac"], K, P, aval),
      ...grupoKpis("Retorno", ["receita", "faturamentoTotal", "participacao", "ticket", "roas", "lucro"], K, P, aval)),
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
