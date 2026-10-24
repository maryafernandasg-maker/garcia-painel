"use strict";
/* =====================================================================
   CALENDÁRIO DIÁRIO — intervalos livres de datas, comparação e dia a dia
   ===================================================================== */
const DM = {
  investimento: { l: "Investimento", fmt: "moeda", dir: 0, kind: "bar", get: r => r.investimentoCentavos.v },
  resultados: { l: "Resultados", fmt: "int", dir: 1, kind: "bar", get: r => r.resultados.v },
  cpr: { l: "Custo por resultado", fmt: "moeda", dir: -1, kind: "line", get: r => r.cpr.v },
  cliques: { l: "Cliques no link", fmt: "int", dir: 1, kind: "bar", get: r => r.cliquesLink.v },
  ctr: { l: "CTR de link", fmt: "pct", dir: 1, kind: "line", get: r => r.ctr.v },
  cpm: { l: "CPM", fmt: "moeda", dir: -1, kind: "line", get: r => r.cpm.v },
  igVisitas: { l: "Visitas ao perfil", fmt: "int", dir: 1, kind: "bar", ig: "visitasPerfil" },
  igSeguidores: { l: "Novos seguidores", fmt: "int", dir: 1, kind: "bar", ig: "novosSeguidores" },
};
/** Valor de um indicador num dia (anúncios ou Instagram) */
function valorDia(met, d) {
  if (met.ig) { const x = igDiaMap()[d.data]; return x && Fmt.isNum(x[met.ig]) ? x[met.ig] : null; }
  return d.dados ? met.get(d.r) : null;
}
const dd = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function linhasDiarias() { return (CD("diarios") || []).flatMap(d => d.linhas || []); }

function viewDias() {
  const g = guard("Calendário diário"); if (g) return g;
  const c = clienteAtual();
  const L = linhasDiarias();
  const top = head(c.nome, "Calendário diário", null, [L.length ? h("button", { class: "btn btn-primary", type: "button", onclick: () => openPdfPeriodo(c) }, "Gerar PDF do período") : null, importDiarioBtn(c)]);
  if (!L.length) return [top, emptyPanel("Nenhum dado diário importado",
    "Para analisar por dia, exporte do Gerenciador de Anúncios o relatório de campanhas com Detalhamento → Por tempo → Dia e importe aqui. Pode ser o mês completo ou o mês em andamento.",
    importDiarioBtn(c, true))];
  const datas = L.map(l => l.data).sort(), minD = datas[0], maxD = datas[datas.length - 1];
  if (!UI.dIni || !UI.dFim || UI.dCli !== c.id) { UI.dCli = c.id; UI.dFim = maxD; UI.dIni = maxD.slice(0, 8) + "01"; UI.calMes = maxD.slice(0, 7); UI.pick = null; UI.dCamp = "todas"; }
  const camps = [...new Set(L.map(l => l.campanha))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (UI.dCamp !== "todas" && !camps.includes(UI.dCamp)) UI.dCamp = "todas";
  const LF = UI.dCamp === "todas" ? L : L.filter(l => l.campanha === UI.dCamp);
  const tipo = Diario.tipoPrincipal(LF, Domain.TIPO_PADRAO[c.objetivo]);
  const tipoCurto = tipo ? Domain.TIPOS_CURTO[tipo] || "resultado" : "resultado";
  const noIntervalo = (a, b) => LF.filter(l => l.data >= a && l.data <= b);
  const cmp = Diario.comparacao(UI.dIni, UI.dFim, UI.dModo || "anterior");
  const cur = Diario.resumo(noIntervalo(UI.dIni, UI.dFim), tipo), prev = Diario.resumo(noIntervalo(cmp.ini, cmp.fim), tipo);
  const diasCom = (a, b) => new Set(noIntervalo(a, b).map(l => l.data)).size;
  const n = Diario.diff(UI.dIni, UI.dFim) + 1, kCur = diasCom(UI.dIni, UI.dFim), kPrev = diasCom(cmp.ini, cmp.fim);
  const setRange = (a, b) => { if (b < a) [a, b] = [b, a]; UI.dIni = a; UI.dFim = b; UI.pick = null; UI.calMes = b.slice(0, 7); render(); };

  /* controles */
  const quick = [
    ["Últimos 7 dias", () => setRange(Diario.add(maxD, -6), maxD)],
    ["Últimos 14 dias", () => setRange(Diario.add(maxD, -13), maxD)],
    ["Últimos 30 dias", () => setRange(Diario.add(maxD, -29), maxD)],
    ["Mês inteiro", () => { const b = Fmt.monthBounds(UI.calMes); setRange(b.inicio, b.fim); }],
    ["Mês anterior", () => { const b = Fmt.monthBounds(Fmt.previousComp(UI.calMes)); setRange(b.inicio, b.fim); }],
  ];
  const dateIn = (id, val, set) => h("input", { id, type: "date", value: val, min: "2023-01-01", onchange: e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) set(e.target.value); } });
  const controles = h("div", { class: "panel panel-pad day-controls" },
    h("div", { class: "dc-row" },
      h("div", { class: "field" }, h("label", { for: "dIni" }, "De"), dateIn("dIni", UI.dIni, v => setRange(v, UI.dFim))),
      h("div", { class: "field" }, h("label", { for: "dFim" }, "Até"), dateIn("dFim", UI.dFim, v => setRange(UI.dIni, v))),
      h("div", { class: "field" }, h("label", { for: "dCamp" }, "Campanha"), h("select", { id: "dCamp", onchange: e => { UI.dCamp = e.target.value; render(); } },
        h("option", { value: "todas" }, "Todas as campanhas"), camps.map(x => h("option", { value: x, selected: x === UI.dCamp }, x))))),
    h("div", { class: "chips" }, h("span", { class: "chips-label" }, "Atalhos:"), quick.map(([l, fn]) => h("button", { class: "chip", type: "button", onclick: fn }, l))),
    h("div", { class: "chips" }, h("span", { class: "chips-label" }, "Comparar com:"),
      [["anterior", "Período anterior"], ["mes", "Mesmas datas do mês anterior"]].map(([k, l]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String((UI.dModo || "anterior") === k), onclick: () => { UI.dModo = k; render(); } }, l))));
  const nota = [h("p", { class: "period-note" }, `${Fmt.date(UI.dIni)} a ${Fmt.date(UI.dFim)} (${n} ${n === 1 ? "dia" : "dias"}, ${kCur} com dados) · comparado com ${Fmt.date(cmp.ini)} a ${Fmt.date(cmp.fim)} (${kPrev} com dados). Dados disponíveis de ${Fmt.date(minD)} a ${Fmt.date(maxD)}.`),
    kCur < n || (kPrev && kPrev < Diario.diff(cmp.ini, cmp.fim) + 1) ? h("p", { class: "period-note partial" }, "Há dias sem dados em um dos períodos (sem veiculação ou não importados). Os totais comparam só o que existe; compare também taxas e custos.") : null];

  /* indicadores */
  const P = kPrev ? prev : null;
  const kpis = h("div", { class: "panel panel-pad" }, h("div", { class: "kpis" },
    kpi("Investimento", cur.investimentoCentavos, P && P.investimentoCentavos, "moeda", 0),
    kpi("Impressões", cur.impressoes, P && P.impressoes, "int", 1),
    kpi("Cliques no link", cur.cliquesLink, P && P.cliquesLink, "int", 1),
    kpi("CTR de link", cur.ctr, P && P.ctr, "pct", 1),
    kpi("CPC de link", cur.cpc, P && P.cpc, "moeda", -1),
    kpi("CPM", cur.cpm, P && P.cpm, "moeda", -1),
    kpi(tipo ? Domain.tipoLabel(tipo) : "Resultados", cur.resultados, P && P.resultados, "int", 1),
    kpi(`Custo por ${tipoCurto.replace(/s$/, "")}`, cur.cpr, P && P.cpr, "moeda", -1)),
    h("p", { class: "table-note", style: "padding:0" }, `O custo por ${tipoCurto.replace(/s$/, "")} considera só o investimento das campanhas que geram ${tipoCurto}${cur.investimentoTipo.v != null ? ` (${Fmt.money(cur.investimentoTipo.v)} no período)` : ""}. Alcance e frequência não aparecem aqui porque não são somáveis entre dias.`));

  /* calendário */
  const met = DM[UI.dMetric] || DM.investimento;
  const [cy, cm] = UI.calMes.split("-").map(Number);
  const bMes = Fmt.monthBounds(UI.calMes);
  const diasMes = Diario.range(bMes.inicio, bMes.fim);
  const serieMes = Diario.serie(LF, bMes.inicio, bMes.fim, tipo);
  const vals = serieMes.map(d => valorDia(met, d));
  const vmax = Math.max(0, ...vals.filter(v => v != null));
  const firstDow = new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(h("div", { class: "cal-cell empty", "aria-hidden": "true" }));
  diasMes.forEach((d, i) => {
    const v = vals[i], inSel = d >= UI.dIni && d <= UI.dFim, inCmp = d >= cmp.ini && d <= cmp.fim;
    const pct = v != null && vmax > 0 ? Math.round(12 + (v / vmax) * 58) : 0;
    cells.push(h("button", {
      type: "button", class: "cal-cell" + (inSel ? " sel" : "") + (inCmp ? " cmp" : "") + (UI.pick === d ? " pick" : "") + (v == null ? " nodata" : ""),
      style: v != null ? `--int:${pct}%` : null, "aria-pressed": String(inSel),
      "aria-label": `${Fmt.date(d)}: ${v == null ? "sem dados" : Fmt.metric(met.fmt, v)}`,
      onclick: () => { if (!UI.pick) { UI.pick = d; UI.dIni = d; UI.dFim = d; render(); } else setRange(UI.pick, d); },
    }, h("span", { class: "cal-d" }, String(Number(d.slice(8)))), h("span", { class: "cal-v" }, v == null ? "—" : Fmt.compact(met.fmt, v).replace("R$ ", ""))));
  });
  const temIG = igDias().length > 0;
  const metChips = h("div", { class: "chips", role: "group", "aria-label": "Indicador" }, Object.entries(DM).filter(([, d]) => !d.ig || temIG).map(([k, d]) =>
    h("button", { class: "chip", type: "button", "aria-pressed": String((UI.dMetric || "investimento") === k), onclick: () => { UI.dMetric = k; render(); } }, k === "cpr" ? `Custo por ${tipoCurto.replace(/s$/, "")}` : k === "resultados" ? (tipo ? Domain.tipoLabel(tipo, null, true).replace(/^./, s => s.toUpperCase()) : d.l) : d.l)));
  const calendario = h("div", { class: "panel panel-pad cal-panel" },
    h("div", { class: "chart-head" },
      h("div", { class: "cal-nav" },
        h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Mês anterior", onclick: () => { UI.calMes = Fmt.previousComp(UI.calMes); render(); } }, "‹"),
        h("h2", null, Fmt.month(UI.calMes).replace(/^./, s => s.toUpperCase())),
        h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Próximo mês", onclick: () => { const [y, m] = UI.calMes.split("-").map(Number); UI.calMes = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; render(); } }, "›")),
      metChips),
    h("p", { class: "chart-note" }, UI.pick ? `Início em ${Fmt.date(UI.pick)}. Clique no último dia do período.` : `Clique em um dia para começar um período e em outro para terminar. A cor mais forte indica o maior valor do mês.${met.fmt === "moeda" ? " Valores em R$." : ""}`),
    h("div", { class: "cal-grid" }, SEMANA.map(s => h("div", { class: "cal-h" }, s)), cells),
    h("div", { class: "cal-legend" }, h("span", { class: "lg sel" }, "Período escolhido"), h("span", { class: "lg cmp" }, "Período de comparação"), h("span", { class: "lg nodata" }, "Sem dados")));

  /* gráfico do período */
  const serie = Diario.serie(LF, UI.dIni, UI.dFim, tipo);
  let grafico = null;
  if (serie.length <= 92) {
    const box = h("div", { class: "chart" });
    const w = Math.max(320, Math.min(1100, (document.getElementById("view")?.clientWidth || 900) - 40));
    box.append(svgNode(Charts.svg({ labels: serie.map(d => dd(d.data)), values: serie.map(d => valorDia(met, d)), fmt: met.fmt, kind: met.kind, width: w, height: 230, colors: chartColors() })));
    grafico = h("div", { class: "panel panel-pad chart-panel" }, h("h2", null, `${met.l} por dia`), box);
  }

  /* dia a dia */
  const serieCmp = Diario.serie(LF, cmp.ini, cmp.fim, tipo);
  const linhas = serie.map((d, i) => {
    const b = Metrics.basicas({ investimentoCentavos: d.r.investimentoCentavos.v, impressoes: d.r.impressoes.v, cliquesLink: d.r.cliquesLink.v });
    const o = serieCmp[i];
    const va = valorDia(met, d), vb = o ? valorDia(met, o) : null;
    const vr = Metrics.variacao(va, vb, met.dir);
    const dow = SEMANA[new Date(Date.UTC(...d.data.split("-").map((x, j) => j === 1 ? x - 1 : +x))).getUTCDay()];
    return h("tr", { class: d.dados ? null : "muted-row" },
      h("td", null, h("div", { class: "name" }, `${dd(d.data)} `, h("span", { class: "sub" }, dow))),
      ncell(d.r.investimentoCentavos.v, "moeda"), ncell(d.r.impressoes.v), ncell(d.r.cliquesLink.v), mcell(b.ctr, "pct"), mcell(b.cpc, "moeda"),
      ncell(d.r.resultados.v), mcell(d.r.cpr, "moeda"),
      h("td", { class: "num sep" }, o ? dd(o.data) : Fmt.NA), h("td", { class: "num" + (vb == null ? " na" : "") }, Fmt.metric(met.fmt, vb)),
      h("td", { class: "num" }, vr ? h("span", { class: "delta " + vr.sentido }, met.fmt === "pct" ? Fmt.signed("pct", vr.abs) : vr.pct == null ? Fmt.signed(met.fmt, vr.abs) : Fmt.signedPct(vr.pct)) : h("span", { class: "na" }, Fmt.NA)));
  });
  const tabela = h("div", { class: "panel" },
    h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Dia a dia. "), `Cada dia do período ao lado do dia correspondente da comparação, pelo indicador “${met.l}”.`)),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Dia", "Investimento", "Impressões", "Cliques", "CTR", "CPC", tipo ? Domain.tipoLabel(tipo, null, true).replace(/^./, s => s.toUpperCase()) : "Resultados", `Custo/${tipoCurto.replace(/s$/, "")}`, "Comparar com", met.l, "Variação"]
        .map((t, i) => h("th", { class: (i ? "num" : "") + (i === 8 ? " sep" : "") }, t)))),
      h("tbody", null, linhas))));
  return [top, controles, nota, kpis, instagramPanel(c, LF, cur, cmp, kPrev), calendario, grafico, tabela, ...secoesAnuncios(c, UI.dIni, UI.dFim, tipo)];
}

/* ---------- conjuntos e criativos no período ---------- */
function linhasAnuncio() { return (CD("diarios") || []).flatMap(d => d.anuncios || []); }
function criativoDe(c, anuncio) { return docDe("criativos", Domain.criativoId(c.id, anuncio)) || null; }
function statusItem(i) {
  return i.melhor ? h("span", { class: "flag best" }, "Melhor custo") : i.vol.baixo ? h("span", { class: "flag", title: i.vol.m }, "Pouco volume") : !i.relevante && i.tipoResultado ? h("span", { class: "flag", title: "Menos de 10% do investimento do período" }, "Pouca verba") : h("span", { class: "flag ok" }, "OK");
}
function secoesAnuncios(c, ini, fim, tipo) {
  const AL = linhasAnuncio().filter(l => l.data >= ini && l.data <= fim && (UI.dCamp === "todas" || l.campanha === UI.dCamp));
  if (!AL.length) return [h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Conjuntos e criativos. "),
    linhasAnuncio().length ? "Sem dados por anúncio neste período." : "Importe o relatório diário por anúncio (com Nome do conjunto de anúncios e Nome do anúncio) para ver conjuntos e criativos aqui e no PDF.")))];
  const conj = Diario.ranking(AL, "conjunto", tipo), ads = Diario.ranking(AL, "anuncio", tipo);
  const resTxt = i => Fmt.isNum(i.resultados) ? Domain.qtdTipo(i.resultados, i.tipoResultado, i.tipoResultadoOutro) : Fmt.NA;
  const cols = (first) => [first, "Dias", "Investimento", "Impressões", "Cliques", "CTR", "CPC", "Resultados", "Custo/resultado", "Situação"];
  const thead = first => h("thead", null, h("tr", null, cols(first).map((t, i) => h("th", { class: i >= 1 && i <= 8 ? "num" : null }, t))));
  const nums = i => [h("td", { class: "num" }, String(i.dias)), ncell(i.investimentoCentavos, "moeda"), ncell(i.impressoes), ncell(i.cliquesLink), mcell(i.ctr, "pct"), mcell(i.cpc, "moeda"), h("td", { class: "num" }, resTxt(i)), mcell(i.cpr, "moeda"), h("td", null, statusItem(i))];
  const regra = h("p", { class: "table-note" }, `Ordem: primeiro quem gera ${tipo ? Domain.tipoLabel(tipo, null, true) : "o resultado principal"}, do menor para o maior custo. “Melhor custo” só é apontado entre quem teve volume (pelo menos ${Fmt.integer(Metrics.VOLUME_MIN.impressoes)} impressões e ${Metrics.VOLUME_MIN.resultados} resultados) e pelo menos 10% do investimento desse tipo no período. Itens com pouco volume ainda estão em teste.`);
  const tConj = h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Conjuntos de anúncios no período"))),
    h("div", { class: "table-wrap" }, h("table", { class: "data" }, thead("Conjunto"), h("tbody", null, conj.map(i => h("tr", null,
      h("td", null, h("div", { class: "name" }, i.conjunto), h("div", { class: "sub" }, i.campanha)), ...nums(i)))))), regra);
  const tAds = h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Anúncios e criativos no período. "), "Adicione a imagem de cada criativo para ela aparecer aqui e no PDF.")),
    h("div", { class: "table-wrap" }, h("table", { class: "data" }, thead("Criativo"), h("tbody", null, ads.map(i => {
      const cr = criativoDe(c, i.anuncio);
      return h("tr", null,
        h("td", null, h("div", { class: "ad-cell" },
          cr && criativoSrc(cr) ? h("img", { class: "thumb", src: criativoSrc(cr), alt: `Criativo ${i.anuncio}`, loading: "lazy" }) : h("div", { class: "thumb empty", "aria-hidden": "true" }, "sem imagem"),
          h("div", { style: "min-width:0" }, h("div", { class: "name" }, i.anuncio), h("div", { class: "sub" }, `${i.conjunto} · ${i.campanha}`),
            criativoBtn(c, i.anuncio, cr)))), ...nums(i));
    })))), regra);
  return [tConj, tAds];
}
/** Imagem do criativo: guardada no próprio registro como imagem reduzida (JPEG), sem serviço de arquivos à parte */
const criativoSrc = cr => cr && cr.imagem ? cr.imagem : null;
async function reduzirImagem(file, max) {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc));
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("conversão")), "image/jpeg", 0.85));
}
function criativoBtn(c, anuncio, cr) {
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true });
  const btn = h("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !canWrite(), onclick: () => input.click() }, cr ? "Trocar imagem" : "Adicionar imagem");
  input.addEventListener("change", async () => {
    const f = input.files && input.files[0]; if (!f) return;
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const blob = await reduzirImagem(f, 480);
      const imagem = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(blob); });
      await Store.put("criativos", Domain.criativoId(c.id, anuncio), { clienteId: c.id, anuncio, imagem, schema: Domain.SCHEMA, criadoEm: cr && cr.criadoEm });
      toast("Imagem do criativo salva.");
    } catch (e) {
      toast(e && e.message === "conversão" ? "Não foi possível ler a imagem. Use PNG, JPG ou WEBP." : "Não foi possível salvar a imagem.", "bad");
      btn.disabled = false; btn.textContent = cr ? "Trocar imagem" : "Adicionar imagem";
    }
  });
  return h("span", { class: "import-wrap" }, btn, input);
}
async function imagemDataUrl(cr) { return criativoSrc(cr); }

/* ---------- importação diária ---------- */
function importDiarioBtn(c, primary) {
  const input = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, id: primary ? "metaCsvDia2" : "metaCsvDia" });
  const btn = h("button", { class: "btn" + (primary ? " btn-primary" : ""), type: "button", disabled: !canWrite(), onclick: () => input.click() }, "Importar CSV diário do Meta");
  input.addEventListener("change", () => {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { input.value = ""; openImportDiario(c, String(rd.result), f.name); };
    rd.onerror = () => toast("Não foi possível ler o arquivo.", "bad");
    rd.readAsText(f, "utf-8");
  });
  return h("span", { class: "import-wrap" }, btn, input);
}

function openImportDiario(c, text, fileName) {
  const r = MetaCsv.importarDiario(text);
  if (!r.ok) {
    const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "id-t" },
      h("h2", { id: "id-t" }, "Não foi possível importar"), h("p", null, r.erro),
      h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => close() }, "Entendi")));
    const close = openOverlay(box, true); return;
  }
  const meses = Object.keys(r.meses).sort();
  const existentes = Object.fromEntries((CD("diarios") || []).map(d => [d.competencia, d]));
  const substituidos = meses.reduce((s, m) => s + new Set((existentes[m]?.linhas || []).filter(l => r.meses[m].some(x => x.data === l.data)).map(l => l.data)).size, 0);
  const mensalExiste = meses.filter(m => { const rl = relDe(m); return rl && (CD("campanhas") || []).some(x => x.relatorioId === rl.id); });
  const nomesMensais = new Set((CD("campanhas") || []).filter(x => meses.includes(x.competencia)).map(x => Domain.norm(x.nome)));
  const naoBatem = mensalExiste.length ? r.campanhas.filter(n => !nomesMensais.has(Domain.norm(n))) : [];
  const chk = h("input", { type: "checkbox", id: "idMensal", checked: !mensalExiste.length });
  const chkEstr = r.nivel === "anuncio" ? h("input", { type: "checkbox", id: "idEstrutura", checked: true }) : null;
  const err = h("p", { class: "err-text", hidden: true });
  const go_ = h("button", { class: "btn btn-primary", type: "button" }, `Importar ${r.dias} ${r.dias === 1 ? "dia" : "dias"}`);
  const drawer = h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "id-title" },
    h("div", { class: "drawer-head" }, h("h2", { id: "id-title" }, "Importar dados diários"), h("button", { class: "btn btn-ghost", type: "button", onclick: () => close() }, "Fechar")),
    h("div", { class: "drawer-body" },
      h("p", { class: "lead", style: "margin:0" }, `${fileName} · ${Fmt.date(r.periodo.inicio)} a ${Fmt.date(r.periodo.fim)} · ${r.dias} dias com veiculação · ${c.nome}`),
      r.nivel === "anuncio" ? h("p", { class: "form-note", style: "margin:0" }, `Arquivo por anúncio: ${new Set(Object.values(r.meses).flat().map(l => l.campanha + "|" + l.conjunto)).size} conjuntos e ${new Set(Object.values(r.meses).flat().map(l => l.anuncio)).size} anúncios. Os totais por campanha e dia são calculados somando os anúncios.`) : null,
      h("div", { class: "form-section" }, "Campanhas no arquivo"),
      h("ul", { class: "doc-list" }, r.campanhas.map(n => h("li", null, n))),
      r.semEntrega.length ? h("p", { class: "form-note", style: "margin:0" }, `Sem veiculação no período: ${r.semEntrega.join(", ")}.`) : null,
      substituidos ? h("p", { class: "form-note", style: "margin:0" }, `${substituidos} ${substituidos === 1 ? "dia já importado será substituído" : "dias já importados serão substituídos"} pelos números deste arquivo. Os demais dias continuam como estão.`) : null,
      mensalExiste.length ? h("p", { class: "form-note", style: "margin:0" }, `${mensalExiste.map(Fmt.monthShort).join(" e ")} já ${mensalExiste.length === 1 ? "tem" : "têm"} lançamento mensal com campanhas. Deixe a opção abaixo desmarcada para manter o lançamento mensal como está.${naoBatem.length ? ` Atenção: ${naoBatem.map(n => `“${n}”`).join(", ")} não tem o mesmo nome no lançamento mensal (o relatório pode ter somado campanhas de mesmo nome).` : ""}`) : null,
      h("label", { class: "check" }, chk, h("span", null, `Atualizar também o lançamento mensal (${meses.map(Fmt.monthShort).join(", ")}) com a soma dos dias: campanhas, investimento, impressões, cliques e resultados. O alcance do mês é mantido.`)),
      chkEstr ? h("label", { class: "check" }, chkEstr, h("span", null, "Preencher também os conjuntos e anúncios de cada mês (áreas Conjuntos e Anúncios do menu) com a soma dos dias. Cada um fica ligado à campanha de mesmo nome do lançamento mensal.")) : null,
      h("div", { class: "banner warn" }, h("div", null, h("strong", null, "Antes de importar"), h("ul", { class: "doc-list", style: "margin-top:6px" }, r.avisos.map(a => h("li", null, a))))),
      err),
    h("div", { class: "drawer-foot" }, h("div", { class: "foot-btns" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), go_)));
  const close = openOverlay(drawer);
  const ignoradas = new Set();
  go_.addEventListener("click", async () => {
    go_.disabled = true; go_.textContent = "Importando…"; err.hidden = true;
    try {
      for (const m of meses) {
        const ex = existentes[m];
        const porAnuncio = r.nivel === "anuncio";
        const linhas = Diario.mesclar(ex && ex.linhas, porAnuncio ? Diario.somarCampanhas(r.meses[m]) : r.meses[m]);
        const doc = { clienteId: c.id, competencia: m, linhas, origem: "meta_csv_diario", schema: Domain.SCHEMA, criadoEm: ex && ex.criadoEm,
          ...(porAnuncio ? { anuncios: Diario.mesclar(ex && ex.anuncios, r.meses[m]) } : ex && ex.anuncios ? { anuncios: ex.anuncios } : {}) };
        if (JSON.stringify(doc).length > 240000) throw { code: "grande", message: `O mês ${Fmt.monthShort(m)} tem linhas demais para guardar por dia. Importe só as campanhas com veiculação.` };
        await Store.put("diarios", `${c.id}_${m}`, doc);
        if (chk.checked) await mensalDeDiarios(c, m, linhas);
        if (chkEstr && chkEstr.checked) (await estruturaDeDiarios(c, m, linhas, doc.anuncios)).forEach(x => ignoradas.add(x));
      }
      if (ignoradas.size) { const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "ig-t" },
        h("h2", { id: "ig-t" }, "Importação concluída, com uma observação"),
        h("p", null, `Os conjuntos e anúncios de ${[...ignoradas].map(x => `“${x}”`).join(", ")} não foram lançados no mês: o relatório do Meta somou campanhas de mesmo nome e não dá para saber de qual delas é cada número. Para evitar isso, dê nomes diferentes a essas campanhas no Gerenciador.`),
        h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => cl2() }, "Entendi")));
        setTimeout(() => { cl2 = openOverlay(box, true); }, 300); }
      let cl2 = () => {};
      close(); UI.dCli = c.id; UI.dFim = r.periodo.fim; UI.dIni = [r.periodo.inicio, r.periodo.fim.slice(0, 8) + "01"].sort()[1]; UI.calMes = r.periodo.fim.slice(0, 7); UI.pick = null; UI.dCamp = "todas";
      toast("Dados diários importados."); go("dias");
    } catch (e) { err.hidden = false; err.textContent = e && e.code === "grande" ? e.message : Store.message(e); go_.disabled = false; go_.textContent = "Tentar de novo"; }
  });
}

/** Atualiza o lançamento mensal a partir da soma dos dias do mês. */
async function mensalDeDiarios(c, comp, linhas) {
  const relId = Domain.relatorioId(c.id, comp);
  const ds = linhas.map(l => l.data).sort();
  let rel = relDe(comp);
  if (!rel) {
    await Store.ensureRelatorio(relId, { clienteId: c.id, competencia: comp, periodoInicio: ds[0], periodoFim: ds[ds.length - 1], status: "rascunho",
      resumo: {}, observacoes: null, fonte: "Gerenciador de Anúncios da Meta (CSV diário importado)", moeda: "BRL", schema: Domain.SCHEMA });
  }
  const camps = Diario.totaisCampanhas(linhas);
  const atuais = (CD("campanhas") || []).filter(x => x.relatorioId === relId);
  const porNome = Object.fromEntries(atuais.map(x => [Domain.norm(x.nome), x]));
  const base = { clienteId: c.id, relatorioId: relId, competencia: comp, schema: Domain.SCHEMA };
  for (const k of camps) {
    const data = { nome: k.nome, investimentoCentavos: k.investimentoCentavos, impressoes: k.impressoes, cliquesLink: k.cliquesLink, resultados: k.resultados, tipoResultado: k.tipoResultado, tipoResultadoOutro: k.tipoResultadoOutro, origem: "meta_csv_diario" };
    const ex = porNome[Domain.norm(k.nome)];
    if (ex) await Store.patch("campanhas", ex.id, data);
    else await Store.put("campanhas", Domain.novoId(k.nome), { ...base, objetivo: null, status: null, periodoInicio: null, periodoFim: null, observacoes: null, alcance: null, ...data });
  }
  const tipo = Diario.tipoPrincipal(linhas, Domain.TIPO_PADRAO[c.objetivo]);
  const tot = Diario.resumo(linhas, tipo);
  const R = (rel && rel.resumo) || {};
  const outros = tot.investimentoCentavos.v - (tot.investimentoTipo.v || 0);
  const obs = tipo && outros > 0 && tot.cpr.v != null ? `Custo por ${Domain.tipoLabel(tipo, null, true)} só nas campanhas desse tipo: ${Fmt.money(tot.cpr.v)} (o resumo divide todo o investimento, incluindo ${Fmt.money(outros)} de campanhas com outros objetivos).` : null;
  await Store.patch("relatorios", relId, {
    periodoInicio: ds[0], periodoFim: ds[ds.length - 1],
    resumo: { ...R, investimentoCentavos: tot.investimentoCentavos.v, impressoes: tot.impressoes.v, cliquesLink: tot.cliquesLink.v, tipoResultado: tipo, tipoResultadoOutro: null, resultados: tot.resultados.v, alcance: R.alcance ?? null },
    ...(obs && !(rel && rel.observacoes) ? { observacoes: obs } : {}),
  });
}

/* ---------- PDF de um período escolhido no calendário ---------- */
function modeloPeriodo(c, comentario, comparar) {
  const L = linhasDiarias();
  const LF = UI.dCamp === "todas" ? L : L.filter(l => l.campanha === UI.dCamp);
  const tipo = Diario.tipoPrincipal(LF, Domain.TIPO_PADRAO[c.objetivo]);
  const no = (a, b) => LF.filter(l => l.data >= a && l.data <= b);
  const cmp = Diario.comparacao(UI.dIni, UI.dFim, UI.dModo || "anterior");
  const prevL = no(cmp.ini, cmp.fim);
  const atual = no(UI.dIni, UI.dFim);
  return {
    cliente: c, ini: UI.dIni, fim: UI.dFim, campanha: UI.dCamp === "todas" ? null : UI.dCamp, tipo,
    cur: Diario.resumo(atual, tipo), prev: comparar && prevL.length ? Diario.resumo(prevL, tipo) : null,
    cmp: comparar && prevL.length ? cmp : null, cmpModo: UI.dModo || "anterior",
    serie: Diario.serie(LF, UI.dIni, UI.dFim, tipo),
    campanhas: Diario.totaisCampanhas(atual).sort((a, b) => (b.investimentoCentavos || 0) - (a.investimentoCentavos || 0)),
    comentario: comentario || null, geradoEm: new Date(),
    instagram: (() => {
      const cur = Diario.resumo(atual, tipo);
      const A = dadosInstagram(LF, UI.dIni, UI.dFim, cur.investimentoCentavos.v);
      if (A.p.visitas.v == null && A.p.seguidores.v == null) return null;
      const B = comparar && prevL.length ? dadosInstagram(LF, cmp.ini, cmp.fim, Diario.resumo(prevL, tipo).investimentoCentavos.v) : null;
      return { A, B: B && (B.p.visitas.v != null || B.p.seguidores.v != null) ? B : null };
    })(),
    ...(() => {
      const AL = linhasAnuncio().filter(l => l.data >= UI.dIni && l.data <= UI.dFim && (UI.dCamp === "todas" || l.campanha === UI.dCamp));
      return AL.length ? { conjuntos: Diario.ranking(AL, "conjunto", tipo), anuncios: Diario.ranking(AL, "anuncio", tipo) } : { conjuntos: null, anuncios: null };
    })(),
  };
}
function openPdfPeriodo(c) {
  const umDia = UI.dIni === UI.dFim;
  const per = umDia ? Fmt.date(UI.dIni) : `${Fmt.date(UI.dIni)} a ${Fmt.date(UI.dFim)}`;
  const txt = h("textarea", { id: "pdfComent", maxlength: 2000, placeholder: "Ex.: semana com feriado; aumentamos o orçamento da campanha de mensagens no dia 12." });
  const chk = h("input", { type: "checkbox", id: "pdfCmp", checked: true });
  const btn = h("button", { class: "btn btn-primary", type: "button" }, "Gerar PDF");
  const box = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "pp-t" },
    h("h2", { id: "pp-t" }, `PDF de ${per}`),
    h("p", null, `${c.nome} · ${UI.dCamp === "todas" ? "todas as campanhas" : UI.dCamp}. Para mudar as datas ou a campanha, feche e ajuste no calendário.`),
    h("div", { class: "field" }, h("label", { for: "pdfComent" }, "Comentários para o cliente (opcional)"), txt),
    h("label", { class: "check" }, chk, h("span", null, `Incluir comparação com ${UI.dModo === "mes" ? "as mesmas datas do mês anterior" : "o período anterior"}`)),
    h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), btn));
  const close = openOverlay(box, true);
  btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = "Gerando…";
    try {
      const modelo = modeloPeriodo(c, txt.value.trim(), chk.checked);
      modelo.imagens = {};
      for (const a of modelo.anuncios || []) {
        const cr = criativoDe(c, a.anuncio);
        if (cr && !(a.anuncio in modelo.imagens)) modelo.imagens[a.anuncio] = await imagemDataUrl(cr);
      }
      const blob = await PdfReport.generatePeriodo(modelo);
      const nome = `relatorio-${Domain.norm(c.nome).replace(/[^a-z0-9]+/g, "-")}-${umDia ? UI.dIni : UI.dIni + "_a_" + UI.dFim}.pdf`;
      await Downloads.save(nome, blob);
      close(); toast("PDF pronto para salvar.");
    } catch (e) {
      if (e && e.code === "declined") { close(); toast("Download cancelado."); return; }
      toast(e && e.code === "pdf_lib" ? "O gerador de PDF não carregou. Recarregue a página." : "Não foi possível gerar o PDF.", "bad");
      btn.disabled = false; btn.textContent = "Gerar PDF";
    }
  });
}

/** Preenche conjuntos e anúncios do lançamento mensal a partir das linhas diárias por anúncio. Devolve as campanhas que ficaram de fora. */
async function estruturaDeDiarios(c, comp, linhasCampanha, linhasAnuncio) {
  const relId = Domain.relatorioId(c.id, comp);
  let camps = await Store.find("campanhas", "relatorioId", relId);
  if (!camps.length) { await mensalDeDiarios(c, comp, linhasCampanha); camps = await Store.find("campanhas", "relatorioId", relId); }
  const est = Diario.estruturaMensal(linhasAnuncio || [], camps);
  const base = { clienteId: c.id, relatorioId: relId, competencia: comp, schema: Domain.SCHEMA, origem: "meta_csv_diario" };
  const metr = x => ({ investimentoCentavos: x.investimentoCentavos, impressoes: x.impressoes, cliquesLink: x.cliquesLink, resultados: x.resultados, tipoResultado: x.tipoResultado, tipoResultadoOutro: x.tipoResultadoOutro });
  const conjEx = await Store.find("conjuntos", "relatorioId", relId);
  const conjId = {};
  for (const k of est.conjuntos) {
    const key = k.campanhaId + "|" + Domain.norm(k.nome);
    const ex = conjEx.find(x => x.campanhaId + "|" + Domain.norm(x.nome) === key);
    if (ex) { await Store.patch("conjuntos", ex.id, { ...metr(k), origem: base.origem }); conjId[key] = ex.id; }
    else { const id = Domain.novoId(k.nome); await Store.put("conjuntos", id, { ...base, campanhaId: k.campanhaId, nome: k.nome, publico: null, posicionamentos: null, alcance: null, observacoes: null, ...metr(k) }); conjId[key] = id; }
  }
  const adEx = await Store.find("anuncios", "relatorioId", relId);
  for (const a of est.anuncios) {
    const cj = conjId[a.campanhaId + "|" + Domain.norm(a.conjuntoNome)] || null;
    const ex = adEx.find(x => x.campanhaId === a.campanhaId && (x.conjuntoId || null) === cj && Domain.norm(x.nome) === Domain.norm(a.nome));
    if (ex) await Store.patch("anuncios", ex.id, { ...metr(a), origem: base.origem, ...(ex.formato ? {} : { formato: a.formato }) });
    else await Store.put("anuncios", Domain.novoId(a.nome), { ...base, campanhaId: a.campanhaId, conjuntoId: cj, nome: a.nome, formato: a.formato, angulo: null, oferta: null, observacoes: null, ...metr(a) });
  }
  return est.ignoradas;
}

/* ---------- Instagram: visitas ao perfil e novos seguidores (planilha diária do Meta) ---------- */
const igDias = () => (CD("instagram") || []).flatMap(d => d.dias || []);
const igDiaMap = () => Object.fromEntries(igDias().map(d => [d.data, d]));
const visitasAnuncios = (LF, a, b) => { const r = LF.filter(l => l.data >= a && l.data <= b && l.tipoResultado === "visitas" && Fmt.isNum(l.resultados)); return r.length ? { v: r.reduce((s, l) => s + l.resultados, 0), m: null } : { v: null, m: "Sem campanhas de visitas ao perfil no período" }; };
function dadosInstagram(LF, ini, fim, investimento) {
  const p = Instagram.periodo(igDias(), ini, fim);
  return { p, t: Instagram.taxas(p, investimento), anuncios: visitasAnuncios(LF, ini, fim) };
}
function instagramPanel(c, LF, cur, cmp, kPrev) {
  const A = dadosInstagram(LF, UI.dIni, UI.dFim, cur.investimentoCentavos.v);
  const prevInv = kPrev ? Diario.resumo(LF.filter(l => l.data >= cmp.ini && l.data <= cmp.fim), null).investimentoCentavos.v : null;
  const B = dadosInstagram(LF, cmp.ini, cmp.fim, prevInv);
  const temB = B.p.visitas.v != null || B.p.seguidores.v != null;
  const docs = (CD("instagram") || []).slice().sort((a, b) => b.competencia.localeCompare(a.competencia));
  const ds = igDias().map(d => d.data).sort();
  return h("div", { class: "panel panel-pad", id: "instagram" },
    h("div", { class: "chart-head" }, h("div", null, h("h2", null, "Instagram"),
      h("p", { class: "lead", style: "margin:2px 0 0" }, ds.length ? `Visitas ao perfil e novos seguidores por dia, importados do Meta (${Fmt.date(ds[0])} a ${Fmt.date(ds[ds.length - 1])}).` : "Importe a planilha diária do Meta com visitas ao perfil e novos seguidores.")),
      importInstagramBtn(c, !ds.length)),
    h("div", { class: "kpis", style: "margin-top:12px" },
      kpi("Visitas ao perfil", A.p.visitas, temB ? B.p.visitas : null, "int", 1),
      kpi("Novos seguidores", A.p.seguidores, temB ? B.p.seguidores : null, "int", 1),
      kpi("Visitas que viraram seguidores", A.t.visitaSeguidor, temB ? B.t.visitaSeguidor : null, "pct", 1),
      kpi("Investimento por novo seguidor", A.t.investimentoPorSeguidor, temB ? B.t.investimentoPorSeguidor : null, "moeda", -1),
      kpi("Visitas ao perfil vindas dos anúncios", A.anuncios, kPrev ? B.anuncios : null, "int", 1)),
    h("p", { class: "table-note", style: "padding:0" },
      docs.length && docs[0].colunas ? `Colunas usadas: ${[docs[0].colunas.visitas, docs[0].colunas.seguidores].filter(Boolean).map(x => `“${x}”`).join(" e ")}. ` : "",
      "O investimento por novo seguidor divide todo o investimento do período pelos seguidores ganhos e serve como referência, não como custo exato. “Visitas vindas dos anúncios” é o resultado das campanhas de visitas ao perfil. Para ver o dia a dia, escolha “Visitas ao perfil” ou “Novos seguidores” no calendário."));
}
function importInstagramBtn(c, primary) {
  const input = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, id: "igCsv" });
  const btn = h("button", { class: "btn" + (primary ? " btn-primary" : ""), type: "button", disabled: !canWrite(), onclick: () => input.click() }, "Importar planilha do Instagram");
  input.addEventListener("change", () => {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { input.value = ""; openImportInstagram(c, String(rd.result), f.name); };
    rd.readAsText(f, "utf-8");
  });
  return h("span", { class: "import-wrap" }, btn, input);
}
function openImportInstagram(c, text, fileName) {
  const r = Instagram.importar(text);
  if (!r.ok) {
    const box = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "ii-t" }, h("h2", { id: "ii-t" }, "Não foi possível importar"), h("p", null, r.erro),
      h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => close() }, "Entendi")));
    const close = openOverlay(box, true); return;
  }
  const todos = Object.values(r.meses).flat();
  const soma = k => todos.some(d => Fmt.isNum(d[k])) ? todos.reduce((s, d) => s + (d[k] || 0), 0) : null;
  const existentes = Object.fromEntries((CD("instagram") || []).map(d => [d.competencia, d]));
  const go_ = h("button", { class: "btn btn-primary", type: "button" }, `Importar ${r.dias} ${r.dias === 1 ? "dia" : "dias"}`);
  const err = h("p", { class: "err-text", hidden: true });
  const box = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "ii-t2" },
    h("h2", { id: "ii-t2" }, "Importar Instagram"),
    h("p", null, `${fileName} · ${Fmt.date(r.periodo.inicio)} a ${Fmt.date(r.periodo.fim)} · ${c.nome}`),
    h("div", { class: "tiles tiles-sm" }, tile("Visitas ao perfil", Fmt.integer(soma("visitasPerfil"))), tile("Novos seguidores", Fmt.integer(soma("novosSeguidores")))),
    h("p", null, `Colunas encontradas: ${[r.colunas.visitas, r.colunas.seguidores].filter(Boolean).map(x => `“${x}”`).join(" e ")}${!r.colunas.visitas ? " (sem visitas ao perfil)" : ""}${!r.colunas.seguidores ? " (sem seguidores)" : ""}. Dias já importados são substituídos pelos números deste arquivo.`),
    err,
    h("div", { class: "actions-row", style: "justify-content:flex-end" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), go_));
  const close = openOverlay(box, true);
  go_.addEventListener("click", async () => {
    go_.disabled = true; go_.textContent = "Importando…";
    try {
      for (const [m, dias] of Object.entries(r.meses)) {
        const ex = existentes[m];
        await Store.put("instagram", `${c.id}_${m}`, { clienteId: c.id, competencia: m, dias: Instagram.mesclar(ex && ex.dias, dias), colunas: r.colunas, origem: "meta_csv", schema: Domain.SCHEMA, criadoEm: ex && ex.criadoEm });
      }
      close(); toast("Instagram importado.");
    } catch (e) { err.hidden = false; err.textContent = Store.message(e); go_.disabled = false; go_.textContent = "Tentar de novo"; }
  });
}
