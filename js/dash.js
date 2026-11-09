"use strict";
/* =====================================================================
   DASHBOARD DE TRÁFEGO
   - Todos os clientes: faixa com o total e um cartão por cliente (ranking).
   - Cliente: abas (Visão geral, Meta Ads, Google Ads, Campanhas, ...).
   - Conexões: plataformas e contas de cada cliente e última sincronização.
   Os números vêm do lançamento do mês (manual ou sincronizado do Meta/Google).
   ===================================================================== */
const ROTAS_CLIENTE = ["dias", "campanhas", "conjuntos", "anuncios", "analise", "lancamentos", "historico"];
const NOME_PLAT = { meta: "Meta", google: "Google" };
UI.dashOrdem = Prefs.get("dashOrdem") || "receita";
UI.dashPlat = null; // null = visão geral; "meta" | "google"

/** Investimento por plataforma das linhas (campanhas sem plataforma contam como a principal do cliente) */
function invPorPlataforma(c, comps, idx) {
  idx = idx || indiceTrafego();
  const plats = Domain.plataformasDe(c), padrao = plats.length === 1 ? plats[0] : "meta";
  const out = { meta: 0, google: 0 };
  for (const r of idx.rels.filter(r => r.clienteId === c.id && comps.includes(r.competencia))) {
    const camps = idx.camps[r.id] || [];
    if (camps.length) camps.forEach(k => { out[k.plataforma || padrao] += k.investimentoCentavos || 0; });
    else out[padrao] += (r.resumo && r.resumo.investimentoCentavos) || 0;
  }
  return out;
}
const reais = v => v == null ? Fmt.NA : "R$ " + Fmt.integer(Math.round(v / 100));
const pctMidia = K => K.investimentoCentavos.v != null && K.receita.v ? K.investimentoCentavos.v / K.receita.v * 100 : null;
const platTags = c => Domain.plataformasDe(c).map(p => h("span", { class: "plat " + p }, NOME_PLAT[p]));

/* ---------- todos os clientes ---------- */
function viewDashboard() {
  const idx = indiceTrafego(), { cur, prev } = compsVisao();
  const clientes = clientesTrafego(idx);
  const ordem = h("select", { class: "sel-ordem", "aria-label": "Ordenar clientes", onchange: e => { UI.dashOrdem = e.target.value; Prefs.set("dashOrdem", e.target.value); render(); } },
    [["receita", "Faturamento"], ["investimentoCentavos", "Investimento"], ["roas", "ROAS"], ["leads", "Leads"], ["nome", "Nome"]].map(([v, l]) => h("option", { value: v, selected: UI.dashOrdem === v }, `Ordenar: ${l}`)));
  const ultimaSync = clientes.map(c => c.sincronizadoEm).filter(Boolean).sort().pop();
  const top = head("Tráfego pago", "Dashboard", `Faturamento × investimento × ROAS de todos os clientes${ultimaSync ? ` · última sincronização ${Fmt.datetime(ultimaSync)}` : ""}.`, [ordem, periodPicker()]);
  if (!clientes.length) return [top, emptyPanel("Nenhum cliente de tráfego ainda", "Cadastre um cliente com o serviço Tráfego pago e conecte a conta de anúncios dele.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  const linhas = clientes.map(c => {
    const lc = linhasDe(c, cur, idx), lp = linhasDe(c, prev, idx);
    const K = Desempenho.consolidar(lc), P = lp.length ? Desempenho.consolidar(lp) : null;
    return { c, lc, lp, K, P, aval: Desempenho.avaliar(K, c.metas, lc), plat: invPorPlataforma(c, cur, idx) };
  });
  const comDados = linhas.filter(x => x.lc.length);
  const KT = Desempenho.consolidar(comDados.flatMap(x => x.lc), { carteira: true });
  const lpT = linhas.flatMap(x => x.lp), PT = lpT.length ? Desempenho.consolidar(lpT, { carteira: true }) : null;
  const platT = linhas.reduce((s, x) => ({ meta: s.meta + x.plat.meta, google: s.google + x.plat.google }), { meta: 0, google: 0 });
  const cont = { ok: 0, perto: 0, fora: 0, sem: 0 }; comDados.forEach(x => cont[Desempenho.saude(x.aval)]++);
  const varTxt = (k, P) => { if (!P || !P[k]) return null; const vr = Metrics.variacao(KT[k].v, P[k].v, 0); return vr && vr.pct != null ? `${vr.pct >= 0 ? "▲" : "▼"} ${Fmt.integer(Math.abs(vr.pct))}% vs. anterior` : null; };
  const strip = h("div", { class: "dash-strip" },
    [["Faturamento total", reais(KT.receita.v), varTxt("receita", PT) || (KT.receita.v == null ? "informe as vendas em Resultados comerciais" : null)],
     ["Total investido", reais(KT.investimentoCentavos.v), [platT.meta ? `Meta ${reais(platT.meta)}` : null, platT.google ? `Google ${reais(platT.google)}` : null].filter(Boolean).join(" · ") || null],
     ["ROAS geral", Fmt.metric("x", KT.roas.v), varTxt("roas", PT)],
     ["% de mídia", pctMidia(KT) == null ? Fmt.NA : Fmt.metric("pct", pctMidia(KT)), "investido ÷ faturamento"],
     ["Leads e conversas", Fmt.metric("int", KT.leads.v), KT.cpl.v != null ? `CPL médio ${Fmt.money(KT.cpl.v)}` : null],
     ["Clientes", Fmt.integer(clientes.length), [cont.ok ? `${cont.ok} no alvo` : null, cont.perto ? `${cont.perto} em atenção` : null, cont.fora ? `${cont.fora} fora` : null].filter(Boolean).join(" · ") || `${comDados.length} com dados no período`]]
      .map(([l, v, s]) => h("div", null, h("span", null, l), h("b", null, v), s ? h("em", null, s) : null)));
  const val = x => UI.dashOrdem === "nome" ? null : (x.K[UI.dashOrdem] || {}).v;
  const ord = linhas.slice().sort((a, b) => {
    if (UI.dashOrdem === "nome") return a.c.nome.localeCompare(b.c.nome, "pt-BR");
    const va = val(a), vb = val(b);
    if (va == null && vb == null) return a.c.nome.localeCompare(b.c.nome, "pt-BR");
    if (va == null) return 1; if (vb == null) return -1; return vb - va;
  });
  const cards = ord.map((x, i) => cardCliente(x, i + 1));
  const add = h("button", { type: "button", class: "dcard dcard-add", onclick: () => go("conexoes") }, h("span", { class: "plus", "aria-hidden": "true" }, "+"), h("strong", null, "Conectar conta de anúncios"), h("span", null, "Ligue a conta do Meta ou do Google a um cliente cadastrado"));
  return [top, ...notaPeriodo(cur, prev, comDados.flatMap(x => x.lc), lpT), strip, h("div", { class: "dash-grid" }, cards, add),
    h("p", { class: "table-note", style: "text-align:center" }, "Faturamento vem do que o cliente informa em Resultados comerciais. Investimento, leads e custos vêm do Meta e do Google.")];
}
function cardCliente(x, rank) {
  const { c, K, P } = x, sem = !x.lc.length, st = Desempenho.saude(x.aval);
  const plats = Domain.plataformasDe(c);
  const m = (l, k, fmt, big) => h("div", { class: "dm" + (big ? " big" : "") }, h("span", null, l), h("b", { class: K[k] && K[k].v == null ? "na" : null, title: K[k] && K[k].v == null ? K[k].m : null }, Fmt.metric(fmt, K[k] ? K[k].v : null)));
  const vrLeads = P ? Metrics.variacao(K.leads.v, P.leads.v, 0) : null;
  const tot = x.plat.meta + x.plat.google;
  const barra = tot ? h("div", null, h("div", { class: "pbar" }, plats.map(p => x.plat[p] ? h("i", { class: p, style: `width:${(x.plat[p] / tot * 100).toFixed(1)}%` }) : null)),
    h("div", { class: "pleg" }, plats.map(p => h("span", null, `${NOME_PLAT[p]} ${Fmt.money(x.plat[p])}`)))) : null;
  return h("article", { class: "dcard" + (sem ? " vazio" : "") },
    h("div", { class: "dc-h" }, h("div", { style: "min-width:0" },
      h("div", { class: "dc-tags" }, c.segmento ? h("span", { class: "tag-seg" }, c.segmento) : null, sem ? null : h("span", { class: "rank" }, `${rank}º`)),
      h("h2", { class: "dc-n" }, c.nome),
      h("div", { class: "dc-p" }, platTags(c), sem ? h("span", { class: "sub" }, "Sem dados no período") : st !== "sem" ? h("span", { class: "saude " + st }, h("i", { "aria-hidden": "true" }), SAUDE[st]) : null)),
      h("button", { class: "btn btn-sm", type: "button", onclick: () => abrirCliente(c.id) }, "Dashboard ›")),
    sem ? h("p", { class: "muted-line", style: "margin:14px 0 0" }, c.sincronizadoEm ? "Nenhum dado no período escolhido." : (c.metaContaId || c.googleContaId) ? "Conta ligada. Os dados chegam na próxima sincronização." : "Ligue a conta de anúncios em Conexões ou lance os dados do mês.") :
    h("div", { class: "dc-m" }, m("Faturamento", "receita", "moeda", true), m("Total investido", "investimentoCentavos", "moeda", true), m("ROAS geral", "roas", "x"),
      h("div", { class: "dm" }, h("span", null, "% de mídia"), h("b", { class: pctMidia(K) == null ? "na" : null }, pctMidia(K) == null ? Fmt.NA : Fmt.metric("pct", pctMidia(K)))),
      h("div", { class: "dm" }, h("span", null, "Leads e conversas"), h("b", null, Fmt.metric("int", K.leads.v), vrLeads && vrLeads.pct != null ? h("small", { class: vrLeads.pct >= 0 ? "up" : "dn" }, ` ${Fmt.signedPct(vrLeads.pct)}`) : null)),
      m("Custo por lead", "cpl", "moeda")),
    sem ? null : barra);
}

/* ---------- abas do cliente ---------- */
function abasCliente(c) {
  const plats = Domain.plataformasDe(c);
  const abas = [["geral", "Visão geral"], ...plats.map(p => ["plat-" + p, Domain.PLATAFORMAS[p]]), ["campanhas", "Campanhas"], ["conjuntos", "Conjuntos"], ["anuncios", "Anúncios"], ["dias", "Diário"], ["analise", "Análise"], ["lancamentos", "Lançar dados"], ["historico", "Histórico"]];
  const atual = UI.view === "visao" ? (UI.dashPlat ? "plat-" + UI.dashPlat : "geral") : UI.view;
  const abrir = k => {
    if (k === "geral" || k.startsWith("plat-")) { UI.dashPlat = k === "geral" ? null : k.slice(5); UI.visaoModo = "cliente"; Prefs.set("visaoModo", "cliente"); go("visao"); }
    else go(k);
  };
  return h("div", { class: "dash-cli" },
    h("div", { class: "dash-cli-h" }, h("button", { class: "linkbtn back", type: "button", onclick: () => { UI.visaoModo = "todos"; Prefs.set("visaoModo", "todos"); UI.dashPlat = null; go("visao"); } }, "‹ Todos os clientes"),
      h("div", { class: "dash-cli-n" }, h("strong", null, c.nome), platTags(c), c.sincronizadoEm ? h("span", { class: "sub" }, `sincronizado ${Fmt.datetime(c.sincronizadoEm)}`) : null)),
    h("nav", { class: "dash-tabs", "aria-label": "Seções do cliente" }, abas.map(([k, l]) => h("button", { type: "button", "aria-current": atual === k ? "page" : null, onclick: () => abrir(k) }, l))));
}

/* ---------- aba de uma plataforma ---------- */
function visaoPlataforma(c, plat) {
  const idx = indiceTrafego(), { cur, prev } = compsVisao();
  const plats = Domain.plataformasDe(c), padrao = plats.length === 1 ? plats[0] : "meta";
  const linhasPlat = comps => idx.rels.filter(r => r.clienteId === c.id && comps.includes(r.competencia)).map(r => {
    const camps = (idx.camps[r.id] || []).filter(k => (k.plataforma || padrao) === plat);
    const soma = k => camps.some(x => Fmt.isNum(x[k])) ? camps.reduce((s, x) => s + (x[k] || 0), 0) : null;
    return { camps, linha: Desempenho.linha({ comp: r.competencia, clienteId: c.id, resumo: { investimentoCentavos: soma("investimentoCentavos"), impressoes: soma("impressoes"), cliquesLink: soma("cliquesLink") }, campanhas: camps, periodoInicio: r.periodoInicio, periodoFim: r.periodoFim }) };
  }).filter(x => x.camps.length);
  const lc = linhasPlat(cur), lp = linhasPlat(prev);
  const K = Desempenho.consolidar(lc.map(x => x.linha)), P = lp.length ? Desempenho.consolidar(lp.map(x => x.linha)) : null;
  const top = head(`Tráfego pago · ${Domain.PLATAFORMAS[plat]}`, c.nome, null, periodPicker());
  if (!lc.length) return [top, emptyPanel(`Sem campanhas do ${Domain.PLATAFORMAS[plat]} em ${Fmt.periodLabel(cur)}`,
    plat === "google" ? "Os dados do Google Ads chegam pela sincronização automática depois que a conta for autorizada." : "Os dados chegam pela sincronização automática ou pelo lançamento do mês.")];
  const camps = Object.values(lc.flatMap(x => x.camps).reduce((m, k) => { const a = m[k.nome] ||= { nome: k.nome, inv: 0, imp: 0, cli: 0, res: 0, tipo: k.tipoResultado, status: k.status }; a.inv += k.investimentoCentavos || 0; a.imp += k.impressoes || 0; a.cli += k.cliquesLink || 0; a.res += k.resultados || 0; return m; }, {})).sort((a, b) => b.inv - a.inv);
  const ST = { ACTIVE: ["Ativa", "ok"], PAUSED: ["Pausada", "perto"], CAMPAIGN_PAUSED: ["Pausada", "perto"], WITH_ISSUES: ["Com problema", "fora"], IN_PROCESS: ["Agendada", "sem"] };
  return [top, ...notaPeriodo(cur, prev, lc.map(x => x.linha), lp.map(x => x.linha)),
    h("div", { class: "panel panel-pad" }, ...grupoKpis(Domain.PLATAFORMAS[plat], ["investimentoCentavos", "impressoes", "cliquesLink", "ctr", "cpc", "cpm"], K, P, []),
      ...grupoKpis("Resultados", plat === "google" ? ["leads", "cpl", "taxaCliqueLead"] : ["conversas", "leadsForm", "leads", "cpl", "taxaCliqueLead"], K, P, [])),
    h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Campanhas. "), `${camps.length} no período, da que mais investiu para a que menos investiu.`)),
      h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", null, h("tr", null, ["Campanha", "Investido", "Impressões", "Cliques", "CTR", "Resultados", "Custo por resultado", "Status"].map((t, i) => h("th", { class: i && i < 7 ? "num" : null }, t)))),
        h("tbody", null, camps.map(k => h("tr", null, h("td", null, h("div", { class: "name" }, k.nome), k.tipo ? h("div", { class: "sub" }, Domain.TIPOS[k.tipo] || k.tipo) : null),
          h("td", { class: "num" }, Fmt.money(k.inv)), h("td", { class: "num" }, Fmt.integer(k.imp)), h("td", { class: "num" }, Fmt.integer(k.cli)),
          h("td", { class: "num" }, k.imp ? Fmt.metric("pct", k.cli / k.imp * 100) : Fmt.NA), h("td", { class: "num" }, k.res ? Fmt.integer(k.res) : Fmt.NA),
          h("td", { class: "num" }, k.res ? Fmt.money(k.inv / k.res) : Fmt.NA),
          h("td", null, k.status && ST[k.status] ? h("span", { class: "otm-sit " + { ok: "emdia", perto: "hoje", fora: "atrasada", sem: "sem" }[ST[k.status][1]] }, ST[k.status][0]) : h("span", { class: "na" }, "—"))))))))];
}

/** Meta × Google lado a lado (visão geral de quem usa as duas) */
function comparaPlataformas(c) {
  const idx = indiceTrafego(), { cur } = compsVisao();
  const tot = { meta: { inv: 0, imp: 0, cli: 0, leads: 0 }, google: { inv: 0, imp: 0, cli: 0, leads: 0 } };
  for (const r of idx.rels.filter(r => r.clienteId === c.id && cur.includes(r.competencia)))
    for (const k of idx.camps[r.id] || []) { const t = tot[k.plataforma || "meta"]; if (!t) continue; t.inv += k.investimentoCentavos || 0; t.imp += k.impressoes || 0; t.cli += k.cliquesLink || 0; if (["conversas", "leads"].includes(k.tipoResultado)) t.leads += k.resultados || 0; }
  if (!tot.meta.inv && !tot.google.inv) return null;
  const linha = (l, f) => h("tr", null, h("td", null, l), h("td", { class: "num" }, f(tot.meta)), h("td", { class: "num" }, f(tot.google)));
  const div = (a, b, m) => b ? a / b * (m || 1) : null;
  return h("div", { class: "panel panel-pad" }, h("h2", null, "Meta × Google"),
    h("table", { class: "data vs" }, h("thead", null, h("tr", null, h("th"), h("th", { class: "num" }, h("span", { class: "plat meta" }, "Meta")), h("th", { class: "num" }, h("span", { class: "plat google" }, "Google")))),
      h("tbody", null, linha("Investimento", t => Fmt.money(t.inv)), linha("Impressões", t => Fmt.integer(t.imp)), linha("Cliques", t => Fmt.integer(t.cli)),
        linha("CTR", t => Fmt.metric("pct", div(t.cli, t.imp, 100))), linha("CPC", t => Fmt.metric("moeda", div(t.inv, t.cli))),
        linha("Leads e conversas", t => Fmt.integer(t.leads)), linha("Custo por lead", t => Fmt.metric("moeda", div(t.inv, t.leads))))));
}

/* ---------- conexões ---------- */
function viewConexoes() {
  const top = head("Tráfego pago", "Conexões", "Plataformas e contas de anúncio de cada cliente. A sincronização automática roda toda manhã e traz o dia anterior.");
  if (Store.state.clientes == null) return [top, loadingPanel()];
  const lista = clientesOrdenados().filter(c => !c.interno && ((c.servicos || []).includes("trafego") || c.metaContaId || c.googleContaId));
  if (!lista.length) return [top, emptyPanel("Nenhum cliente de tráfego", "Marque o serviço Tráfego pago no cadastro do cliente.", h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  const conta = (c, p) => {
    if (!Domain.plataformasDe(c).includes(p)) return h("span", { class: "na" }, "Não usa");
    const id = p === "meta" ? c.metaContaId : c.googleContaId;
    return id ? h("span", null, id) : h("span", { class: "otm-sit hoje" }, "Falta o ID da conta");
  };
  return [top, h("div", { class: "panel" }, h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", null, h("tr", null, ["Cliente", "Plataformas", "Conta do Meta", "Conta do Google Ads", "Última sincronização", ""].map(t => h("th", null, t)))),
    h("tbody", null, lista.map(c => h("tr", null,
      h("td", null, h("div", { class: "name" }, c.nome), h("div", { class: "sub" }, Domain.STATUS[c.status || "ativo"])),
      h("td", null, h("div", { class: "dc-p" }, platTags(c))),
      h("td", null, conta(c, "meta")), h("td", null, conta(c, "google")),
      h("td", null, c.sincronizadoEm ? [h("div", null, Fmt.datetime(c.sincronizadoEm)), c.sincronizadoAte ? h("div", { class: "sub" }, `dados até ${Fmt.date(c.sincronizadoAte)}`) : null] : h("span", { class: "na" }, "Ainda não")),
      h("td", { class: "num" }, h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: () => openConexaoForm(c) }, "Editar")))))))),
    h("div", { class: "panel panel-pad" }, h("h2", null, "Como funciona"),
      h("ul", { class: "doc-list" },
        h("li", null, "Marque em cada cliente se ele anuncia no Meta, no Google ou nos dois, e informe o ID da conta."),
        h("li", null, "Toda manhã a sincronização busca o dia anterior de cada conta e atualiza o dashboard, o diário e as campanhas do mês."),
        h("li", null, "Faturamento e vendas continuam vindo do que o cliente informa em Resultados comerciais (aba Lançar dados).")))];
}
function openConexaoForm(c) {
  gavetaForm({
    title: `Conexão · ${c.nome}`, values: { meta: Domain.plataformasDe(c).includes("meta"), google: Domain.plataformasDe(c).includes("google"), metaContaId: c.metaContaId, googleContaId: c.googleContaId },
    spec: [
      { section: "Plataformas de anúncio" },
      { k: "meta", l: "Meta Ads (Facebook e Instagram)", type: "bool" },
      { k: "google", l: "Google Ads", type: "bool" },
      { section: "Contas" },
      { k: "metaContaId", l: "ID da conta do Meta", max: 30, help: "Só os números. No Gerenciador de Anúncios, aparece abaixo do nome da conta." },
      { k: "googleContaId", l: "ID da conta do Google Ads", max: 14, help: "Formato 123-456-7890, no canto superior direito do Google Ads." },
    ],
    validate: d => {
      const e = {};
      if (!d.meta && !d.google) e.meta = "Marque pelo menos uma plataforma.";
      const m = String(d.metaContaId || "").replace(/^act_/i, "");
      if (m && !/^\d{5,25}$/.test(m)) e.metaContaId = "Use só os números do ID da conta.";
      if (d.googleContaId && !/^\d{3}-?\d{3}-?\d{4}$/.test(d.googleContaId)) e.googleContaId = "Use o formato 123-456-7890.";
      return e;
    },
    onSave: async d => {
      const g = String(d.googleContaId || "").replace(/^(\d{3})-?(\d{3})-?(\d{4})$/, "$1-$2-$3");
      await Store.patch("clientes", c.id, { plataformas: [d.meta ? "meta" : null, d.google ? "google" : null].filter(Boolean), metaContaId: String(d.metaContaId || "").replace(/^act_/i, "") || null, googleContaId: g || null });
      return "Conexão salva.";
    },
  });
}
