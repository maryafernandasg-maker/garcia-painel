"use strict";
/* =====================================================================
   ANÁLISES, HISTÓRICO E RELATÓRIOS
   Toda conta passa por Metrics (núcleo). Aqui só se monta a tela.
   ===================================================================== */

/* ---------- dados por competência ---------- */
const allLoaded = () => !!Store.state.cd && Domain.DEPENDENTES.every(c => CD(c) != null);
const relDe = comp => (CD("relatorios") || []).find(r => r.competencia === comp) || null;
function mesData(comp) {
  const rel = relDe(comp);
  return { comp, rel, resumo: rel ? rel.resumo || {} : null, com: rel ? docDe("resultados_comerciais", rel.id) || null : null };
}
function periodo(fim, n) {
  const comps = Fmt.compsUntil(fim, n), meses = comps.map(mesData), lancados = meses.filter(m => m.rel);
  return { comps, meses, lancados, cons: Metrics.consolidar(lancados) };
}
function periodos() {
  const cur = periodo(UI.comp, UI.dur);
  const prev = periodo(Fmt.previousComp(cur.comps[0]), UI.dur);
  return { cur, prev };
}
const consMes = comp => { const m = mesData(comp); return m.rel ? Metrics.consolidar([m]) : null; };
const mesesLancados = () => (CD("relatorios") || []).map(r => r.competencia).sort();

/* ---------- peças de tela ---------- */
function durPicker() {
  return h("div", { class: "comp-picker" }, h("label", { for: "durSel", class: "sr" }, "Duração do período"),
    h("select", { id: "durSel", onchange: e => { UI.dur = Number(e.target.value); Prefs.set("dur", UI.dur); render(); } },
      [[1, "1 mês"], [3, "3 meses"], [6, "6 meses"], [12, "12 meses"]].map(([v, l]) => h("option", { value: v, selected: v === UI.dur }, l))));
}
const periodPicker = () => h("div", { class: "period" }, h("span", { class: "period-label" }, UI.dur === 1 ? "Mês" : "Até"), compPicker(), durPicker());

function guard(title) {
  if (Store.state.clientes == null) return [head(title, "Carregando…"), loadingPanel()];
  const c = clienteAtual();
  if (!c) return [head(title, "Sem cliente"), emptyPanel("Cadastre um cliente primeiro", "As análises são sempre de um cliente.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  if (!allLoaded()) return [head(c.nome, title), loadingPanel()];
  return null;
}
function semLancamentos(c, title) {
  return [head(c.nome, title), emptyPanel("Nenhum mês lançado para este cliente", "Lance os dados de pelo menos um mês para ver as análises.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
}
function parciais(per) {
  return per.lancados.filter(m => { const b = Fmt.monthBounds(m.comp); return m.rel.periodoInicio !== b.inicio || m.rel.periodoFim !== b.fim; });
}
function periodNote(cur, prev) {
  const falt = cur.comps.length - cur.lancados.length;
  const pc = [...parciais(cur), ...(prev ? parciais(prev) : [])];
  const aviso = pc.length ? h("p", { class: "period-note partial" }, `Período parcial: ${pc.map(m => `${Fmt.monthShort(m.comp)} vai de ${Fmt.date(m.rel.periodoInicio)} a ${Fmt.date(m.rel.periodoFim)}`).join("; ")}. Totais (investimento, impressões, resultados) não são comparáveis com meses completos; compare taxas e custos.`) : null;
  return [h("p", { class: "period-note" },
    `Período: ${Fmt.periodLabel(cur.comps)}`,
    UI.dur > 1 ? ` (${cur.lancados.length} de ${cur.comps.length} meses lançados)` : "",
    prev ? ` · Comparado com ${Fmt.periodLabel(prev.comps)}${prev.lancados.length ? "" : " (sem dados)"}` : "",
    falt && UI.dur > 1 ? ". Meses sem lançamento ficam de fora dos totais." : ""), aviso];
}

function chartColors() {
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim();
  return { mark: g("--accent"), markMuted: g("--line-strong"), text: g("--fg"), muted: g("--soft"), grid: g("--line"), bg: g("--panel") };
}
function svgNode(str) {
  const el = new DOMParser().parseFromString(str, "image/svg+xml").documentElement;
  el.setAttribute("width", "100%"); el.removeAttribute("height"); el.setAttribute("role", "img");
  return document.importNode(el, true);
}
const SERIES = {
  investimento: { l: "Investimento", fmt: "moeda", kind: "bar", get: c => c.investimentoCentavos.v },
  resultados: { l: "Resultados", fmt: "int", kind: "bar", get: c => c.resultados.v },
  cpr: { l: "Custo por resultado", fmt: "moeda", kind: "line", get: c => c.cpr.v },
  ctr: { l: "CTR de link", fmt: "pct", kind: "line", get: c => c.ctr.v },
  cpm: { l: "CPM", fmt: "moeda", kind: "line", get: c => c.cpm.v },
  vendas: { l: "Vendas atribuídas", fmt: "int", kind: "bar", get: c => c.vendas.v },
  roas: { l: "ROAS", fmt: "x", kind: "line", get: c => c.roas.v },
};
function evolucao(comps, title) {
  const s = SERIES[UI.chartMetric] || SERIES.investimento;
  const values = comps.map(comp => { const c = consMes(comp); return c ? s.get(c) : null; });
  const box = h("div", { class: "chart", id: "chart-evolucao" });
  const w = Math.max(320, Math.min(1100, (document.getElementById("view")?.clientWidth || 900) - 40));
  box.append(svgNode(Charts.svg({ labels: comps.map(Fmt.monthTiny), values, fmt: s.fmt, kind: s.kind, width: w, height: 230, colors: chartColors(), font: "Jost, sans-serif" })));
  const comDado = values.filter(v => v != null).length;
  return h("div", { class: "panel panel-pad chart-panel" },
    h("div", { class: "chart-head" }, h("h2", null, title || "Evolução mensal"),
      h("div", { class: "chips", role: "group", "aria-label": "Indicador do gráfico" }, Object.entries(SERIES).map(([k, d]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(UI.chartMetric === k), onclick: () => { UI.chartMetric = k; render(); } }, d.l)))),
    box,
    h("p", { class: "chart-note" }, comDado < 2 ? "A evolução fica mais útil a partir do segundo mês lançado. " : "",
      "Um ponto por mês lançado. “—” indica mês sem lançamento ou sem o dado. Os dados são mensais; evolução diária exige lançar dados por dia."));
}

/** Cartão de indicador com comparação. dir vem das definições; investimento não tem direção certa. */
function kpi(label, cur, prev, fmt, dir, opts) {
  opts = opts || {};
  const vr = opts.semComparar ? null : Metrics.variacao(cur && cur.v, prev && prev.v, dir);
  let delta;
  if (!vr) delta = h("span", { class: "delta na" }, opts.semComparar || (prev ? (prev.v == null ? "Sem dado no período anterior" : "Sem dado neste período") : "Sem comparação"));
  else {
    const main = fmt === "pct" ? Fmt.signed("pct", vr.abs) : vr.pct == null ? Fmt.signed(fmt, vr.abs) : Fmt.signedPct(vr.pct);
    const sub = fmt === "pct" ? (vr.pct == null ? "" : ` (${Fmt.signedPct(vr.pct)})`) : vr.pct == null ? "" : ` (${Fmt.signed(fmt, vr.abs)})`;
    delta = h("span", { class: "delta " + vr.sentido, title: vr.sentido === "melhor" ? "Melhorou" : vr.sentido === "pior" ? "Piorou" : null },
      h("span", { class: "arrow", "aria-hidden": "true" }, vr.abs > 0 ? "▲" : vr.abs < 0 ? "▼" : "="), " ", main, sub);
  }
  return h("div", { class: "kpi" }, h("span", { class: "kpi-k" }, label),
    h("span", { class: "kpi-v" + (cur && cur.v != null ? "" : " na") }, Fmt.metric(fmt, cur && cur.v)),
    cur && cur.v == null ? h("span", { class: "tile-m" }, cur.m || "Não informado") : delta);
}
const tipoNome = cons => cons.tipoResultado ? Domain.tipoLabel(cons.tipoResultado, cons.tipoResultadoOutro) : "Resultados";
function kpiGrid(cur, prev, extraCtx) {
  const sameTipo = prev && cur.tipoResultado && prev.tipoResultado === cur.tipoResultado && (cur.tipoResultadoOutro || null) === (prev.tipoResultadoOutro || null);
  const difTipo = prev && prev.resultados.v != null && !sameTipo ? "Tipo de resultado diferente do período anterior" : null;
  const D = Metrics.DEFS;
  const midia = [
    kpi("Investimento", cur.investimentoCentavos, prev && prev.investimentoCentavos, "moeda", 0),
    kpi("Alcance", cur.alcance, prev && prev.alcance, "int", 1, { semComparar: UI.dur > 1 ? "Não somável entre meses" : null }),
    kpi("Impressões", cur.impressoes, prev && prev.impressoes, "int", 1),
    kpi("Frequência", cur.frequencia, prev && prev.frequencia, "dec", 0, { semComparar: UI.dur > 1 ? "Só para um mês" : null }),
    kpi("Cliques no link", cur.cliquesLink, prev && prev.cliquesLink, "int", 1),
    kpi("CTR de link", cur.ctr, prev && prev.ctr, "pct", D.ctr.dir),
    kpi("CPC de link", cur.cpc, prev && prev.cpc, "moeda", D.cpc.dir),
    kpi("CPM", cur.cpm, prev && prev.cpm, "moeda", D.cpm.dir),
    kpi(tipoNome(cur), cur.resultados, prev && prev.resultados, "int", 1, { semComparar: difTipo }),
    kpi("Custo por resultado", cur.cpr, prev && prev.cpr, "moeda", D.cpr.dir, { semComparar: difTipo }),
  ];
  const temCom = [cur.leadsQualificados, cur.vendas, cur.receita].some(x => x.v != null);
  const com = temCom ? [
    kpi("Leads qualificados", cur.leadsQualificados, prev && prev.leadsQualificados, "int", 1),
    kpi("Vendas atribuídas", cur.vendas, prev && prev.vendas, "int", 1),
    kpi("Receita atribuída", cur.receita, prev && prev.receita, "moeda", 1),
    kpi("ROAS", cur.roas, prev && prev.roas, "x", D.roas.dir),
  ] : null;
  return [h("div", { class: "kpis" }, midia),
    h("h3", { class: "group-h", style: "margin-top:4px" }, "Resultados comerciais informados pelo cliente"),
    com ? h("div", { class: "kpis" }, com) : h("p", { class: "muted-line" }, "Não informados neste período. Leads qualificados, vendas, receita e ROAS aparecem quando o cliente informar esses números.")];
}
function leituraPanel(cur, prev, c) {
  const itens = Metrics.leitura(cur, prev, { ticketMedioCentavos: c.ticketMedioCentavos });
  return h("div", { class: "panel panel-pad" },
    h("h2", null, "Leitura automática dos dados"),
    h("p", { class: "lead", style: "margin:4px 0 12px" }, "Fatos e pontos para investigar, não conclusões. A interpretação fica na Análise estratégica."),
    itens.length ? h("ul", { class: "leitura" }, itens.map(i => h("li", { class: i.tipo }, i.texto))) : h("p", { class: "muted-line" }, "Nada fora do comum entre os dados lançados."));
}

/* =====================================================================
   VISÃO GERAL
   ===================================================================== */
function viewVisao() {
  if (Store.state.clientes == null) return [head("Visão geral", "Carregando…"), loadingPanel()];
  const c = clienteAtual();
  if (!c) return [head("Visão geral", "Bem-vinda ao painel"), emptyPanel("Comece cadastrando um cliente",
    "Cada cliente tem o próprio histórico mensal. Depois do cadastro você escolhe o cliente no menu e lança os dados de cada mês.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openClienteForm(c) }, "Cadastrar cliente"))];
  const g = guard("Visão geral"); if (g) return g;
  if (!mesesLancados().length) return semLancamentos(c, "Visão geral");
  const { cur, prev } = periodos();
  const top = head("Visão geral", c.nome, [c.segmento, c.cidade, c.objetivo && Domain.OBJETIVOS[c.objetivo]].filter(Boolean).join(" · "), periodPicker());
  if (!cur.lancados.length) return [top, periodNote(cur, null), emptyPanel(`Nenhum mês lançado em ${Fmt.periodLabel(cur.comps)}`, "Escolha outro período ou lance os dados deste mês.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  const prevCons = prev.lancados.length ? prev.cons : null;
  return [top, periodNote(cur, prev),
    h("div", { class: "panel panel-pad" }, kpiGrid(cur.cons, prevCons)),
    evolucao(Fmt.compsUntil(UI.comp, 12)),
    leituraPanel(cur.cons, prevCons, c)];
}

/* =====================================================================
   CAMPANHAS, CONJUNTOS E ANÚNCIOS (análise do período)
   ===================================================================== */
function agrupar(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()].map(([k, rs]) => ({ key: k, rows: rs.sort((a, b) => a.competencia.localeCompare(b.competencia)) }));
}
function resumoGrupo(rows) {
  const ag = Metrics.agregar(rows);
  const res = ag.resultados.length === 1 ? ag.resultados[0] : null;
  return {
    ag, um: rows.length === 1 ? rows[0] : null,
    resTxt: res ? `${Fmt.integer(res.resultados)} ${Domain.tipoLabel(res.tipo, res.rotulo, true)}` : ag.resultados.length > 1 ? "Tipos diferentes" : Fmt.NA,
    cpr: res ? res.cpr : { v: null, m: ag.resultados.length > 1 ? "Resultados de tipos diferentes não são somados" : "Sem resultados informados" },
    vol: Metrics.volume({ impressoes: ag.impressoes.v, resultados: res ? res.resultados : null }),
  };
}
function volCell(vol) {
  return h("td", null, vol.baixo ? h("span", { class: "flag", title: vol.m }, "Pouco volume") : vol.baixo === null ? h("span", { class: "na", title: vol.m }, Fmt.NA) : h("span", { class: "flag ok" }, "OK"));
}
const inPeriod = (rows, comps) => (rows || []).filter(r => comps.includes(r.competencia));
function nomeMap(col) { return Object.fromEntries((CD(col) || []).map(d => [d.id, d.nome])); }
function volumeNote() {
  return h("p", { class: "table-note" }, `“Pouco volume”: menos de ${Fmt.integer(Metrics.VOLUME_MIN.impressoes)} impressões ou menos de ${Metrics.VOLUME_MIN.resultados} resultados. Nesses casos as diferenças podem ser acaso: não declare um vencedor só por ter mais resultados, compare custo por resultado com investimento, período e objetivo parecidos.`);
}

function viewCampanhasA() {
  const g = guard("Campanhas"); if (g) return g;
  const c = clienteAtual();
  if (!mesesLancados().length) return semLancamentos(c, "Campanhas");
  const { cur } = periodos();
  const top = head(c.nome, "Campanhas", null, periodPicker());
  let rows = inPeriod(CD("campanhas"), cur.comps);
  const objs = [...new Set(rows.map(r => r.objetivo || "_"))];
  if (UI.objFiltro !== "todos" && !objs.includes(UI.objFiltro)) UI.objFiltro = "todos";
  const filtro = objs.length > 1 ? h("div", { class: "chips", role: "group", "aria-label": "Filtrar por objetivo" },
    h("span", { class: "chips-label" }, "Objetivo:"),
    [["todos", "Todos"], ...objs.map(o => [o, o === "_" ? "Não informado" : Domain.OBJ_META[o]])].map(([k, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(UI.objFiltro === k), onclick: () => { UI.objFiltro = k; render(); } }, l))) : null;
  if (UI.objFiltro !== "todos") rows = rows.filter(r => (r.objetivo || "_") === UI.objFiltro);
  if (!rows.length) {
    const temResumo = cur.lancados.some(m => m.resumo && m.resumo.investimentoCentavos != null);
    return [top, periodNote(cur, null), filtro, emptyPanel("Nenhuma campanha lançada neste período",
      temResumo ? "Os dados deste período estão só no nível da conta (resumo do mês). Sem campanhas lançadas, não há como comparar objetivos ou custos entre campanhas." : "Lance as campanhas do mês para analisar aqui.",
      h("button", { class: "btn", type: "button", onclick: () => { UI.tab = "campanhas"; go("lancamentos"); } }, "Lançar campanhas"))];
  }
  const grupos = agrupar(rows, r => Domain.norm(r.nome)).map(gr => ({ ...gr, s: resumoGrupo(gr.rows), ult: gr.rows[gr.rows.length - 1] }))
    .sort((a, b) => (b.s.ag.investimentoCentavos.v || 0) - (a.s.ag.investimentoCentavos.v || 0));
  const tot = Metrics.agregar(rows), totInv = tot.investimentoCentavos.v;
  const conjs = inPeriod(CD("conjuntos"), cur.comps), ads = inPeriod(CD("anuncios"), cur.comps);
  const cols = ["Campanha", "Investimento", "% do invest.", "Impressões", "Cliques", "CTR", "CPC", "CPM", "Resultados", "Custo/resultado", "Volume", ""];
  const body = [];
  for (const gr of grupos) {
    const { ag, resTxt, cpr, vol } = gr.s, open = UI.aberto === "c:" + gr.key;
    const share = totInv ? { v: (ag.investimentoCentavos.v || 0) / totInv * 100 } : { v: null, m: "Investimento total não informado" };
    body.push(h("tr", { class: open ? "open" : null },
      h("td", null, h("div", { class: "name" }, gr.ult.nome),
        h("div", { class: "sub" }, [gr.ult.objetivo ? Domain.OBJ_META[gr.ult.objetivo] : "Objetivo não informado", gr.rows.length > 1 ? `${gr.rows.length} meses somados` : Fmt.monthShort(gr.ult.competencia)].join(" · "))),
      ncell(ag.investimentoCentavos.v, "moeda"), mcell(share, "pct"), ncell(ag.impressoes.v), ncell(ag.cliquesLink.v),
      mcell(ag.ctr, "pct"), mcell(ag.cpc, "moeda"), mcell(ag.cpm, "moeda"), h("td", { class: "num" }, resTxt), mcell(cpr, "moeda"), volCell(vol),
      h("td", null, h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-expanded": String(open), onclick: () => { UI.aberto = open ? null : "c:" + gr.key; render(); } }, open ? "Fechar" : "Detalhes"))));
    if (open) {
      const ids = gr.rows.map(r => r.id);
      const nConj = conjs.filter(s => ids.includes(s.campanhaId)).length, nAds = ads.filter(a => ids.includes(a.campanhaId)).length;
      body.push(h("tr", { class: "detail" }, h("td", { colspan: cols.length },
        h("table", { class: "data inner" },
          h("thead", null, h("tr", null, ["Mês", "Status", "Investimento", "Alcance", "Impressões", "Freq.", "Cliques", "CTR", "CPC", "CPM", "Resultados", "Custo/resultado"].map((t, i) => h("th", { class: i >= 2 ? "num" : null }, t)))),
          h("tbody", null, gr.rows.map(r => { const b = Metrics.basicas(r); return h("tr", null,
            h("td", null, Fmt.monthShort(r.competencia)), h("td", null, r.status ? Domain.STATUS_CAMP[r.status] : Fmt.NA),
            ncell(r.investimentoCentavos, "moeda"), ncell(r.alcance), ncell(r.impressoes), mcell(b.frequencia, "dec"), ncell(r.cliquesLink),
            mcell(b.ctr, "pct"), mcell(b.cpc, "moeda"), mcell(b.cpm, "moeda"), h("td", { class: "num" }, resultadoTexto(r)), mcell(b.cpr, "moeda")); }))),
        h("p", { class: "detail-note" }, nConj || nAds ? `Detalhamento no período: ${nConj} ${nConj === 1 ? "conjunto" : "conjuntos"} e ${nAds} ${nAds === 1 ? "anúncio" : "anúncios"}. Veja nas áreas de conjuntos e anúncios.`
          : "Sem detalhamento por conjunto ou anúncio: a análise desta campanha fica no nível da campanha."),
        gr.rows.filter(r => r.observacoes).map(r => h("p", { class: "detail-note" }, h("strong", null, `${Fmt.monthShort(r.competencia)}: `), r.observacoes)))));
    }
  }
  const resTot = tot.resultados.length === 1 ? `${Fmt.integer(tot.resultados[0].resultados)} ${Domain.tipoLabel(tot.resultados[0].tipo, tot.resultados[0].rotulo, true)}` : tot.resultados.length > 1 ? "Tipos diferentes" : Fmt.NA;
  return [top, periodNote(cur, null), filtro,
    h("div", { class: "panel" }, h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, cols.map((t, i) => h("th", { class: i >= 1 && i <= 9 ? "num" : null }, t)))),
      h("tbody", null, body),
      h("tfoot", null, h("tr", null, h("td", null, h("div", { class: "name" }, "Total")), ncell(totInv, "moeda"), h("td", { class: "num" }, totInv ? "100%" : Fmt.NA),
        ncell(tot.impressoes.v), ncell(tot.cliquesLink.v), mcell(tot.ctr, "pct"), mcell(tot.cpc, "moeda"), mcell(tot.cpm, "moeda"),
        h("td", { class: "num" }, resTot), mcell(tot.resultados.length === 1 ? tot.resultados[0].cpr : { v: null, m: "Tipos diferentes" }, "moeda"), h("td", null), h("td", null))))),
      h("p", { class: "table-note" }, UI.dur > 1 ? "Campanhas com o mesmo nome em meses diferentes são somadas. " : "",
        "Alcance e frequência aparecem só no detalhe de cada mês, porque não são somáveis. CTR, CPC e CPM são ponderados pelo volume."),
      volumeNote())];
}

function viewConjuntosA() {
  const g = guard("Conjuntos de anúncios"); if (g) return g;
  const c = clienteAtual();
  if (!mesesLancados().length) return semLancamentos(c, "Conjuntos de anúncios");
  const { cur } = periodos();
  const top = head(c.nome, "Conjuntos de anúncios", null, periodPicker());
  const rows = inPeriod(CD("conjuntos"), cur.comps), campNome = nomeMap("campanhas");
  if (!rows.length) return [top, periodNote(cur, null), emptyPanel("Nenhum conjunto lançado neste período",
    "Sem conjuntos lançados, a análise fica no nível da campanha, sem comparação entre públicos ou posicionamentos.",
    h("button", { class: "btn", type: "button", onclick: () => { UI.tab = "conjuntos"; go("lancamentos"); } }, "Lançar conjuntos"))];
  const grupos = agrupar(rows, r => Domain.norm((campNome[r.campanhaId] || "") + "|" + r.nome)).map(gr => ({ ...gr, s: resumoGrupo(gr.rows), ult: gr.rows[gr.rows.length - 1] }))
    .sort((a, b) => (campNome[a.ult.campanhaId] || "").localeCompare(campNome[b.ult.campanhaId] || "", "pt-BR") || (b.s.ag.investimentoCentavos.v || 0) - (a.s.ag.investimentoCentavos.v || 0));
  return [top, periodNote(cur, null),
    h("div", { class: "panel" }, h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Conjunto", "Campanha", "Investimento", "Impressões", "Cliques", "CTR", "CPC", "Resultados", "Custo/resultado", "Volume"].map((t, i) => h("th", { class: i >= 2 && i <= 8 ? "num" : null }, t)))),
      h("tbody", null, grupos.map(gr => { const { ag, resTxt, cpr, vol } = gr.s; return h("tr", null,
        h("td", null, h("div", { class: "name" }, gr.ult.nome), h("div", { class: "sub clamp" }, [gr.ult.publico, gr.ult.posicionamentos].filter(Boolean).join(" · ") || "Público não informado"),
          gr.ult.observacoes ? h("div", { class: "sub clamp obs-line" }, gr.ult.observacoes) : null),
        h("td", null, campNome[gr.ult.campanhaId] || Fmt.NA, gr.rows.length > 1 ? h("div", { class: "sub" }, `${gr.rows.length} meses somados`) : null),
        ncell(ag.investimentoCentavos.v, "moeda"), ncell(ag.impressoes.v), ncell(ag.cliquesLink.v), mcell(ag.ctr, "pct"), mcell(ag.cpc, "moeda"),
        h("td", { class: "num" }, resTxt), mcell(cpr, "moeda"), volCell(vol)); })))),
      h("p", { class: "table-note" }, "Compare conjuntos da mesma campanha, com o mesmo tipo de resultado. Um custo por resultado menor só indica um público melhor quando os dois tiveram volume suficiente e o mesmo período de veiculação."),
      volumeNote())];
}

function viewAnunciosA() {
  const g = guard("Anúncios e criativos"); if (g) return g;
  const c = clienteAtual();
  const top = head(c.nome, "Anúncios e criativos", null, periodPicker());
  const testes = testesPanel(c);
  if (!mesesLancados().length) return [...semLancamentos(c, "Anúncios e criativos"), testes];
  const { cur } = periodos();
  const rows = inPeriod(CD("anuncios"), cur.comps), campNome = nomeMap("campanhas"), conjNome = nomeMap("conjuntos");
  if (!rows.length) return [top, periodNote(cur, null), emptyPanel("Nenhum anúncio lançado neste período", "Sem anúncios lançados, não há como comparar criativos.",
    h("button", { class: "btn", type: "button", onclick: () => { UI.tab = "anuncios"; go("lancamentos"); } }, "Lançar anúncios")), testes];
  const grupos = agrupar(rows, r => Domain.norm((campNome[r.campanhaId] || "") + "|" + r.nome)).map(gr => ({ ...gr, s: resumoGrupo(gr.rows), ult: gr.rows[gr.rows.length - 1] }))
    .sort((a, b) => (b.s.ag.investimentoCentavos.v || 0) - (a.s.ag.investimentoCentavos.v || 0));
  const porFormato = agrupar(rows, r => r.formato || "_").map(gr => ({ ...gr, s: resumoGrupo(gr.rows), n: new Set(gr.rows.map(r => Domain.norm(r.nome))).size }))
    .sort((a, b) => (b.s.ag.investimentoCentavos.v || 0) - (a.s.ag.investimentoCentavos.v || 0));
  return [top, periodNote(cur, null),
    h("div", { class: "panel" }, h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Anúncio", "Campanha / conjunto", "Ângulo · oferta", "Investimento", "Impressões", "Cliques", "CTR", "CPC", "Resultados", "Custo/resultado", "Volume"].map((t, i) => h("th", { class: i >= 3 && i <= 9 ? "num" : null }, t)))),
      h("tbody", null, grupos.map(gr => { const { ag, resTxt, cpr, vol } = gr.s, a = gr.ult; return h("tr", null,
        h("td", null, h("div", { class: "ad-cell" }, (() => { const cr = criativoDe(c, a.nome); return criativoSrc(cr) ? h("img", { class: "thumb", src: criativoSrc(cr), alt: `Criativo ${a.nome}`, loading: "lazy" }) : null; })(),
          h("div", { style: "min-width:0" }, h("div", { class: "name" }, a.nome), h("div", { class: "sub" }, [a.formato ? Domain.FORMATOS[a.formato] : "Formato não informado", gr.rows.length > 1 ? `${gr.rows.length} meses somados` : null].filter(Boolean).join(" · ")),
          a.observacoes ? h("div", { class: "sub clamp obs-line" }, a.observacoes) : null, criativoBtn(c, a.nome, criativoDe(c, a.nome))))),
        h("td", null, campNome[a.campanhaId] || Fmt.NA, h("div", { class: "sub" }, a.conjuntoId ? conjNome[a.conjuntoId] || "Conjunto removido" : "Sem conjunto informado")),
        h("td", null, h("div", { class: "clamp" }, [a.angulo, a.oferta].filter(Boolean).join(" · ") || h("span", { class: "na" }, Fmt.NA))),
        ncell(ag.investimentoCentavos.v, "moeda"), ncell(ag.impressoes.v), ncell(ag.cliquesLink.v), mcell(ag.ctr, "pct"), mcell(ag.cpc, "moeda"),
        h("td", { class: "num" }, resTxt), mcell(cpr, "moeda"), volCell(vol)); })))),
      volumeNote()),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Por formato. "), "Soma dos anúncios de cada formato no período, com CTR e custo ponderados.")),
      h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", null, h("tr", null, ["Formato", "Anúncios", "Investimento", "Impressões", "CTR", "CPC", "Resultados", "Custo/resultado", "Volume"].map((t, i) => h("th", { class: i >= 1 && i <= 7 ? "num" : null }, t)))),
        h("tbody", null, porFormato.map(gr => { const { ag, resTxt, cpr, vol } = gr.s; return h("tr", null,
          h("td", null, gr.key === "_" ? "Não informado" : Domain.FORMATOS[gr.key]), h("td", { class: "num" }, Fmt.integer(gr.n)),
          ncell(ag.investimentoCentavos.v, "moeda"), ncell(ag.impressoes.v), mcell(ag.ctr, "pct"), mcell(ag.cpc, "moeda"), h("td", { class: "num" }, resTxt), mcell(cpr, "moeda"), volCell(vol)); })))),
      h("p", { class: "table-note" }, "Formatos com tipos de resultado diferentes aparecem como “Tipos diferentes” e não são comparados pelo custo.")),
    testes];
}

/* ---------- testes e hipóteses ---------- */
function testesPanel(c) {
  const list = (CD("testes") || []).slice().sort((a, b) => (b.inicio || b.criadoEm || "").localeCompare(a.inicio || a.criadoEm || ""));
  const add = h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openTesteForm(c, null) }, "Registrar teste");
  return h("div", { class: "panel", id: "testes" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Testes e hipóteses. "), "Registre o que está sendo testado, o resultado com números e a decisão tomada."), add),
    list.length ? h("div", { class: "test-list" }, list.map(t => testeCard(c, t))) : h("div", { class: "empty" }, h("p", null, "Nenhum teste registrado para este cliente.")));
}
function testeCard(c, t, compact) {
  const st = { planejado: "pausado", andamento: "ativo", concluido: "encerrado", cancelado: "encerrado" }[t.status] || "encerrado";
  return h("div", { class: "test" },
    h("div", { class: "card-top" }, h("div", { style: "min-width:0" }, h("div", { class: "name" }, t.hipotese),
      h("div", { class: "sub" }, [t.variavel && Domain.VARIAVEIS[t.variavel], t.inicio && `${Fmt.date(t.inicio)}${t.fim ? " a " + Fmt.date(t.fim) : ""}`].filter(Boolean).join(" · ") || "Sem datas")),
      h("span", { class: "pill " + st }, Domain.STATUS_TESTE[t.status] || "—")),
    !compact && t.descricao ? h("p", { class: "test-p" }, h("strong", null, "Como foi montado: "), t.descricao) : null,
    t.resultadoObservado ? h("p", { class: "test-p" }, h("strong", null, "Resultado: "), t.resultadoObservado) : null,
    t.aprendizado ? h("p", { class: "test-p" }, h("strong", null, "Aprendizado: "), t.aprendizado) : null,
    t.decisao ? h("p", { class: "test-p" }, h("strong", null, "Decisão: "), t.decisao) : null,
    compact ? null : rowActions(() => openTesteForm(c, t), () => confirmDialog({ title: "Excluir este teste?", text: "A exclusão é definitiva.", confirmLabel: "Excluir teste",
      onConfirm: async () => { await Store.remove("testes", t.id); return "Teste excluído."; } })));
}
function openTesteForm(c, t) {
  openEntityForm({
    title: t ? "Editar teste" : "Novo teste", kind: "teste", values: t || { status: "planejado" }, ctx: {},
    onSave: async d => {
      if (t) { await Store.patch("testes", t.id, d); return "Teste atualizado."; }
      await Store.put("testes", Domain.novoId("teste"), { clienteId: c.id, schema: Domain.SCHEMA, ...d }); return "Teste registrado.";
    },
  });
}
const testesDoMes = comp => { const b = Fmt.monthBounds(comp); return (CD("testes") || []).filter(t => (t.inicio || "0000") <= b.fim && (t.fim || "9999") >= b.inicio && (t.inicio || t.fim)); };

/* =====================================================================
   FUNIL
   ===================================================================== */
function viewFunil() {
  const g = guard("Funil de conversão"); if (g) return g;
  const c = clienteAtual();
  if (!mesesLancados().length) return semLancamentos(c, "Funil de conversão");
  const { cur, prev } = periodos();
  const top = head(c.nome, "Funil de conversão", null, periodPicker());
  if (!cur.lancados.length) return [top, periodNote(cur, null), emptyPanel("Nenhum mês lançado neste período", null)];
  const K = cur.cons, P = prev.lancados.length ? prev.cons : null;
  const tipos = [...new Set(cur.lancados.map(m => m.resumo && m.resumo.tipoResultado).filter(Boolean))];
  const leadNome = tipos.length === 1 && tipos[0] === "leads" ? "Leads gerados" : tipos.length === 1 && tipos[0] === "conversas" ? "Conversas iniciadas" : "Conversas ou leads";
  const ticketReal = Metrics.ratio(K.receita.v, K.vendas.v, 1, "receita", "vendas");
  const etapas = [
    { nome: "Impressões", o: K.impressoes, p: P && P.impressoes, origem: "meta" },
    { taxa: K.ctr, tp: P && P.ctr, t: "clicaram no link" },
    { nome: "Cliques no link", o: K.cliquesLink, p: P && P.cliquesLink, origem: "meta" },
    { taxa: K.taxaCliqueLead, tp: P && P.taxaCliqueLead, t: "iniciaram conversa ou viraram lead" },
    { nome: leadNome, o: K.leads.v == null && !tipos.some(x => ["conversas", "leads"].includes(x)) ? { v: null, m: "O resultado principal não é conversa nem lead" } : K.leads, p: P && P.leads, origem: "meta" },
    { taxa: K.taxaQualificacao, tp: P && P.taxaQualificacao, t: "tinham perfil de compra" },
    { nome: "Leads qualificados", o: K.leadsQualificados, p: P && P.leadsQualificados, origem: "cliente" },
    { taxa: K.taxaLeadVenda, tp: P && P.taxaLeadVenda, t: "dos contatos compraram" },
    { nome: "Vendas atribuídas", o: K.vendas, p: P && P.vendas, origem: "cliente" },
    { taxa: ticketReal, fmt: "moeda", t: "por venda (ticket médio realizado)" },
    { nome: "Receita atribuída", o: K.receita, p: P && P.receita, origem: "cliente", fmt: "moeda" },
  ];
  const badge = o => h("span", { class: "src " + o }, o === "meta" ? "Meta Ads" : "Informado pelo cliente");
  const funnel = h("ol", { class: "funnel funnel-big" }, etapas.map(e => {
    if (e.taxa) {
      const vr = e.fmt ? null : Metrics.variacao(e.taxa.v, e.tp && e.tp.v, 1);
      return h("li", { class: "step-rate" }, h("span", { class: "rate" + (e.taxa.v == null ? " na" : ""), title: e.taxa.v == null ? e.taxa.m : null },
        e.taxa.v == null ? "—" : Fmt.metric(e.fmt || "pct", e.taxa.v)), h("span", { class: "rate-t" }, e.taxa.v == null ? e.taxa.m : e.t),
        vr ? h("span", { class: "delta " + vr.sentido }, Fmt.signed("pct", vr.abs)) : null);
    }
    const vr = Metrics.variacao(e.o.v, e.p && e.p.v, 1);
    return h("li", null, h("span", { class: "f-name" }, e.nome), badge(e.origem),
      vr && vr.pct != null ? h("span", { class: "delta " + vr.sentido }, Fmt.signedPct(vr.pct)) : h("span"),
      h("span", { class: "f-val" + (e.o.v == null ? " na" : ""), title: e.o.v == null ? e.o.m : null }, e.fmt === "moeda" ? Fmt.money(e.o.v) : Fmt.integer(e.o.v)));
  }));
  const D = Metrics.DEFS;
  const custos = h("div", { class: "kpis" }, ["cpl", "cplq", "cacMidia", "cacTotal", "roas"].map(k => kpi(D[k].nome, K[k], P && P[k], D[k].fmt, D[k].dir)));
  const crit = cur.lancados.filter(m => m.com).map(m => h("tr", null, h("td", null, Fmt.monthShort(m.comp)),
    h("td", null, m.com.criterioAtribuicao ? Domain.ATRIBUICAO[m.com.criterioAtribuicao] : h("span", { class: "na" }, "Não informado"), m.com.atribuicaoDetalhe ? h("div", { class: "sub" }, m.com.atribuicaoDetalhe) : null),
    h("td", null, m.com.criterioQualificacao || h("span", { class: "na" }, "Não informado")),
    h("td", null, m.com.fonteInformacao || h("span", { class: "na" }, "Não informado")),
    h("td", null, m.com.custosCompletos ? "Sim" : "Não")));
  const semCom = cur.lancados.filter(m => !m.com).map(m => Fmt.monthShort(m.comp));
  return [top, periodNote(cur, prev),
    h("div", { class: "funnel-grid" },
      h("div", { class: "panel panel-pad" }, h("h2", null, "Da impressão à venda"), h("p", { class: "lead", style: "margin:4px 0 14px" }, "Conversas, leads qualificados e vendas são etapas diferentes e nunca são somadas entre si."), funnel),
      h("div", { class: "panel panel-pad" }, h("h2", null, "Custos e retorno"), h("p", { class: "lead", style: "margin:4px 0 14px" }, "Comparados com o período anterior."), custos,
        h("details", { class: "defs", style: "margin-top:14px" }, h("summary", null, "Como cada métrica é calculada"),
          h("dl", null, ["taxaCliqueLead", "taxaQualificacao", "taxaLeadVenda", "cpl", "cplq", "cacMidia", "cacTotal", "roas"].map(k => [h("dt", null, D[k].nome), h("dd", null, D[k].formula)]))))),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Origem e atribuição. "),
      "O sistema não presume que todas as vendas vieram dos anúncios: entram só as vendas que o cliente atribuiu aos anúncios, com o critério registrado.",
      semCom.length ? ` Sem resultados comerciais informados em: ${semCom.join(", ")}.` : "")),
      crit.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", null, h("tr", null, ["Mês", "Atribuição das vendas", "Critério de qualificação", "Fonte", "Custos completos"].map(t => h("th", null, t)))), h("tbody", null, crit))) : null)];
}

/* =====================================================================
   ANÁLISE ESTRATÉGICA (por mês)
   ===================================================================== */
const ANALISE_CAMPOS = [["resumoExecutivo", "Resumo executivo"], ["funcionou", "O que funcionou"], ["naoFuncionou", "O que não funcionou como esperado"], ["gargalos", "Principais gargalos"],
  ["hipoteses", "Hipóteses para investigar"], ["aprendizados", "Aprendizados"], ["pontosAtencao", "Pontos de atenção para o cliente"]];
function viewAnalise() {
  const g = guard("Análise estratégica"); if (g) return g;
  const c = clienteAtual();
  const top = head(c.nome, "Análise estratégica", null, compPicker());
  const rel = relDe(UI.comp);
  if (!rel) return [top, emptyPanel(`Ainda não há dados de ${Fmt.month(UI.comp)}`, "A análise é feita sobre um mês lançado. Lance os dados do mês primeiro.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês"))];
  const cur = consMes(UI.comp), prevComp = Fmt.previousComp(UI.comp), prev = consMes(prevComp);
  const an = docDe("analises", rel.id);
  const edit = h("button", { class: "btn " + (an ? "" : "btn-primary"), type: "button", disabled: !canWrite(), onclick: () => openAnaliseForm(rel, an) }, an ? "Editar análise" : "Escrever análise");
  const blocks = ANALISE_CAMPOS.map(([k, l]) => h("div", { class: "an-block" }, h("h3", null, l), an && an[k] ? h("p", { class: "pre" }, an[k]) : h("p", { class: "na" }, "Não preenchido.")));
  const acoes = an && an.acoes && an.acoes.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", null, h("tr", null, ["Ação", "Responsável", "Prazo", "Status"].map(t => h("th", null, t)))),
    h("tbody", null, an.acoes.map(a => h("tr", null, h("td", { style: "white-space:normal" }, a.acao), h("td", null, a.responsavel || Fmt.NA), h("td", null, a.prazo ? Fmt.date(a.prazo) : Fmt.NA),
      h("td", null, h("span", { class: "pill " + ({ pendente: "pausado", andamento: "ativo", feito: "encerrado" }[a.status] || "pausado") }, Domain.STATUS_ACAO[a.status] || "Pendente"))))))) : h("p", { class: "na pad-x" }, "Nenhuma ação registrada.");
  const tm = testesDoMes(UI.comp);
  return [top,
    h("p", { class: "period-note" }, `${Fmt.month(UI.comp)} · comparado com ${Fmt.month(prevComp)}${prev ? "" : " (sem dados)"}`),
    leituraPanel(cur, prev, c),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, "Sua interpretação do mês. O resumo executivo, os aprendizados, os pontos de atenção e o plano de ação entram no PDF do cliente."), edit),
      h("div", { class: "an-grid pad-x pad-b" }, blocks)),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Próximas ações"))), acoes, h("div", { class: "pad-b" })),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Testes realizados no mês. "), "Testes com datas dentro do mês."),
      h("button", { class: "btn", type: "button", onclick: () => { go("anuncios"); setTimeout(() => document.getElementById("testes")?.scrollIntoView(), 50); } }, "Gerenciar testes")),
      tm.length ? h("div", { class: "test-list" }, tm.map(t => testeCard(c, t, true))) : h("div", { class: "empty" }, h("p", null, "Nenhum teste com datas neste mês.")))];
}
function openAnaliseForm(rel, an) {
  const rows = (an && an.acoes ? an.acoes : []).map(a => ({ ...a }));
  if (!rows.length) rows.push({ acao: "", responsavel: "", prazo: "", status: "pendente" });
  const list = h("div", { class: "acoes" });
  const draw = () => list.replaceChildren(...rows.map((a, i) => h("div", { class: "acao-row", "data-i": i },
    h("div", { class: "field" }, h("label", { for: `ac-${i}-acao` }, `Ação ${i + 1}`), h("input", { id: `ac-${i}-acao`, type: "text", value: a.acao || "", maxlength: 300, oninput: e => { a.acao = e.target.value; } }), h("span", { class: "err", hidden: true })),
    h("div", { class: "grid3" },
      h("div", { class: "field" }, h("label", { for: `ac-${i}-resp` }, "Responsável"), h("input", { id: `ac-${i}-resp`, type: "text", value: a.responsavel || "", maxlength: 80, oninput: e => { a.responsavel = e.target.value; } })),
      h("div", { class: "field" }, h("label", { for: `ac-${i}-prazo` }, "Prazo"), h("input", { id: `ac-${i}-prazo`, type: "date", value: a.prazo || "", oninput: e => { a.prazo = e.target.value; } })),
      h("div", { class: "field" }, h("label", { for: `ac-${i}-st` }, "Status"), h("select", { id: `ac-${i}-st`, onchange: e => { a.status = e.target.value; } },
        Object.entries(Domain.STATUS_ACAO).map(([k, l]) => h("option", { value: k, selected: k === (a.status || "pendente") }, l))))),
    h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { rows.splice(i, 1); draw(); } }, "Remover ação"))));
  draw();
  const node = h("div", { class: "acoes-box" }, h("div", { class: "form-section" }, "Plano de ação"), list,
    h("button", { class: "btn btn-sm", type: "button", onclick: () => { rows.push({ acao: "", responsavel: "", prazo: "", status: "pendente" }); draw(); list.querySelector(`#ac-${rows.length - 1}-acao`)?.focus(); } }, "Adicionar ação"));
  openEntityForm({
    title: `Análise de ${Fmt.month(rel.competencia)}`, kind: "analise", values: an || {}, ctx: {},
    extra: { node, collect: () => {
      const r = Domain.validateAcoes(rows);
      list.querySelectorAll(".acao-row .err").forEach(el => { el.hidden = true; });
      for (const e of r.errors) { const el = list.querySelector(`[data-i="${e.i}"] .err`); if (el) { el.hidden = false; el.textContent = e.acao || e.prazo || e.responsavel; } }
      return r.ok ? { ok: true, value: r.acoes } : { ok: false, message: "Corrija as ações destacadas para salvar." };
    } },
    onSave: async (d, acoes) => {
      await Store.put("analises", rel.id, { ...baseDoc(rel), ...d, acoes, criadoEm: an && an.criadoEm });
      return "Análise salva.";
    },
  });
}

/* =====================================================================
   RELATÓRIOS MENSAIS (PDF)
   ===================================================================== */
function reportModel(c, comp) {
  const m = mesData(comp);
  const cur = Metrics.consolidar([m]);
  const prevComp = Fmt.previousComp(comp), pm = mesData(prevComp);
  const prev = pm.rel ? Metrics.consolidar([pm]) : null;
  const camps = (CD("campanhas") || []).filter(x => x.relatorioId === m.rel.id).sort((a, b) => (b.investimentoCentavos || 0) - (a.investimentoCentavos || 0));
  const evol = Fmt.compsUntil(comp, 6).map(cc => ({ comp: cc, cons: consMes(cc) }));
  return {
    agencia: "Garcia Marketing", cliente: c, comp, rel: m.rel, cur, prev, prevComp,
    campanhas: camps.map(x => ({ ...x, b: Metrics.basicas(x) })), campTotal: Metrics.agregar(camps),
    funil: Metrics.funil(m.resumo, m.com), com: m.com, analise: docDe("analises", m.rel.id),
    testes: testesDoMes(comp), evol, geradoEm: new Date(),
  };
}
function checklist(c, comp) {
  const m = mesData(comp), an = m.rel ? docDe("analises", m.rel.id) : null;
  const R = m.resumo || {};
  const camps = m.rel ? mesCol("campanhas", m.rel.id) || [] : [];
  return [
    [R.investimentoCentavos != null && R.impressoes != null, "Resumo do mês preenchido", "Preencha ao menos investimento e impressões."],
    [camps.length > 0, camps.length ? `${camps.length} ${camps.length === 1 ? "campanha lançada" : "campanhas lançadas"}` : "Campanhas", "Sem campanhas, o PDF mostra só os números da conta."],
    [!!m.com, "Resultados comerciais informados", "O PDF vai indicar que leads qualificados, vendas e receita não foram informados."],
    [!!(an && an.resumoExecutivo), "Resumo executivo escrito", "O PDF vai indicar que o resumo executivo não foi preenchido."],
    [!!(an && (an.aprendizados || an.funcionou)), "Aprendizados registrados", "Escreva na Análise estratégica."],
    [!!(an && an.acoes && an.acoes.length), "Plano de ação registrado", "Registre as próximas ações na Análise estratégica."],
    [!!relDe(Fmt.previousComp(comp)), `Mês anterior (${Fmt.monthShort(Fmt.previousComp(comp))}) lançado`, "Sem ele, os indicadores aparecem sem comparação."],
  ];
}
async function gerarPdf(c, comp, btn) {
  const label = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Gerando…"; }
  try {
    const model = reportModel(c, comp);
    const blob = await PdfReport.generate(model);
    const nome = `relatorio-${Domain.norm(c.nome).replace(/[^a-z0-9]+/g, "-")}-${comp}.pdf`;
    await Downloads.save(nome, blob);
    try { await Store.patch("relatorios", model.rel.id, { ultimoPdfEm: new Date().toISOString() }); } catch {}
    toast("PDF pronto para salvar.");
  } catch (e) {
    if (e && e.code === "declined") toast("Download cancelado.");
    else if (e && e.code === "pdf_lib") toast("O gerador de PDF não carregou. Recarregue a página e tente de novo.", "bad");
    else { console.error(e); toast("Não foi possível gerar o PDF.", "bad"); }
  } finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
function viewRelatorios() {
  const g = guard("Relatórios mensais"); if (g) return g;
  const c = clienteAtual();
  const top = head(c.nome, "Relatórios mensais", null, compPicker());
  const rel = relDe(UI.comp);
  const lista = mesesLancados().slice().reverse();
  const tabela = lista.length ? h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Todos os meses. "), "Gere de novo sempre que editar os dados: o PDF sai sempre do que está salvo.")),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Mês", "Pendências", "Último PDF", ""].map(t => h("th", null, t)))),
      h("tbody", null, lista.map(comp => { const ck = checklist(c, comp), pend = ck.filter(x => !x[0]).length, r = relDe(comp);
        const b = h("button", { class: "btn btn-sm", type: "button", onclick: () => gerarPdf(c, comp, b) }, "Gerar PDF");
        return h("tr", null, h("td", null, Fmt.month(comp)), h("td", null, pend ? `${pend} ${pend === 1 ? "item" : "itens"}` : "Completo"),
          h("td", null, r.ultimoPdfEm ? Fmt.datetime(r.ultimoPdfEm) : h("span", { class: "na" }, "Nunca gerado")),
          h("td", null, h("div", { class: "row-actions" }, h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { UI.comp = comp; Prefs.set("comp", comp); render(); } }, "Ver checklist"), b))); }))))) : null;
  if (!rel) return [top, emptyPanel(`Ainda não há dados de ${Fmt.month(UI.comp)}`, "O relatório é gerado a partir de um mês lançado.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("lancamentos") }, "Lançar dados do mês")), tabela];
  const ck = checklist(c, UI.comp);
  const btn = h("button", { class: "btn btn-primary", type: "button" }, `Gerar PDF de ${Fmt.month(UI.comp)}`);
  btn.addEventListener("click", () => gerarPdf(c, UI.comp, btn));
  return [top,
    h("div", { class: "panel panel-pad report-box" },
      h("div", null, h("h2", null, `Relatório de ${Fmt.month(UI.comp)}`),
        h("p", { class: "lead", style: "margin:4px 0 14px" }, "O PDF reúne identificação, período, resumo executivo, indicadores com comparação, evolução, campanhas, funil, aprendizados, pontos de atenção e plano de ação. O que não foi informado aparece como “Não informado”."),
        h("ul", { class: "check-list" }, ck.map(([ok, l, dica]) => h("li", { class: ok ? "ok" : "warn" }, h("span", { class: "ck", "aria-hidden": "true" }, ok ? "✓" : "!"),
          h("span", null, h("span", { class: "sr" }, ok ? "Pronto: " : "Pendente: "), l, ok ? null : h("span", { class: "sub", style: "display:block" }, dica)))))),
      h("div", { class: "report-actions" }, btn, h("span", { class: "sub" }, rel.ultimoPdfEm ? `Último PDF: ${Fmt.datetime(rel.ultimoPdfEm)}` : "Nenhum PDF gerado ainda"),
        h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => go("analise") }, "Abrir análise estratégica"))),
    tabela];
}

/* =====================================================================
   HISTÓRICO
   ===================================================================== */
function viewHistorico() {
  const g = guard("Histórico"); if (g) return g;
  const c = clienteAtual();
  const lista = mesesLancados();
  if (!lista.length) return semLancamentos(c, "Histórico");
  const desc = lista.slice().reverse();
  const top = head(c.nome, "Histórico", `${lista.length} ${lista.length === 1 ? "mês lançado" : "meses lançados"}, de ${Fmt.monthShort(lista[0])} a ${Fmt.monthShort(lista[lista.length - 1])}.`);
  const tabela = h("div", { class: "panel" }, h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", null, h("tr", null, ["Mês", "Investimento", "Resultados", "Custo/resultado", "CTR", "CPM", "Leads qualif.", "Vendas", "ROAS", "Análise", ""].map((t, i) => h("th", { class: i >= 1 && i <= 8 ? "num" : null }, t)))),
    h("tbody", null, desc.map(comp => { const k = consMes(comp), r = relDe(comp), an = docDe("analises", r.id);
      return h("tr", null, h("td", null, h("div", { class: "name" }, Fmt.month(comp))),
        ncell(k.investimentoCentavos.v, "moeda"), h("td", { class: "num" }, k.resultados.v == null ? Fmt.NA : `${Fmt.integer(k.resultados.v)} ${Domain.tipoLabel(k.tipoResultado, k.tipoResultadoOutro, true) || ""}`),
        mcell(k.cpr, "moeda"), mcell(k.ctr, "pct"), mcell(k.cpm, "moeda"), ncell(k.leadsQualificados.v), ncell(k.vendas.v), mcell(k.roas, "x"),
        h("td", null, an ? "Escrita" : h("span", { class: "na" }, "—")),
        h("td", null, h("div", { class: "row-actions" },
          h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { UI.comp = comp; Prefs.set("comp", comp); UI.tab = "resumo"; go("lancamentos"); } }, "Abrir"),
          h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { UI.comp = comp; Prefs.set("comp", comp); go("relatorios"); } }, "PDF")))); })))));
  // comparação de dois meses
  if (!lista.includes(UI.cmpB)) UI.cmpB = lista[lista.length - 1];
  if (!lista.includes(UI.cmpA)) UI.cmpA = lista.length > 1 ? lista[lista.length - 2] : lista[0];
  const sel = (id, val, set) => h("select", { id, onchange: e => { set(e.target.value); render(); } }, desc.map(comp => h("option", { value: comp, selected: comp === val }, Fmt.month(comp))));
  const A = consMes(UI.cmpA), B = consMes(UI.cmpB), D = Metrics.DEFS;
  const linhas = [["Investimento", "investimentoCentavos", "moeda", 0], ["Alcance", "alcance", "int", 1], ["Impressões", "impressoes", "int", 1], ["Frequência", "frequencia", "dec", 0],
    ["Cliques no link", "cliquesLink", "int", 1], ["CTR de link", "ctr", "pct", 1], ["CPC de link", "cpc", "moeda", -1], ["CPM", "cpm", "moeda", -1],
    ["Resultados", "resultados", "int", 1], ["Custo por resultado", "cpr", "moeda", -1], ["Leads qualificados", "leadsQualificados", "int", 1], ["Vendas atribuídas", "vendas", "int", 1],
    ["Receita atribuída", "receita", "moeda", 1], ["ROAS", "roas", "x", 1], ["CAC de mídia", "cacMidia", "moeda", -1]];
  const tiposDif = A.tipoResultado !== B.tipoResultado;
  const comp2 = h("div", { class: "panel" },
    h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Comparar dois meses")),
      h("div", { class: "comp-picker" }, h("label", { for: "cmpA", class: "sr" }, "Mês A"), sel("cmpA", UI.cmpA, v => { UI.cmpA = v; }), h("span", { class: "vs" }, "×"), h("label", { for: "cmpB", class: "sr" }, "Mês B"), sel("cmpB", UI.cmpB, v => { UI.cmpB = v; }))),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, h("th", null, "Indicador"), h("th", { class: "num" }, Fmt.monthShort(UI.cmpA)), h("th", { class: "num" }, Fmt.monthShort(UI.cmpB)), h("th", { class: "num" }, "Variação"))),
      h("tbody", null, linhas.map(([l, k, fmt, dir]) => {
        const bloq = (k === "resultados" || k === "cpr") && tiposDif;
        const vr = bloq ? null : Metrics.variacao(B[k].v, A[k].v, dir);
        return h("tr", null, h("td", null, l), mcell(A[k], fmt), mcell(B[k], fmt),
          h("td", { class: "num" }, bloq ? h("span", { class: "na", title: "Tipos de resultado diferentes" }, "Não comparável") : vr ? h("span", { class: "delta " + vr.sentido }, fmt === "pct" ? Fmt.signed("pct", vr.abs) : vr.pct == null ? Fmt.signed(fmt, vr.abs) : Fmt.signedPct(vr.pct)) : h("span", { class: "na" }, Fmt.NA)));
      })))),
    h("p", { class: "table-note" }, "Verde indica melhora e vermelho piora para aquele indicador. Investimento e frequência não têm direção certa e ficam neutros."));
  // aprendizados anteriores
  const ap = desc.map(comp => ({ comp, an: docDe("analises", relDe(comp).id) })).filter(x => x.an && (x.an.aprendizados || x.an.funcionou || x.an.naoFuncionou));
  const testesC = (CD("testes") || []).filter(t => t.status === "concluido").sort((a, b) => (b.fim || "").localeCompare(a.fim || ""));
  const aprend = h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Aprendizados e testes anteriores"))),
    ap.length || testesC.length ? h("div", { class: "pad-x pad-b learn" },
      ap.map(x => h("div", { class: "an-block" }, h("h3", null, Fmt.month(x.comp)),
        x.an.aprendizados ? h("p", { class: "pre" }, x.an.aprendizados) : null,
        x.an.funcionou ? h("p", { class: "pre" }, h("strong", null, "Funcionou: "), x.an.funcionou) : null,
        x.an.naoFuncionou ? h("p", { class: "pre" }, h("strong", null, "Não funcionou: "), x.an.naoFuncionou) : null)),
      testesC.length ? h("div", { class: "test-list flush" }, testesC.map(t => testeCard(c, t, true))) : null)
      : h("div", { class: "empty" }, h("p", null, "Nenhum aprendizado ou teste concluído registrado ainda.")));
  return [top, evolucao(lista.slice(-24), "Evolução de todos os meses"), tabela, comp2, aprend];
}
