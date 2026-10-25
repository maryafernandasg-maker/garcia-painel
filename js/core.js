"use strict";
/* =====================================================================
   NÚCLEO — formatação, regras de cálculo e validação.
   Sem acesso a tela nem a banco: as mesmas funções servem às telas,
   às comparações e ao PDF, e são testadas isoladamente.
   Convenções:
   - dinheiro em CENTAVOS inteiros (campos terminados em "Centavos");
   - null = dado não informado; 0 = zero real;
   - nada é arredondado antes da exibição.
   ===================================================================== */
const Fmt = (() => {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dtt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const NA = "—";
  const pad = n => String(n).padStart(2, "0");
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  return {
    NA, MESES, isNum,
    money(cents) { return isNum(cents) ? brl.format(cents / 100) : NA; },
    integer(n) { return isNum(n) ? int.format(n) : NA; },
    pct(v) { return isNum(v) ? dec2.format(v) + "%" : NA; },
    dec(v) { return isNum(v) ? dec2.format(v) : NA; },
    times(v) { return isNum(v) ? dec2.format(v) + "x" : NA; },
    /** Formata o valor de uma métrica conforme o tipo declarado em Metrics.DEFS */
    metric(fmt, v) {
      return fmt === "moeda" ? this.money(v) : fmt === "pct" ? this.pct(v) : fmt === "x" ? this.times(v) : fmt === "int" ? this.integer(v) : this.dec(v);
    },
    date(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
      return m ? `${m[3]}/${m[2]}/${m[1]}` : NA;
    },
    datetime(ts) { if (!ts) return NA; const d = new Date(ts); return isNaN(d) ? NA : dtt.format(d); },
    /** "2026-09" → "setembro de 2026" */
    month(comp) { const m = /^(\d{4})-(\d{2})$/.exec(comp || ""); return m ? `${MESES[Number(m[2]) - 1]} de ${m[1]}` : NA; },
    monthShort(comp) { const m = /^(\d{4})-(\d{2})$/.exec(comp || ""); return m ? `${MESES[Number(m[2]) - 1].slice(0, 3)}/${m[1]}` : NA; },
    /** Primeiro e último dia de uma competência "AAAA-MM" */
    monthBounds(comp) {
      const [y, m] = comp.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return { inicio: `${y}-${pad(m)}-01`, fim: `${y}-${pad(m)}-${pad(last)}` };
    },
    todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    currentComp() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; },
    previousComp(comp) { const [y, m] = comp.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; },
    /** Texto em reais → centavos. Aceita "1.234,56", "1234,56", "1234", "R$ 1.234,56". */
    parseMoney(text) {
      const s = String(text ?? "").replace(/R\$\s?/i, "").replace(/\s/g, "");
      if (s === "") return { ok: true, value: null };
      if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(s)) return { ok: false, error: "Use o formato 1.234,56." };
      const [whole, frac = ""] = s.replace(/\./g, "").split(",");
      const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
      if (!Number.isSafeInteger(cents)) return { ok: false, error: "Valor muito alto." };
      return { ok: true, value: cents };
    },
    /** Texto → inteiro ≥ 0. Aceita "12.345" e "12345". */
    /** Texto → decimal ≥ 0 (percentuais e ROAS). Aceita "1,5", "1.5", "3" e "2,5%". */
    parseDec(text) {
      const s = String(text ?? "").replace(/[%x\s]/gi, "");
      if (s === "") return { ok: true, value: null };
      if (!/^\d+([.,]\d{1,4})?$/.test(s)) return { ok: false, error: "Use um número, como 1,5." };
      return { ok: true, value: Number(s.replace(",", ".")) };
    },
    decInput(v) { return isNum(v) ? String(v).replace(".", ",") : ""; },
    parseInt(text) {
      const s = String(text ?? "").replace(/\s/g, "");
      if (s === "") return { ok: true, value: null };
      if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(s)) return { ok: false, error: "Use só números inteiros, sem vírgula (ex.: 12.345)." };
      const n = Number(s.replace(/\./g, ""));
      if (!Number.isSafeInteger(n)) return { ok: false, error: "Número muito alto." };
      return { ok: true, value: n };
    },
    /** "2026-09" → "set/26" (eixos de gráfico) */
    monthTiny(comp) { const m = /^(\d{4})-(\d{2})$/.exec(comp || ""); return m ? `${MESES[Number(m[2]) - 1].slice(0, 3)}/${m[1].slice(2)}` : NA; },
    /** Lista de competências terminando em fim, em ordem cronológica */
    compsUntil(fim, n) { const out = [fim]; while (out.length < n) out.unshift(this.previousComp(out[0])); return out; },
    /** Rótulo de um período de competências */
    periodLabel(comps) { return comps.length === 1 ? this.month(comps[0]) : `${this.monthShort(comps[0])} a ${this.monthShort(comps[comps.length - 1])}`; },
    /** Valor compacto para eixos */
    compact(fmt, v) {
      if (!isNum(v)) return NA;
      const c = x => x >= 1e6 ? (x / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : x >= 1e3 ? (x / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : x.toLocaleString("pt-BR", { maximumFractionDigits: x < 10 ? 2 : 0 });
      return fmt === "moeda" ? "R$ " + c(v / 100) : fmt === "pct" ? c(v) + "%" : fmt === "x" ? c(v) + "x" : c(v);
    },
    /** Diferença com sinal: moeda, inteiro, pontos percentuais ou decimal */
    signed(fmt, v) {
      if (!isNum(v)) return NA;
      const s = v > 0 ? "+" : v < 0 ? "−" : "";
      const a = Math.abs(v);
      return s + (fmt === "moeda" ? this.money(a) : fmt === "pct" ? dec2.format(a) + " p.p." : fmt === "int" ? this.integer(a) : fmt === "x" ? dec2.format(a) + "x" : dec2.format(a));
    },
    signedPct(v) { if (!isNum(v)) return NA; return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"; },
    moneyInput(cents) { return isNum(cents) ? dec2.format(cents / 100) : ""; },
    intInput(n) { return isNum(n) ? int.format(n) : ""; },
  };
})();

const Metrics = (() => {
  const isNum = Fmt.isNum;

  /** Definição registrada de cada métrica. dir: 1 = maior é melhor, -1 = menor é melhor, 0 = depende do contexto. */
  const DEFS = {
    cpm: { nome: "CPM", formula: "Investimento ÷ Impressões × 1.000", fmt: "moeda", dir: -1, desc: "Quanto custou exibir o anúncio mil vezes." },
    ctr: { nome: "CTR de link", formula: "Cliques no link ÷ Impressões × 100", fmt: "pct", dir: 1, desc: "De cada 100 exibições, quantas viraram clique no link." },
    cpc: { nome: "CPC de link", formula: "Investimento ÷ Cliques no link", fmt: "moeda", dir: -1, desc: "Custo médio de cada clique no link." },
    frequencia: { nome: "Frequência", formula: "Impressões ÷ Alcance", fmt: "dec", dir: 0, desc: "Quantas vezes, em média, cada pessoa viu os anúncios." },
    cpr: { nome: "Custo por resultado", formula: "Investimento ÷ Resultados", fmt: "moeda", dir: -1, desc: "Custo de cada resultado do objetivo (conversa, lead, compra…)." },
    taxaCliqueLead: { nome: "Cliques que viraram conversa/lead", formula: "Conversas ou leads ÷ Cliques no link × 100", fmt: "pct", dir: 1, desc: "De cada 100 cliques, quantos viraram conversa ou lead." },
    taxaQualificacao: { nome: "Taxa de qualificação", formula: "Leads qualificados ÷ Conversas ou leads × 100", fmt: "pct", dir: 1, desc: "De cada 100 contatos, quantos tinham perfil de compra." },
    taxaLeadVenda: { nome: "Leads que viraram venda", formula: "Vendas atribuídas ÷ Conversas ou leads × 100", fmt: "pct", dir: 1, desc: "De cada 100 contatos, quantos compraram." },
    cpl: { nome: "Custo por lead", formula: "Investimento em mídia ÷ Conversas ou leads", fmt: "moeda", dir: -1, desc: "Custo de cada conversa ou lead gerado." },
    cplq: { nome: "Custo por lead qualificado", formula: "Investimento em mídia ÷ Leads qualificados", fmt: "moeda", dir: -1, desc: "Custo de cada contato com perfil de compra." },
    cacMidia: { nome: "CAC de mídia", formula: "Investimento em mídia ÷ Vendas atribuídas à mídia", fmt: "moeda", dir: -1, desc: "Quanto de anúncio foi investido para conquistar cada cliente." },
    cacTotal: { nome: "CAC total", formula: "(Investimento em mídia + custos extras de aquisição) ÷ Vendas atribuídas. Só é calculado quando todos os custos foram informados.", fmt: "moeda", dir: -1, desc: "Custo completo para conquistar cada cliente." },
    roas: { nome: "ROAS", formula: "Receita atribuída aos anúncios ÷ Investimento em mídia", fmt: "x", dir: 1, desc: "Quantos reais voltaram em vendas para cada real investido em anúncios." },
  };

  const LABEL = {
    investimentoCentavos: "Investimento", impressoes: "Impressões", alcance: "Alcance", cliquesLink: "Cliques no link",
    resultados: "Resultados", leads: "Conversas ou leads", leadsQualificados: "Leads qualificados", vendas: "Vendas atribuídas",
    receita: "Faturamento dos anúncios", custo: "Custo de aquisição", conversas: "Conversas iniciadas", leadsForm: "Leads gerados", faturamentoTotal: "Faturamento geral", dias: "Dias do período",
  };

  /** Divisão segura. Retorna {v, m}: v = valor ou null; m = motivo quando não dá para calcular. */
  function ratio(n, d, mult, nKey, dKey) {
    if (!isNum(n)) return { v: null, m: `${LABEL[nKey] || nKey}: não informado` };
    if (!isNum(d)) return { v: null, m: `${LABEL[dKey] || dKey}: não informado` };
    if (d === 0) return { v: null, m: `${LABEL[dKey] || dKey} igual a zero` };
    return { v: (n / d) * (mult || 1), m: null };
  }
  const na = m => ({ v: null, m });

  /** Métricas de mídia de uma linha (resumo do mês, campanha, conjunto ou anúncio). */
  function basicas(r) {
    r = r || {};
    return {
      cpm: ratio(r.investimentoCentavos, r.impressoes, 1000, "investimentoCentavos", "impressoes"),
      ctr: ratio(r.cliquesLink, r.impressoes, 100, "cliquesLink", "impressoes"),
      cpc: ratio(r.investimentoCentavos, r.cliquesLink, 1, "investimentoCentavos", "cliquesLink"),
      frequencia: ratio(r.impressoes, r.alcance, 1, "impressoes", "alcance"),
      cpr: r.tipoResultado || r.resultados == null ? ratio(r.investimentoCentavos, r.resultados, 1, "investimentoCentavos", "resultados") : na("Tipo de resultado não informado"),
    };
  }

  /** Soma um campo aditivo. Informa quantas linhas estavam sem o dado. */
  function soma(rows, key) {
    let v = 0, n = 0;
    for (const r of rows) if (isNum(r[key])) { v += r[key]; n++; }
    return { v: n ? v : null, faltando: rows.length - n, m: n ? null : `${LABEL[key] || key}: não informado` };
  }
  /** Razão ponderada: soma dos numeradores ÷ soma dos denominadores, só com linhas que têm os dois dados.
      Nunca faz média simples de percentuais. */
  function ponderada(rows, nKey, dKey, mult) {
    const ok = rows.filter(r => isNum(r[nKey]) && isNum(r[dKey]));
    if (!ok.length) return { ...ratio(null, null, mult, nKey, dKey), linhas: 0, total: rows.length };
    const res = ratio(ok.reduce((s, r) => s + r[nKey], 0), ok.reduce((s, r) => s + r[dKey], 0), mult, nKey, dKey);
    return { ...res, linhas: ok.length, total: rows.length };
  }

  /** Consolida linhas (campanhas, conjuntos ou anúncios do mesmo mês).
      Alcance e frequência NÃO são somados: o Meta remove pessoas repetidas entre campanhas. */
  function agregar(rows) {
    rows = rows || [];
    const porTipo = {};
    for (const r of rows) {
      if (!r.tipoResultado || !isNum(r.resultados)) continue;
      const k = r.tipoResultado === "outro" ? "outro:" + (r.tipoResultadoOutro || "") : r.tipoResultado;
      (porTipo[k] ||= { tipo: r.tipoResultado, rotulo: r.tipoResultadoOutro || null, rows: [] }).rows.push(r);
    }
    const resultados = Object.values(porTipo).map(g => ({
      tipo: g.tipo, rotulo: g.rotulo, resultados: soma(g.rows, "resultados").v,
      cpr: ponderada(g.rows, "investimentoCentavos", "resultados", 1),
    }));
    return {
      linhas: rows.length,
      investimentoCentavos: soma(rows, "investimentoCentavos"),
      impressoes: soma(rows, "impressoes"),
      cliquesLink: soma(rows, "cliquesLink"),
      alcance: na("Alcance não é somável entre campanhas: use o total do resumo do mês"),
      frequencia: na("Depende do alcance total do mês"),
      cpm: ponderada(rows, "investimentoCentavos", "impressoes", 1000),
      ctr: ponderada(rows, "cliquesLink", "impressoes", 100),
      cpc: ponderada(rows, "investimentoCentavos", "cliquesLink", 1),
      resultados, // um item por tipo; tipos diferentes nunca são somados
    };
  }

  const TIPOS_LEAD = ["conversas", "leads"];

  /** Funil do mês: dados do Meta Ads (resumo) + resultados comerciais informados pelo cliente. */
  function funil(resumo, com) {
    resumo = resumo || {}; com = com || {};
    const inv = resumo.investimentoCentavos;
    const tipoOk = TIPOS_LEAD.includes(resumo.tipoResultado);
    const leads = tipoOk ? resumo.resultados : null;
    const semLead = "O resultado principal do mês não é conversa nem lead";
    const comLeads = (fn) => (tipoOk ? fn() : na(semLead));
    const lq = com.leadsQualificados, vendas = com.vendasAtribuidas, receita = com.receitaAtribuidaCentavos;

    let cacTotal;
    if (!com.custosCompletos) cacTotal = na("Custos de aquisição não confirmados como completos");
    else if (!isNum(com.custosExtrasCentavos)) cacTotal = na("Custos extras de aquisição: não informado");
    else if (!isNum(inv)) cacTotal = na("Investimento: não informado");
    else cacTotal = ratio(inv + com.custosExtrasCentavos, vendas, 1, "custo", "vendas");

    return {
      etapas: [
        { k: "impressoes", nome: "Impressões", v: isNum(resumo.impressoes) ? resumo.impressoes : null, origem: "meta" },
        { k: "cliquesLink", nome: "Cliques no link", v: isNum(resumo.cliquesLink) ? resumo.cliquesLink : null, origem: "meta" },
        { k: "leads", nome: resumo.tipoResultado === "leads" ? "Leads gerados" : "Conversas iniciadas", v: isNum(leads) ? leads : null, origem: "meta", motivo: tipoOk ? null : semLead },
        { k: "leadsQualificados", nome: "Leads qualificados", v: isNum(lq) ? lq : null, origem: "cliente" },
        { k: "vendas", nome: "Vendas atribuídas", v: isNum(vendas) ? vendas : null, origem: "cliente" },
        { k: "receita", nome: "Receita atribuída", v: isNum(receita) ? receita : null, origem: "cliente", fmt: "moeda" },
      ],
      taxas: {
        ctr: ratio(resumo.cliquesLink, resumo.impressoes, 100, "cliquesLink", "impressoes"),
        taxaCliqueLead: comLeads(() => ratio(leads, resumo.cliquesLink, 100, "leads", "cliquesLink")),
        taxaQualificacao: comLeads(() => ratio(lq, leads, 100, "leadsQualificados", "leads")),
        taxaLeadVenda: comLeads(() => ratio(vendas, leads, 100, "vendas", "leads")),
        cpl: comLeads(() => ratio(inv, leads, 1, "investimentoCentavos", "leads")),
        cplq: ratio(inv, lq, 1, "investimentoCentavos", "leadsQualificados"),
        cacMidia: ratio(inv, vendas, 1, "investimentoCentavos", "vendas"),
        cacTotal,
        roas: ratio(receita, inv, 1, "receita", "investimentoCentavos"),
      },
    };
  }

  /** Consolida vários meses de um cliente. meses: [{comp, resumo, com}].
      Para um único mês, os valores coincidem com basicas() e funil(). */
  function consolidar(meses) {
    const rows = (meses || []).map(m => {
      const R = m.resumo || {}, C = m.com || {};
      const tipoLead = TIPOS_LEAD.includes(R.tipoResultado);
      return {
        comp: m.comp, investimentoCentavos: R.investimentoCentavos, impressoes: R.impressoes, cliquesLink: R.cliquesLink, alcance: R.alcance,
        resultados: R.resultados, tipoResultado: R.tipoResultado, tipoResultadoOutro: R.tipoResultadoOutro,
        leads: tipoLead && isNum(R.resultados) ? R.resultados : null,
        leadsQualificados: C.leadsQualificados, vendas: C.vendasAtribuidas, receita: C.receitaAtribuidaCentavos,
        custo: C.custosCompletos && isNum(C.custosExtrasCentavos) && isNum(R.investimentoCentavos) ? R.investimentoCentavos + C.custosExtrasCentavos : null,
      };
    });
    const um = rows.length === 1 ? rows[0] : null;
    const chave = r => r.tipoResultado === "outro" ? "outro:" + (r.tipoResultadoOutro || "") : r.tipoResultado;
    const tipos = [...new Set(rows.filter(r => r.tipoResultado && isNum(r.resultados)).map(chave))];
    const tipoUnico = tipos.length === 1 ? tipos[0] : null;
    const rowsRes = tipoUnico ? rows.filter(r => chave(r) === tipoUnico && isNum(r.resultados)) : [];
    const exemplo = rowsRes[0] || {};
    const semRes = tipos.length > 1 ? "Meses com tipos de resultado diferentes não são somados" : "Resultados: não informado";
    const comVendas = rows.filter(r => isNum(r.vendas));
    const cacTotal = !comVendas.length ? na("Vendas atribuídas: não informado")
      : comVendas.every(r => r.custo != null) ? ponderada(comVendas, "custo", "vendas", 1)
      : na("Custos de aquisição não confirmados como completos" + (rows.length > 1 ? " em todos os meses" : ""));
    return {
      meses: rows.length,
      investimentoCentavos: soma(rows, "investimentoCentavos"),
      impressoes: soma(rows, "impressoes"),
      cliquesLink: soma(rows, "cliquesLink"),
      alcance: um ? (isNum(um.alcance) ? { v: um.alcance, m: null } : na("Alcance: não informado")) : na("Alcance não é somável entre meses"),
      frequencia: um ? ratio(um.impressoes, um.alcance, 1, "impressoes", "alcance") : na("Frequência só é calculada para um mês"),
      cpm: ponderada(rows, "investimentoCentavos", "impressoes", 1000),
      ctr: ponderada(rows, "cliquesLink", "impressoes", 100),
      cpc: ponderada(rows, "investimentoCentavos", "cliquesLink", 1),
      tipoResultado: tipoUnico ? exemplo.tipoResultado : null,
      tipoResultadoOutro: tipoUnico ? exemplo.tipoResultadoOutro || null : null,
      resultados: tipoUnico ? soma(rowsRes, "resultados") : na(semRes),
      cpr: tipoUnico ? ponderada(rowsRes, "investimentoCentavos", "resultados", 1) : na(semRes),
      leads: soma(rows, "leads"),
      leadsQualificados: soma(rows, "leadsQualificados"),
      vendas: soma(rows, "vendas"),
      receita: soma(rows, "receita"),
      taxaCliqueLead: ponderada(rows, "leads", "cliquesLink", 100),
      taxaQualificacao: ponderada(rows, "leadsQualificados", "leads", 100),
      taxaLeadVenda: ponderada(rows, "vendas", "leads", 100),
      cpl: ponderada(rows, "investimentoCentavos", "leads", 1),
      cplq: ponderada(rows, "investimentoCentavos", "leadsQualificados", 1),
      cacMidia: ponderada(rows, "investimentoCentavos", "vendas", 1),
      cacTotal,
      roas: ponderada(rows, "receita", "investimentoCentavos", 1),
    };
  }

  /** Variação entre dois valores. dir: 1 = subir é bom, -1 = subir é ruim, 0 = depende. */
  function variacao(atual, anterior, dir) {
    if (!isNum(atual) || !isNum(anterior)) return null;
    const abs = atual - anterior;
    const pct = anterior === 0 ? null : (abs / Math.abs(anterior)) * 100;
    const sentido = abs === 0 ? "igual" : !dir ? "neutro" : (abs > 0) === (dir > 0) ? "melhor" : "pior";
    return { abs, pct, sentido };
  }

  /** Volume mínimo para comparar linhas (conjuntos, anúncios). Abaixo disso, diferenças podem ser acaso. */
  const VOLUME_MIN = { impressoes: 1000, resultados: 5 };
  function volume(r) {
    if (isNum(r.impressoes) && r.impressoes < VOLUME_MIN.impressoes) return { baixo: true, m: `Menos de ${VOLUME_MIN.impressoes.toLocaleString("pt-BR")} impressões` };
    if (isNum(r.resultados) && r.resultados < VOLUME_MIN.resultados) return { baixo: true, m: `Menos de ${VOLUME_MIN.resultados} resultados` };
    if (!isNum(r.impressoes)) return { baixo: null, m: "Impressões não informadas" };
    return { baixo: false, m: null };
  }

  /** Leitura automática: fatos e pontos a investigar. Nunca conclui sozinha; aponta o que falta para concluir. */
  function leitura(cur, prev, ctx) {
    ctx = ctx || {};
    const out = [];
    const f = (k, v) => fmtFn(DEFS[k] ? DEFS[k].fmt : "int", v);
    if (cur.investimentoCentavos.v == null) out.push({ tipo: "falta", texto: "Investimento não informado: os custos não podem ser calculados." });
    if (cur.leadsQualificados.v == null && cur.vendas.v == null)
      out.push({ tipo: "falta", texto: "Sem resultados comerciais informados pelo cliente: não dá para avaliar a qualidade dos contatos nem o retorno em vendas. Peça ao cliente quantos contatos tinham perfil de compra e quantos compraram." });
    else if (cur.vendas.v != null && cur.receita.v == null) out.push({ tipo: "falta", texto: "Há vendas informadas sem receita: o ROAS não pode ser calculado." });
    if (prev && prev.investimentoCentavos.v != null) {
      const watch = [["cpm", "CPM"], ["ctr", "CTR de link"], ["cpc", "CPC de link"], ["cpr", "Custo por resultado"], ["taxaQualificacao", "Taxa de qualificação"], ["cacMidia", "CAC de mídia"], ["roas", "ROAS"]];
      for (const [k, nome] of watch) {
        const vr = variacao(cur[k] && cur[k].v, prev[k] && prev[k].v, DEFS[k].dir);
        if (!vr || vr.pct == null || Math.abs(vr.pct) < 15) continue;
        out.push({ tipo: vr.sentido === "pior" ? "atencao" : "positivo",
          texto: `${nome} ${vr.abs > 0 ? "subiu" : "caiu"} ${Math.abs(vr.pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% em relação ao período anterior (${f(k, prev[k].v)} → ${f(k, cur[k].v)}).` });
      }
    } else if (prev) out.push({ tipo: "falta", texto: "Sem dados no período anterior para comparar." });
    if (cur.frequencia.v != null && cur.frequencia.v >= 3)
      out.push({ tipo: "atencao", texto: `Frequência de ${f("frequencia", cur.frequencia.v)} no mês. Pode indicar saturação do público: confirme olhando a evolução do CTR e do custo por resultado antes de concluir.` });
    if (cur.resultados.v != null && cur.resultados.v < 20)
      out.push({ tipo: "falta", texto: `Volume baixo de resultados (${cur.resultados.v}): variações entre períodos podem ser acaso.` });
    if (isNum(ctx.ticketMedioCentavos) && ctx.ticketMedioCentavos > 0 && cur.cpr.v != null)
      out.push({ tipo: "info", texto: `O custo por resultado equivale a ${(cur.cpr.v / ctx.ticketMedioCentavos * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do ticket médio cadastrado (${f("cpr", ctx.ticketMedioCentavos)}). Avalie junto com a taxa de conversão em vendas e a margem do cliente.` });
    return out;
  }
  const fmtFn = (fmt, v) => Fmt.metric(fmt, v);

  return { DEFS, ratio, basicas, agregar, funil, soma, ponderada, consolidar, variacao, volume, leitura, VOLUME_MIN };
})();

/* =====================================================================
   IMPORTAÇÃO DO GERENCIADOR DE ANÚNCIOS (CSV exportado pelo Meta)
   Formato validado com um arquivo real: nível de CAMPANHA, colunas em
   português, valores com ponto decimal. Outros níveis são recusados até
   termos um arquivo real para validar.
   ===================================================================== */
const MetaCsv = (() => {
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    text = String(text).replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === ";") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(c => c !== "")) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some(c => c !== "")) rows.push(row);
    return rows;
  }
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  /** Número exportado: "62.82", "1234", "1.234,56" ou "62,82". Vazio = null. */
  function num(s) {
    s = String(s ?? "").trim();
    if (s === "") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    return NaN;
  }
  /** Indicador de resultados do Meta → tipo de resultado do sistema */
  function tipoDe(ind) {
    const s = norm(ind);
    if (!s) return { tipo: null };
    // códigos (arquivo de campanhas) ou nomes em português (Relatórios de anúncios)
    if (s.includes("messaging_conversation_started") || s.includes("conversas por mensagem")) return { tipo: "conversas" };
    if (s.includes("profile_visit") || s.includes("visitas ao perfil")) return { tipo: "visitas" };
    if (/lead|cadastro/.test(s)) return { tipo: "leads" };
    if (/purchase|compra/.test(s)) return { tipo: "compras" };
    if (s.includes("link_click") || s.includes("cliques no link")) return { tipo: "cliques" };
    if (s.includes("post_engagement") || s.includes("engajamento")) return { tipo: "engajamento" };
    return { tipo: "outro", outro: String(ind).replace(/^actions:/, "").slice(0, 60) };
  }
  const COLS = {
    inicio: ["inicio dos relatorios"], fim: ["encerramento dos relatorios"], campanha: ["nome da campanha"],
    conjunto: ["nome do conjunto de anuncios"], anuncio: ["nome do anuncio"],
    alcance: ["alcance"], impressoes: ["impressoes"], cliques: ["cliques no link"],
    resultados: ["resultados"], indicador: ["indicador de resultados", "tipo de resultado"], orcamento: ["orcamento do conjunto de anuncios", "orcamento da campanha"],
  };
  /**
   * Lê o CSV e devolve campanhas prontas para o sistema.
   * comp: competência esperada ("2026-09"). Retorna {ok, erro?, campanhas, semEntrega, resumo, avisos, periodo}.
   */
  function importar(text, comp) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, erro: "O arquivo está vazio." };
    const hdr = rows[0].map(norm);
    const idx = {};
    for (const [k, names] of Object.entries(COLS)) idx[k] = hdr.findIndex(h => names.includes(h));
    const gastoIdx = hdr.findIndex(h => /^valor (gasto|usado) \(/.test(h));
    if (idx.conjunto >= 0 || idx.anuncio >= 0) return { ok: false, erro: "Este arquivo está no nível de conjunto ou anúncio. Por enquanto a importação aceita só o nível de campanha (o único formato já validado com um arquivo real). Exporte no nível de campanha ou lance conjuntos e anúncios manualmente." };
    const falta = ["campanha", "impressoes", "cliques", "inicio", "fim"].filter(k => idx[k] < 0);
    if (gastoIdx < 0) falta.push("valor gasto");
    if (falta.length) return { ok: false, erro: `Colunas não encontradas: ${falta.join(", ")}. Exporte do Gerenciador de Anúncios no nível de campanha, em português.` };
    const moeda = (/\(([a-z]{3})\)/.exec(hdr[gastoIdx]) || [])[1];
    if (moeda && moeda !== "brl") return { ok: false, erro: `O valor gasto está em ${moeda.toUpperCase()}. O sistema trabalha em reais (BRL).` };
    const avisos = [], campanhas = [], semEntrega = [];
    const periodos = new Set();
    const nomes = {};
    for (let r = 1; r < rows.length; r++) {
      const c = rows[r], g = k => (idx[k] >= 0 ? c[idx[k]] : "");
      const nome = String(g("campanha") || "").trim() || `Campanha sem nome (linha ${r + 1})`;
      periodos.add(`${g("inicio")}|${g("fim")}`);
      const gasto = num(c[gastoIdx]), imp = num(g("impressoes")), alc = num(g("alcance")), cl = num(g("cliques")), res = num(g("resultados"));
      for (const [k, v] of [["valor gasto", gasto], ["impressões", imp], ["alcance", alc], ["cliques no link", cl], ["resultados", res]])
        if (Number.isNaN(v)) return { ok: false, erro: `Valor inválido em “${k}” na linha ${r + 1}.` };
      // nomes repetidos contam todas as linhas (inclusive sem entrega) para o nome ficar igual entre meses
      nomes[norm(nome)] = (nomes[norm(nome)] || 0) + 1;
      if (!(imp > 0) && !(gasto > 0)) { semEntrega.push(nome); continue; }
      const t = tipoDe(g("indicador"));
      const orc = num(g("orcamento"));
      campanhas.push({
        nomeOriginal: nome, nome, orcamentoDiario: Number.isFinite(orc) ? orc : null,
        investimentoCentavos: gasto == null ? null : Math.round(gasto * 100),
        alcance: alc == null ? null : Math.round(alc), impressoes: imp == null ? null : Math.round(imp), cliquesLink: cl == null ? null : Math.round(cl),
        resultados: res == null ? null : Math.round(res), tipoResultado: res == null ? null : t.tipo, tipoResultadoOutro: res == null ? null : t.outro || null,
        indicadorMeta: g("indicador") || null,
      });
    }
    // nomes repetidos: o Meta permite; no sistema viram nomes distintos
    const usados = {};
    for (const c of campanhas) {
      const k = norm(c.nomeOriginal);
      if (nomes[k] > 1) {
        usados[k] = (usados[k] || 0) + 1;
        c.nome = `${c.nomeOriginal} (${c.orcamentoDiario != null ? "orçamento " + String(c.orcamentoDiario).replace(".", ",") + "/dia" : "nº " + usados[k]})`;
      }
    }
    const nomesFinais = {};
    for (const c of campanhas) { const k = norm(c.nome); nomesFinais[k] = (nomesFinais[k] || 0) + 1; if (nomesFinais[k] > 1) c.nome += ` nº ${nomesFinais[k]}`; }
    if (Object.values(nomes).some(n => n > 1)) avisos.push("Há campanhas com o mesmo nome no Meta. Elas foram mantidas separadas, com o orçamento no nome para diferenciar.");
    if (periodos.size !== 1) return { ok: false, erro: "As linhas têm períodos diferentes. Exporte um único período (o mês inteiro)." };
    const [ini, fim] = [...periodos][0].split("|");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return { ok: false, erro: "Não foi possível ler as datas do relatório." };
    if (ini.slice(0, 7) !== fim.slice(0, 7)) return { ok: false, erro: "O período do arquivo passa de um mês. Exporte um mês por vez." };
    if (comp && ini.slice(0, 7) !== comp) return { ok: false, erro: `O arquivo é de ${Fmt.month(ini.slice(0, 7))}, mas o mês aberto é ${Fmt.month(comp)}.` };
    if (!campanhas.length) return { ok: false, erro: "Nenhuma campanha com veiculação no período." };
    const lim = Fmt.monthBounds(ini.slice(0, 7));
    const parcial = ini !== lim.inicio || fim !== lim.fim;
    if (parcial) avisos.push(`Período parcial: ${Fmt.date(ini)} a ${Fmt.date(fim)}. Os totais deste mês não são comparáveis com meses completos; compare taxas e custos. Quando o mês fechar, importe o arquivo do mês inteiro e os números serão atualizados.`);
    // resumo do mês: somas aditivas; alcance não é somável; resultado principal = tipo com mais investimento
    const soma = k => campanhas.reduce((s, c) => s + (c[k] || 0), 0);
    const porTipo = {};
    for (const c of campanhas) if (c.tipoResultado) { const k = c.tipoResultado + "|" + (c.tipoResultadoOutro || ""); (porTipo[k] ||= { tipo: c.tipoResultado, outro: c.tipoResultadoOutro, inv: 0, res: 0 }); porTipo[k].inv += c.investimentoCentavos || 0; porTipo[k].res += c.resultados || 0; }
    const princ = Object.values(porTipo).sort((a, b) => b.inv - a.inv)[0] || null;
    if (Object.keys(porTipo).length > 1) {
      const outros = soma("investimentoCentavos") - princ.inv;
      avisos.push(`As campanhas têm tipos de resultado diferentes. O resultado principal do mês ficou como “${Domain.tipoLabel(princ.tipo, princ.outro)}” (o tipo com mais investimento): ${Fmt.integer(princ.res)}. O custo por resultado do resumo divide todo o investimento do mês por esse número, incluindo ${Fmt.money(outros)} de campanhas com outros objetivos. Só nas campanhas desse tipo, o custo foi ${Fmt.money(princ.inv / princ.res)} — veja a aba Campanhas.`);
    }
    avisos.push("O arquivo de campanhas não traz o alcance total da conta, e o alcance das campanhas não pode ser somado. Preencha o alcance do mês no resumo (exportação no nível Conta ou linha de total do Gerenciador).");
    return {
      ok: true, periodo: { inicio: ini, fim, parcial }, campanhas, semEntrega, avisos,
      principal: princ ? { tipo: princ.tipo, outro: princ.outro || null, investimentoCentavos: princ.inv, resultados: princ.res, outrosCentavos: soma("investimentoCentavos") - princ.inv } : null,
      resumo: {
        investimentoCentavos: soma("investimentoCentavos"), impressoes: soma("impressoes"), cliquesLink: soma("cliquesLink"),
        tipoResultado: princ ? princ.tipo : null, tipoResultadoOutro: princ ? princ.outro || null : null, resultados: princ ? princ.res : null,
      },
    };
  }
  /**
   * Arquivo com detalhamento por dia (Detalhamento → Por tempo → Dia).
   * Reconhecido quando há coluna "Dia" ou quando cada linha começa e termina no mesmo dia.
   * Retorna {ok, erro?, meses: {"AAAA-MM": linhas[]}, periodo, campanhas[], dias, semEntrega, avisos}.
   */
  function importarDiario(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, erro: "O arquivo está vazio." };
    const hdr = rows[0].map(norm);
    const idx = {};
    for (const [k, names] of Object.entries(COLS)) idx[k] = hdr.findIndex(h => names.includes(h));
    const diaIdx = hdr.findIndex(h => h === "dia");
    const gastoIdx = hdr.findIndex(h => /^valor (gasto|usado) \(/.test(h));
    const nivel = idx.anuncio >= 0 ? "anuncio" : idx.conjunto >= 0 ? "conjunto" : "campanha";
    if (nivel === "anuncio" && idx.conjunto < 0) return { ok: false, erro: "O arquivo tem o nome do anúncio, mas não o do conjunto. Inclua “Nome do conjunto de anúncios” nas linhas do relatório." };
    const falta = ["campanha", "impressoes", "cliques"].filter(k => idx[k] < 0);
    if (gastoIdx < 0) falta.push("valor gasto");
    if (diaIdx < 0 && (idx.inicio < 0 || idx.fim < 0)) falta.push("dia");
    if (falta.length) return { ok: false, erro: `Colunas não encontradas: ${falta.join(", ")}.` };
    const moeda = (/\(([a-z]{3})\)/.exec(hdr[gastoIdx]) || [])[1];
    if (moeda && moeda !== "brl") return { ok: false, erro: `O valor gasto está em ${moeda.toUpperCase()}. O sistema trabalha em reais (BRL).` };
    // nomes repetidos com orçamentos diferentes viram campanhas distintas (mesma regra da importação mensal)
    const orcs = {};
    for (const c of rows.slice(1)) { const n = norm(c[idx.campanha]); const o = idx.orcamento >= 0 ? c[idx.orcamento] : ""; (orcs[n] ||= new Set()).add(o); }
    const meses = {}, nomes = new Set(), semEntrega = new Set(), datas = new Set();
    for (let r = 1; r < rows.length; r++) {
      const c = rows[r], g = k => (idx[k] >= 0 ? c[idx[k]] : "");
      let dia = diaIdx >= 0 ? String(c[diaIdx]).trim() : String(g("inicio")).trim();
      if (diaIdx < 0 && String(g("fim")).trim() !== dia) return { ok: false, erro: "Este arquivo não está dividido por dia (a linha " + (r + 1) + " cobre mais de um dia). No Gerenciador, use Detalhamento → Por tempo → Dia antes de exportar." };
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) || /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dia);
      if (!m) return { ok: false, erro: `Data inválida na linha ${r + 1}.` };
      if (m[0].includes("/")) dia = `${m[3]}-${m[2]}-${m[1]}`;
      const nomeOrig = String(g("campanha") || "").trim() || "Campanha sem nome";
      const orcTxt = idx.orcamento >= 0 ? c[idx.orcamento] : "";
      const nome = orcs[norm(nomeOrig)].size > 1 ? `${nomeOrig} (${orcTxt !== "" ? "orçamento " + String(orcTxt).replace(".", ",") + "/dia" : "sem orçamento"})` : nomeOrig;
      const gasto = num(c[gastoIdx]), imp = num(g("impressoes")), cl = num(g("cliques")), res = num(g("resultados"));
      for (const [k, v] of [["valor gasto", gasto], ["impressões", imp], ["cliques no link", cl], ["resultados", res]])
        if (Number.isNaN(v)) return { ok: false, erro: `Valor inválido em “${k}” na linha ${r + 1}.` };
      // dia sem entrega só é ignorado se também não teve resultado (o Meta às vezes atribui uma conversa a um dia sem gasto)
      if (!(imp > 0) && !(gasto > 0) && !(res > 0)) { semEntrega.add(nome); continue; }
      const t = tipoDe(g("indicador"));
      datas.add(dia); nomes.add(nome);
      (meses[dia.slice(0, 7)] ||= []).push({
        data: dia, campanha: nome,
        ...(nivel !== "campanha" ? { conjunto: String(g("conjunto") || "").trim() || "Conjunto sem nome" } : {}),
        ...(nivel === "anuncio" ? { anuncio: String(g("anuncio") || "").trim() || "Anúncio sem nome" } : {}),
        investimentoCentavos: gasto == null ? null : Math.round(gasto * 100), impressoes: imp == null ? null : Math.round(imp),
        cliquesLink: cl == null ? null : Math.round(cl), resultados: res == null ? null : Math.round(res),
        tipoResultado: res == null ? null : t.tipo, tipoResultadoOutro: res == null ? null : t.outro || null,
      });
    }
    if (!datas.size) return { ok: false, erro: "Nenhum dia com veiculação no arquivo." };
    const ds = [...datas].sort();
    for (const n of nomes) semEntrega.delete(n);
    const avisos = ["O alcance por dia não é somável, por isso não é importado aqui. Alcance e frequência continuam vindo do lançamento mensal."];
    return { ok: true, nivel, meses, periodo: { inicio: ds[0], fim: ds[ds.length - 1] }, dias: ds.length, campanhas: [...nomes].sort(), semEntrega: [...semEntrega], avisos };
  }

  return { parseCsv, num, tipoDe, importar, importarDiario };
})();

/* =====================================================================
   DADOS DIÁRIOS — séries por dia e intervalos livres de datas
   ===================================================================== */
const Diario = (() => {
  const pad = n => String(n).padStart(2, "0");
  const toD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toS = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const add = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
  const diff = (a, b) => Math.round((toD(b) - toD(a)) / 86400000);
  const range = (ini, fim) => { const out = []; for (let s = ini; s <= fim; s = add(s, 1)) out.push(s); return out; };
  /** Mesmo dia no mês anterior (dia 31 vira o último dia do mês anterior) */
  const mesAnterior = s => { const [y, m, d] = s.split("-").map(Number); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; const last = new Date(Date.UTC(py, pm, 0)).getUTCDate(); return `${py}-${pad(pm)}-${pad(Math.min(d, last))}`; };
  /** Período de comparação: "anterior" = mesmo número de dias logo antes; "mes" = mesmas datas no mês anterior */
  function comparacao(ini, fim, modo) {
    if (modo === "mes") return { ini: mesAnterior(ini), fim: mesAnterior(fim) };
    const n = diff(ini, fim) + 1;
    return { ini: add(ini, -n), fim: add(ini, -1) };
  }
  /** Tipo de resultado principal: o preferido, se existir nos dados; senão o de maior investimento. */
  function tipoPrincipal(linhas, preferido) {
    const inv = {};
    for (const l of linhas) if (l.tipoResultado && Fmt.isNum(l.resultados)) inv[l.tipoResultado] = (inv[l.tipoResultado] || 0) + (l.investimentoCentavos || 0);
    if (preferido && inv[preferido] != null) return preferido;
    return Object.entries(inv).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  /** Indicadores de um conjunto de linhas diárias. tipo = resultado principal; o custo por resultado usa só as campanhas desse tipo. */
  function resumo(linhas, tipo) {
    const ag = Metrics.agregar(linhas);
    const doTipo = linhas.filter(l => l.tipoResultado === tipo && Fmt.isNum(l.resultados));
    return {
      investimentoCentavos: ag.investimentoCentavos, impressoes: ag.impressoes, cliquesLink: ag.cliquesLink,
      ctr: ag.ctr, cpc: ag.cpc, cpm: ag.cpm,
      resultados: tipo ? (doTipo.length ? { v: doTipo.reduce((s, l) => s + l.resultados, 0), m: null } : { v: null, m: "Sem resultados desse tipo no período" }) : { v: null, m: "Resultados: não informado" },
      cpr: tipo ? Metrics.ponderada(doTipo, "investimentoCentavos", "resultados", 1) : { v: null, m: "Resultados: não informado" },
      investimentoTipo: tipo ? Metrics.soma(doTipo, "investimentoCentavos") : { v: null },
    };
  }
  /** Série dia a dia entre ini e fim (inclusive). Dias sem linha ficam com dados = false. */
  function serie(linhas, ini, fim, tipo) {
    const por = {};
    for (const l of linhas) if (l.data >= ini && l.data <= fim) (por[l.data] ||= []).push(l);
    return range(ini, fim).map(d => ({ data: d, dados: !!por[d], r: resumo(por[d] || [], tipo) }));
  }
  /** Junta linhas novas às existentes de um mês: dias presentes no arquivo são substituídos, os outros mantidos. */
  function mesclar(existentes, novas) {
    const dias = new Set(novas.map(l => l.data));
    return [...(existentes || []).filter(l => !dias.has(l.data)), ...novas].sort((a, b) => a.data.localeCompare(b.data) || a.campanha.localeCompare(b.campanha));
  }
  /** Totais por campanha de um mês, para atualizar o lançamento mensal (sem alcance, que não é somável). */
  function totaisCampanhas(linhas) {
    const m = {};
    for (const l of linhas) {
      const c = (m[l.campanha] ||= { nome: l.campanha, investimentoCentavos: 0, impressoes: 0, cliquesLink: 0, resultados: null, tipoResultado: null, tipoResultadoOutro: null });
      c.investimentoCentavos += l.investimentoCentavos || 0; c.impressoes += l.impressoes || 0; c.cliquesLink += l.cliquesLink || 0;
      if (Fmt.isNum(l.resultados)) { c.resultados = (c.resultados || 0) + l.resultados; c.tipoResultado = l.tipoResultado; c.tipoResultadoOutro = l.tipoResultadoOutro; }
    }
    return Object.values(m);
  }
  /** Soma linhas de anúncio (ou conjunto) por campanha e dia, gerando as linhas diárias de campanha. */
  function somarCampanhas(linhas) {
    const m = new Map();
    for (const l of linhas) {
      const k = l.data + "|" + l.campanha;
      const c = m.get(k) || { data: l.data, campanha: l.campanha, investimentoCentavos: null, impressoes: null, cliquesLink: null, resultados: null, tipoResultado: null, tipoResultadoOutro: null };
      for (const f of ["investimentoCentavos", "impressoes", "cliquesLink"]) if (Fmt.isNum(l[f])) c[f] = (c[f] || 0) + l[f];
      if (Fmt.isNum(l.resultados)) { c.resultados = (c.resultados || 0) + l.resultados; c.tipoResultado = c.tipoResultado || l.tipoResultado; c.tipoResultadoOutro = c.tipoResultadoOutro || l.tipoResultadoOutro; }
      m.set(k, c);
    }
    return [...m.values()];
  }
  /**
   * Agrupa linhas de anúncio por "anuncio" ou "conjunto" e ordena para o relatório:
   * primeiro o tipo de resultado principal; dentro dele, quem tem volume suficiente, pelo menor custo por resultado;
   * depois quem tem pouco volume. O melhor só é apontado entre os que têm volume.
   */
  function ranking(linhas, nivel, tipoPrincipal) {
    const key = l => nivel === "anuncio" ? `${l.campanha}|${l.conjunto}|${l.anuncio}` : `${l.campanha}|${l.conjunto}`;
    const g = new Map();
    for (const l of linhas) { const k = key(l); if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
    const itens = [...g.entries()].map(([k, rows]) => {
      const ag = Metrics.agregar(rows);
      const res = ag.resultados.length === 1 ? ag.resultados[0] : null;
      return {
        key: k, campanha: rows[0].campanha, conjunto: rows[0].conjunto, anuncio: nivel === "anuncio" ? rows[0].anuncio : null, dias: new Set(rows.map(r => r.data)).size,
        investimentoCentavos: ag.investimentoCentavos.v, impressoes: ag.impressoes.v, cliquesLink: ag.cliquesLink.v, ctr: ag.ctr, cpc: ag.cpc, cpm: ag.cpm,
        tipoResultado: res ? res.tipo : null, tipoResultadoOutro: res ? res.rotulo : null, resultados: res ? res.resultados : null,
        cpr: res ? res.cpr : { v: null, m: ag.resultados.length > 1 ? "Tipos de resultado diferentes" : "Sem resultados" },
        vol: Metrics.volume({ impressoes: ag.impressoes.v, resultados: res ? res.resultados : null }),
      };
    });
    const ordemTipo = t => t === tipoPrincipal ? 0 : t ? 1 : 2;
    itens.sort((a, b) => ordemTipo(a.tipoResultado) - ordemTipo(b.tipoResultado) || (a.tipoResultado || "").localeCompare(b.tipoResultado || "")
      || (a.vol.baixo ? 1 : 0) - (b.vol.baixo ? 1 : 0)
      || ((a.cpr.v ?? Infinity) - (b.cpr.v ?? Infinity)) || (b.investimentoCentavos || 0) - (a.investimentoCentavos || 0));
    // "melhor" exige volume e relevância: pelo menos 10% do investimento do tipo principal no período
    const invTipo = itens.filter(i => i.tipoResultado === tipoPrincipal).reduce((s, i) => s + (i.investimentoCentavos || 0), 0);
    const elegiveis = itens.filter(i => i.tipoResultado === tipoPrincipal && i.vol.baixo === false && i.cpr.v != null && (i.investimentoCentavos || 0) >= invTipo * 0.1);
    for (const i of itens) i.relevante = (i.investimentoCentavos || 0) >= invTipo * 0.1;
    if (elegiveis.length >= 2) elegiveis[0].melhor = true;
    return itens;
  }
  /**
   * Monta conjuntos e anúncios do lançamento mensal a partir das linhas diárias por anúncio de um mês.
   * campanhasMensais: campanhas já lançadas no mês ({id, nome}). A campanha do arquivo é ligada pelo nome;
   * se o relatório somou campanhas de mesmo nome (ex.: "Instagram Post" com dois orçamentos) e o mês tem mais
   * de uma candidata, os conjuntos dessa campanha ficam de fora para não misturar números.
   * Retorna {conjuntos:[{campanhaId, nome, ...metricas}], anuncios:[{campanhaId, conjuntoNome, nome, formato, ...}], ignoradas:[nomes]}.
   */
  function estruturaMensal(linhas, campanhasMensais) {
    const n = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const mapa = {}, ignoradas = new Set();
    for (const nome of new Set(linhas.map(l => l.campanha))) {
      const exata = campanhasMensais.filter(c => n(c.nome) === n(nome));
      const pref = exata.length ? exata : campanhasMensais.filter(c => n(c.nome).startsWith(n(nome) + " ("));
      if (pref.length === 1) mapa[nome] = pref[0].id; else ignoradas.add(nome);
    }
    const ok = linhas.filter(l => mapa[l.campanha]);
    const met = i => ({ investimentoCentavos: i.investimentoCentavos, impressoes: i.impressoes, cliquesLink: i.cliquesLink, resultados: i.resultados, tipoResultado: i.tipoResultado, tipoResultadoOutro: i.tipoResultadoOutro || null });
    const conjuntos = ranking(ok, "conjunto", null).map(i => ({ campanhaId: mapa[i.campanha], nome: i.conjunto, ...met(i) }));
    const anuncios = ranking(ok, "anuncio", null).map(i => ({ campanhaId: mapa[i.campanha], conjuntoNome: i.conjunto, nome: i.anuncio,
      formato: /\bv[ií]deo\b|\breels?\b/i.test(i.anuncio) ? (/\breels?\b/i.test(i.anuncio) ? "reels" : "video") : null, ...met(i) }));
    return { conjuntos, anuncios, ignoradas: [...ignoradas] };
  }
  return { add, diff, range, mesAnterior, comparacao, tipoPrincipal, resumo, serie, mesclar, totaisCampanhas, somarCampanhas, ranking, estruturaMensal };
})();

/* =====================================================================
   INSTAGRAM — visitas ao perfil e novos seguidores, por dia (planilha exportada do Meta)
   ===================================================================== */
const Instagram = (() => {
  const isNum = Fmt.isNum;
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function data(s) {
    s = String(s || "").trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }
  /**
   * Lê a planilha diária. Aceita:
   * - uma linha por dia (Insights / Meta Business Suite), ou
   * - uma linha por campanha e dia (Gerenciador de Anúncios): os valores são somados por dia.
   * Colunas: data ("Dia", "Data", "Date"), visitas ("Visitas ao perfil…") e/ou seguidores ("Seguidores…", "Novos seguidores", "Follows").
   * Linhas de título antes do cabeçalho são ignoradas.
   */
  function importar(text) {
    const rows = MetaCsv.parseCsv(text).filter(r => !(r.length === 1 && /^sep=/i.test(r[0])));
    const hi = rows.findIndex(r => r.some(c => ["dia", "data", "date", "inicio dos relatorios"].includes(norm(c))));
    if (hi < 0) return { ok: false, erro: "Não encontrei a coluna de data. A planilha precisa ter uma linha por dia, com a coluna “Dia” ou “Data”." };
    const hdr = rows[hi].map(norm);
    const di = hdr.findIndex(h => ["dia", "data", "date"].includes(h)) >= 0 ? hdr.findIndex(h => ["dia", "data", "date"].includes(h)) : hdr.indexOf("inicio dos relatorios");
    const fimIdx = hdr.indexOf("encerramento dos relatorios");
    const vi = hdr.findIndex(h => /visitas? ao perfil|profile visits?/.test(h) && !/custo|cost/.test(h));
    const si = hdr.findIndex(h => /seguidor|follow/.test(h) && !/custo|cost|total de seguidores|followers total/.test(h));
    if (vi < 0 && si < 0) return { ok: false, erro: `Não encontrei as colunas de visitas ao perfil nem de seguidores. Colunas do arquivo: ${rows[hi].filter(Boolean).join(", ")}.` };
    const porDia = {};
    for (let r = hi + 1; r < rows.length; r++) {
      const c = rows[r];
      const d = data(c[di]);
      if (!d) { if (c.some(x => String(x).trim())) { if (/total/i.test(c.join(" "))) continue; return { ok: false, erro: `Data inválida na linha ${r + 1}.` }; } continue; }
      if (fimIdx >= 0 && di === hdr.indexOf("inicio dos relatorios") && data(c[fimIdx]) !== d) return { ok: false, erro: "A planilha não está dividida por dia. Exporte com uma linha por dia." };
      const v = vi >= 0 ? MetaCsv.num(c[vi]) : null, f = si >= 0 ? MetaCsv.num(c[si]) : null;
      if (Number.isNaN(v) || Number.isNaN(f)) return { ok: false, erro: `Número inválido na linha ${r + 1}.` };
      const o = (porDia[d] ||= { data: d, visitasPerfil: null, novosSeguidores: null });
      if (v != null) o.visitasPerfil = (o.visitasPerfil || 0) + Math.round(v);
      if (f != null) o.novosSeguidores = (o.novosSeguidores || 0) + Math.round(f);
    }
    const dias = Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data));
    if (!dias.length) return { ok: false, erro: "Nenhum dia com dados na planilha." };
    const meses = {};
    for (const d of dias) (meses[d.data.slice(0, 7)] ||= []).push(d);
    return { ok: true, dias: dias.length, meses, periodo: { inicio: dias[0].data, fim: dias[dias.length - 1].data },
      colunas: { visitas: vi >= 0 ? rows[hi][vi] : null, seguidores: si >= 0 ? rows[hi][si] : null } };
  }
  /** Soma de um período a partir dos dias importados. Se faltar algum dia, não soma (mostra a cobertura). */
  function periodo(dias, ini, fim) {
    const total = Diario.diff(ini, fim) + 1;
    const dentro = (dias || []).filter(d => d.data >= ini && d.data <= fim);
    const soma = k => {
      const com = dentro.filter(d => isNum(d[k]));
      if (!com.length) return { v: null, m: dentro.length ? "Não informado na planilha" : "Não importado para este período" };
      if (com.length < total) return { v: null, m: `Faltam dias na planilha (${com.length} de ${total} dias)` };
      return { v: com.reduce((s, d) => s + d[k], 0), m: null };
    };
    return { visitas: soma("visitasPerfil"), seguidores: soma("novosSeguidores"), cobertos: dentro.length, total };
  }
  function taxas(p, investimentoCentavos) {
    return {
      visitaSeguidor: Metrics.ratio(p.seguidores.v, p.visitas.v, 100, "seguidores", "visitas"),
      investimentoPorSeguidor: Metrics.ratio(investimentoCentavos, p.seguidores.v, 1, "investimentoCentavos", "seguidores"),
    };
  }
  /** Junta dias novos aos existentes do mês; dias do arquivo substituem os anteriores. */
  function mesclar(existentes, novos) {
    const ds = new Set(novos.map(d => d.data));
    return [...(existentes || []).filter(d => !ds.has(d.data)), ...novos].sort((a, b) => a.data.localeCompare(b.data));
  }
  return { importar, periodo, taxas, mesclar };
})();

const Domain = (() => {
  const SCHEMA = 1;
  const isNum = Fmt.isNum;
  const OBJETIVOS = {
    mensagens: "Mensagens (WhatsApp / Direct)", leads: "Geração de leads (formulário)", vendas: "Vendas no site",
    trafego: "Tráfego (site ou perfil)", alcance: "Reconhecimento e alcance", misto: "Misto",
  };
  const STATUS = { ativo: "Ativo", pausado: "Pausado", encerrado: "Encerrado" };
  const SERVICOS = { trafego: "Tráfego pago", social: "Social media" };
  const OBJ_META = { engajamento: "Engajamento", leads: "Cadastros (leads)", vendas: "Vendas", trafego: "Tráfego", reconhecimento: "Reconhecimento", app: "Promoção do app" };
  const STATUS_CAMP = { ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
  const TIPOS = {
    conversas: "Conversas por mensagem iniciadas", leads: "Leads (cadastros)", compras: "Compras",
    visitas: "Visitas ao perfil", engajamento: "Engajamentos", cliques: "Cliques no link", outro: "Outro",
  };
  const TIPOS_CURTO = { conversas: "conversas", leads: "leads", compras: "compras", visitas: "visitas", engajamento: "engajamentos", cliques: "cliques" };
  const FORMATOS = { imagem: "Imagem", carrossel: "Carrossel", video: "Vídeo (feed)", reels: "Reels", stories: "Stories", catalogo: "Catálogo", outro: "Outro" };
  const ATRIBUICAO = {
    declarado: "O cliente perguntou ao comprador", rastreio: "Rastreamento (link, cupom ou mensagem padrão)",
    pixel: "Pixel / API de Conversões do Meta", crm: "CRM com origem registrada", estimativa: "Estimativa", outro: "Outro critério",
  };
  /** Tipo de resultado sugerido a partir do objetivo do cliente */
  const TIPO_PADRAO = { mensagens: "conversas", leads: "leads", vendas: "compras", trafego: "cliques" };

  const COLLECTIONS = ["clientes", "relatorios", "campanhas", "conjuntos", "anuncios", "resultados_comerciais", "analises", "testes", "diarios", "criativos", "instagram"];
  const DEPENDENTES = COLLECTIONS.filter(c => c !== "clientes");
  /** Coleções da agência (não ligadas a um único relatório de tráfego) */
  const AGENCIA = ["tarefas", "financeiro", "recorrencias", "reservas", "posts", "planejamentos", "leads", "documentos"];

  const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  /** "1 conversa", "12 conversas" */
  const qtdTipo = (n, tipo, outro) => { const l = tipoLabel(tipo, outro, true) || ""; return `${Fmt.integer(n)} ${n === 1 && /s$/.test(l) && tipo !== "outro" ? l.replace(/s$/, "") : l}`.trim(); };
  const tipoLabel = (tipo, outro, curto) => tipo === "outro" ? (outro || "outro") : tipo ? (curto ? TIPOS_CURTO[tipo] : TIPOS[tipo]) : null;

  /* ---------- especificação de campos ---------- */
  const F = {
    text: (k, l, o) => ({ k, l, type: "text", ...o }),
    area: (k, l, o) => ({ k, l, type: "textarea", ...o }),
    money: (k, l, o) => ({ k, l, type: "money", ...o }),
    int: (k, l, o) => ({ k, l, type: "int", ...o }),
    date: (k, l, o) => ({ k, l, type: "date", ...o }),
    select: (k, l, options, o) => ({ k, l, type: "select", options, ...o }),
    bool: (k, l, o) => ({ k, l, type: "bool", ...o }),
  };
  const METRICAS = (comAlcance) => [
    { section: "Entrega (Meta Ads)" },
    F.money("investimentoCentavos", "Investimento", { help: "Valor usado no período." }),
    comAlcance ? { row: [F.int("alcance", "Alcance"), F.int("impressoes", "Impressões")] } : F.int("impressoes", "Impressões"),
    F.int("cliquesLink", "Cliques no link", { help: "Use a coluna “Cliques no link”, não “Cliques (todos)”." }),
    { section: "Resultado" },
    { row: [F.select("tipoResultado", "Tipo de resultado", TIPOS, { blank: "Não informado" }), F.int("resultados", "Quantidade")] },
    F.text("tipoResultadoOutro", "Nome do resultado", { help: "Só quando o tipo for “Outro”.", max: 60 }),
  ];
  const SPEC = {
    resumo: [
      { section: "Período" },
      { row: [F.date("periodoInicio", "Início", { req: true }), F.date("periodoFim", "Fim", { req: true })] },
      ...METRICAS(true),
      F.money("orcamentoDiarioCentavos", "Orçamento diário", { help: "Opcional. Soma dos orçamentos diários ativos no mês. Sem ele, o painel mostra a média gasta por dia." }),
      { note: "Alcance do mês: use a linha de total do Gerenciador no nível de campanhas. Ela já remove pessoas repetidas; somar o alcance das campanhas dá um número maior que o real." },
      { section: "Notas" },
      F.area("observacoes", "Observações sobre os dados", { help: "Ex.: conta ficou parada 5 dias por falta de pagamento." }),
    ],
    campanha: [
      F.text("nome", "Nome da campanha", { req: true, max: 120 }),
      { row: [F.select("objetivo", "Objetivo no Meta", OBJ_META, { blank: "Não informado" }), F.select("status", "Status", STATUS_CAMP, { blank: "Não informado" })] },
      { row: [F.date("periodoInicio", "Veiculou de"), F.date("periodoFim", "até")] },
      ...METRICAS(true),
      { section: "Notas" },
      F.area("observacoes", "Status ou observações"),
    ],
    conjunto: [
      F.select("campanhaId", "Campanha", ctx => ctx.campanhas, { req: true, blank: "Escolha a campanha" }),
      F.text("nome", "Nome do conjunto", { req: true, max: 120 }),
      F.area("publico", "Público ou segmentação", { help: "Ex.: mulheres 25–45, raio de 8 km de Blumenau, interesse em estética." }),
      F.text("posicionamentos", "Posicionamentos", { help: "Ex.: Advantage+ ou Feed e Stories do Instagram.", max: 160 }),
      ...METRICAS(true),
      { section: "Notas" },
      F.area("observacoes", "Observações estratégicas"),
    ],
    anuncio: [
      F.select("campanhaId", "Campanha", ctx => ctx.campanhas, { req: true, blank: "Escolha a campanha" }),
      F.select("conjuntoId", "Conjunto", (ctx, v) => ctx.conjuntosDe(v.campanhaId), { blank: "Não informado" }),
      F.text("nome", "Nome do anúncio", { req: true, max: 120 }),
      { row: [F.select("formato", "Formato do criativo", FORMATOS, { blank: "Não informado" }), F.text("angulo", "Ângulo ou abordagem", { max: 160 })] },
      F.text("oferta", "Oferta apresentada", { max: 160, help: "Ex.: avaliação gratuita, 10% na primeira compra." }),
      ...METRICAS(false),
      { section: "Notas" },
      F.area("observacoes", "Observações e aprendizados"),
    ],
    comercial: [
      { section: "Funil comercial (informado pelo cliente)" },
      F.int("leadsQualificados", "Leads qualificados"),
      F.text("criterioQualificacao", "O que conta como lead qualificado", { max: 200, help: "Ex.: pediu orçamento com data e quantidade." }),
      { row: [F.int("vendasAtribuidas", "Vendas atribuídas aos anúncios"), F.money("receitaAtribuidaCentavos", "Receita dessas vendas")] },
      { note: "Registre a receita já sem cancelamentos e reembolsos." },
      F.money("faturamentoTotalCentavos", "Faturamento geral do cliente no mês", { help: "Tudo o que o cliente faturou no mês, de qualquer origem (anúncios, indicação, loja…)." }),
      F.select("criterioAtribuicao", "Como as vendas foram atribuídas aos anúncios", ATRIBUICAO, { blank: "Não informado" }),
      F.text("atribuicaoDetalhe", "Detalhe do critério", { max: 200 }),
      F.text("fonteInformacao", "De onde vieram esses números", { max: 160, help: "Ex.: planilha de pedidos enviada pela cliente em 03/10." }),
      { section: "Custos de aquisição (para o CAC total)" },
      F.money("custosExtrasCentavos", "Custos além da mídia", { help: "Ex.: fee da agência, produção de criativos, comissão de vendas. Pode ser 0." }),
      F.text("custosExtrasDescricao", "Quais custos estão incluídos", { max: 200 }),
      F.bool("custosCompletos", "Todos os custos de aquisição relevantes estão incluídos"),
    ],
  };
  SPEC.analise = [
    { section: "Para o cliente" },
    F.area("resumoExecutivo", "Resumo executivo", { help: "Abre o relatório em PDF. Escreva em linguagem simples: o que aconteceu no mês e o que vem a seguir." }),
    F.area("pontosAtencao", "Pontos de atenção", { help: "O que o cliente precisa saber ou fazer. Ex.: responder as conversas em até 1 hora." }),
    { section: "Análise do período" },
    F.area("funcionou", "O que funcionou"),
    F.area("naoFuncionou", "O que não funcionou como esperado"),
    F.area("gargalos", "Principais gargalos"),
    F.area("hipoteses", "Hipóteses para investigar", { help: "Registre como hipótese e diga que dado falta para confirmar." }),
    F.area("aprendizados", "Aprendizados"),
  ];
  const VARIAVEIS = { criativo: "Criativo", publico: "Público", oferta: "Oferta", posicionamento: "Posicionamento", orcamento: "Orçamento ou lance", destino: "Destino (WhatsApp, site, formulário)", outro: "Outro" };
  const STATUS_TESTE = { planejado: "Planejado", andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
  const STATUS_ACAO = { pendente: "Pendente", andamento: "Em andamento", feito: "Feito" };
  SPEC.teste = [
    F.area("hipotese", "Hipótese", { req: true, max: 600, help: "Ex.: vídeos mostrando o preparo geram conversas mais baratas que fotos do produto pronto." }),
    { row: [F.select("variavel", "O que está sendo testado", VARIAVEIS, { blank: "Não informado" }), F.select("status", "Status", STATUS_TESTE, { req: true })] },
    F.area("descricao", "Como o teste foi montado", { help: "Campanhas, conjuntos ou anúncios envolvidos e o que mudou entre eles." }),
    { row: [F.date("inicio", "Início"), F.date("fim", "Fim")] },
    F.area("resultadoObservado", "Resultado observado", { help: "Números e volume: investimento, impressões e resultados de cada lado." }),
    F.area("aprendizado", "Aprendizado"),
    F.text("decisao", "Decisão tomada", { max: 200 }),
  ];
  const flat = spec => spec.flatMap(s => s.row ? s.row : s.k ? [s] : []);
  const resolveOptions = (f, ctx, values) => typeof f.options === "function" ? f.options(ctx || {}, values || {}) : f.options;

  /** Converte e valida os campos brutos de um formulário. */
  function parseFields(spec, raw, ctx) {
    const data = {}, errors = {};
    for (const f of flat(spec)) {
      const v = raw[f.k];
      let out = null;
      if (f.type === "money" || f.type === "int") {
        const r = f.type === "money" ? Fmt.parseMoney(v) : Fmt.parseInt(v);
        if (!r.ok) errors[f.k] = r.error; else out = r.value;
      } else if (f.type === "bool") {
        out = v === true || v === "on" || v === "true";
      } else if (f.type === "select") {
        const opts = resolveOptions(f, ctx, raw) || {};
        if (v && !Object.prototype.hasOwnProperty.call(opts, v)) errors[f.k] = "Escolha uma opção da lista.";
        else out = v || null;
      } else if (f.type === "date") {
        const s = String(v ?? "").trim();
        if (s) {
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
          const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          if (!m || d.getMonth() !== Number(m[2]) - 1) errors[f.k] = "Data inválida."; else out = s;
        }
      } else {
        const s = String(v ?? "").trim().replace(f.type === "textarea" ? /[ \t]+/g : /\s+/g, " ");
        const max = f.max || (f.type === "textarea" ? 3000 : 120);
        if (s.length > max) errors[f.k] = `Use no máximo ${max} caracteres.`; else out = s || null;
      }
      if (f.req && (out == null || out === "") && !errors[f.k]) errors[f.k] = "Campo obrigatório.";
      data[f.k] = out;
    }
    return { data, errors };
  }

  /** Regras de coerência entre métricas de uma mesma linha. */
  function checkMetricas(d, errors, bounds) {
    if (isNum(d.cliquesLink) && isNum(d.impressoes) && d.cliquesLink > d.impressoes) errors.cliquesLink ||= "Os cliques no link não podem ser maiores que as impressões.";
    if (isNum(d.alcance) && isNum(d.impressoes) && d.alcance > d.impressoes) errors.alcance ||= "O alcance não pode ser maior que as impressões.";
    if (isNum(d.resultados) && !d.tipoResultado) errors.tipoResultado ||= "Escolha o tipo de resultado.";
    if (d.tipoResultado === "outro" && !d.tipoResultadoOutro) errors.tipoResultadoOutro ||= "Dê um nome ao resultado.";
    if (d.tipoResultado !== "outro" && "tipoResultadoOutro" in d) d.tipoResultadoOutro = null;
    if (d.periodoInicio && d.periodoFim && d.periodoFim < d.periodoInicio) errors.periodoFim ||= "O fim não pode ser antes do início.";
    if (bounds) for (const k of ["periodoInicio", "periodoFim"]) {
      if (d[k] && (d[k] < bounds.inicio || d[k] > bounds.fim)) errors[k] ||= `Use uma data entre ${Fmt.date(bounds.inicio)} e ${Fmt.date(bounds.fim)}.`;
    }
  }

  /** Valida uma entidade do mês. kind: resumo | campanha | conjunto | anuncio | comercial. */
  function validate(kind, raw, ctx) {
    const { data, errors } = parseFields(SPEC[kind], raw, ctx);
    const warnings = [];
    if (!["comercial", "analise", "teste", "instagram"].includes(kind)) checkMetricas(data, errors, ctx && ctx.bounds);
    if (kind === "anuncio" && data.conjuntoId && ctx) {
      const opts = ctx.conjuntosDe(data.campanhaId) || {};
      if (!opts[data.conjuntoId]) errors.conjuntoId = "Esse conjunto não pertence à campanha escolhida.";
    }
    if ((kind === "campanha" || kind === "conjunto" || kind === "anuncio") && ctx && ctx.nomesExistentes) {
      if (data.nome && ctx.nomesExistentes.some(n => norm(n) === norm(data.nome))) warnings.push(`Já existe ${kind === "anuncio" ? "um anúncio" : kind === "conjunto" ? "um conjunto" : "uma campanha"} com esse nome neste mês.`);
    }
    if (kind === "teste" && data.inicio && data.fim && data.fim < data.inicio) errors.fim = "O fim não pode ser antes do início.";
    if (kind === "teste" && data.status === "concluido" && !data.resultadoObservado) warnings.push("Teste concluído sem resultado observado. Registre os números para o aprendizado ficar verificável.");
    if (kind === "comercial") {
      if (data.custosCompletos && data.custosExtrasCentavos == null) errors.custosExtrasCentavos = "Informe os custos além da mídia (pode ser 0) para calcular o CAC total.";
      const leads = ctx && ctx.leads;
      if (isNum(leads) && isNum(data.leadsQualificados) && data.leadsQualificados > leads) warnings.push("Há mais leads qualificados do que conversas/leads registrados no Meta Ads. Confira se o cliente contou contatos de outras origens.");
      if (isNum(data.leadsQualificados) && isNum(data.vendasAtribuidas) && data.vendasAtribuidas > data.leadsQualificados) warnings.push("Há mais vendas atribuídas do que leads qualificados. Confira o critério de qualificação.");
      if (isNum(data.vendasAtribuidas) && data.vendasAtribuidas > 0 && !data.criterioAtribuicao) warnings.push("Informe como as vendas foram atribuídas aos anúncios para o relatório deixar isso claro.");
    }
    return { ok: Object.keys(errors).length === 0, data, errors, warnings };
  }

  /** Valida a lista de ações do plano. Linhas totalmente vazias são ignoradas. */
  function validateAcoes(list) {
    const acoes = [], errors = [];
    (list || []).forEach((a, i) => {
      const acao = String(a.acao ?? "").trim(), resp = String(a.responsavel ?? "").trim(), prazo = String(a.prazo ?? "").trim();
      const status = STATUS_ACAO[a.status] ? a.status : "pendente";
      if (!acao && !resp && !prazo) return;
      const e = {};
      if (!acao) e.acao = "Descreva a ação.";
      if (acao.length > 300) e.acao = "Use no máximo 300 caracteres.";
      if (resp.length > 80) e.responsavel = "Use no máximo 80 caracteres.";
      if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) e.prazo = "Data inválida.";
      if (Object.keys(e).length) errors.push({ i, ...e });
      acoes.push({ acao, responsavel: resp || null, prazo: prazo || null, status });
    });
    return { ok: !errors.length, acoes, errors };
  }

  /** Valida o cadastro de cliente. */
  function validateCliente(input, existentes, idAtual) {
    const errors = {};
    const nome = String(input.nome ?? "").trim().replace(/\s+/g, " ");
    if (nome.length < 2) errors.nome = "Informe o nome do cliente (mínimo 2 caracteres).";
    else if (nome.length > 80) errors.nome = "Use no máximo 80 caracteres.";
    else if (existentes.some(c => c.id !== idAtual && norm(c.nome) === norm(nome))) errors.nome = "Já existe um cliente com esse nome.";
    const segmento = String(input.segmento ?? "").trim().slice(0, 80);
    const cidade = String(input.cidade ?? "").trim().slice(0, 80);
    const objetivo = input.objetivo || null;
    if (objetivo && !OBJETIVOS[objetivo]) errors.objetivo = "Escolha um objetivo da lista.";
    const status = input.status || "ativo";
    if (!STATUS[status]) errors.status = "Escolha um status da lista.";
    const ticket = Fmt.parseMoney(input.ticketMedio);
    if (!ticket.ok) errors.ticketMedio = ticket.error;
    const inicio = String(input.inicioGestao ?? "").trim() || null;
    if (inicio) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inicio);
      const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!m || d.getMonth() !== Number(m[2]) - 1) errors.inicioGestao = "Data inválida.";
      else if (inicio > Fmt.todayISO()) errors.inicioGestao = "A data não pode estar no futuro.";
    }
    const observacoes = String(input.observacoes ?? "").trim();
    if (observacoes.length > 2000) errors.observacoes = "Use no máximo 2.000 caracteres.";
    // dados da agência
    const servicos = [].concat(input.servicos || []).filter(x => SERVICOS[x]);
    const mens = Fmt.parseMoney(input.mensalidade);
    if (!mens.ok) errors.mensalidade = mens.error;
    let venc = String(input.diaVencimento ?? "").trim();
    if (venc && (!/^\d{1,2}$/.test(venc) || +venc < 1 || +venc > 31)) errors.diaVencimento = "Use um dia entre 1 e 31.";
    const instagram = String(input.instagram ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "").slice(0, 60);
    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) errors.instagram = "Use só o @ do perfil, sem espaços.";
    const contatoNome = String(input.contatoNome ?? "").trim().slice(0, 80);
    const telefone = String(input.telefone ?? "").trim().slice(0, 30);
    if (telefone && !/^[\d\s()+-]{8,30}$/.test(telefone)) errors.telefone = "Use só números, espaços, parênteses e traço.";
    const email = String(input.email ?? "").trim().slice(0, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido.";
    const ok = Object.keys(errors).length === 0;
    return {
      ok, errors,
      data: ok ? { nome, segmento: segmento || null, cidade: cidade || null, objetivo, status,
        ticketMedioCentavos: ticket.value, inicioGestao: inicio, observacoes: observacoes || null, moeda: "BRL", schema: SCHEMA,
        servicos, mensalidadeCentavos: mens.value, diaVencimento: venc ? Number(venc) : null, instagram: instagram || null,
        contatoNome: contatoNome || null, telefone: telefone || null, email: email || null, interno: !!input.interno } : null,
    };
  }

  const relatorioId = (clienteId, comp) => `${clienteId}_${comp}`;
  /** Id do documento da imagem de um criativo: um por cliente e nome de anúncio */
  const criativoId = (clienteId, anuncio) => `${clienteId}_${norm(anuncio).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "anuncio"}`;
  function novoId(nome) {
    const slug = norm(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "item";
    return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  return { SERVICOS, VARIAVEIS, STATUS_TESTE, STATUS_ACAO, validateAcoes, SCHEMA, OBJETIVOS, STATUS, OBJ_META, STATUS_CAMP, TIPOS, TIPOS_CURTO, FORMATOS, ATRIBUICAO, TIPO_PADRAO,
    COLLECTIONS, DEPENDENTES, AGENCIA, SPEC, flat, resolveOptions, parseFields, validate, validateCliente, relatorioId, criativoId, novoId, norm, tipoLabel, qtdTipo };
})();

/* =====================================================================
   DESEMPENHO — painel de tráfego por cliente e da carteira inteira.
   Uma "linha" = um cliente em um mês lançado. As mesmas regras valem
   para um cliente (várias linhas do mesmo cliente) e para a carteira
   (linhas de todos os clientes): somas só do que é somável e taxas
   sempre ponderadas (soma ÷ soma), nunca médias de percentuais.
   ===================================================================== */
const Desempenho = (() => {
  const isNum = Fmt.isNum;
  const { ratio, ponderada, soma } = Metrics;
  const na = m => ({ v: null, m });
  const diasEntre = (a, b) => { const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); return Math.round((t(b) - t(a)) / 864e5) + 1; };
  const diasNoMes = comp => new Date(Date.UTC(+comp.slice(0, 4), +comp.slice(5, 7), 0)).getUTCDate();

  /** Uma linha mensal: resumo do mês + resultados comerciais + campanhas do mês. */
  function linha({ comp, clienteId, resumo, com, campanhas, metas, periodoInicio, periodoFim }) {
    const R = resumo || {}, C = com || {}, M = metas || {};
    const camps = (campanhas || []).filter(c => isNum(c.resultados) && c.tipoResultado);
    const doTipo = t => { const xs = camps.filter(c => c.tipoResultado === t); return xs.length ? xs.reduce((s, c) => s + c.resultados, 0) : null; };
    let conversas = doTipo("conversas"), leadsForm = doTipo("leads");
    // sem campanhas desses tipos lançadas: usa o resultado principal do resumo
    if (conversas == null && leadsForm == null && isNum(R.resultados)) {
      if (R.tipoResultado === "conversas") conversas = R.resultados;
      if (R.tipoResultado === "leads") leadsForm = R.resultados;
    }
    const leads = conversas == null && leadsForm == null ? null : (conversas || 0) + (leadsForm || 0);
    const orcCamps = (campanhas || []).filter(c => isNum(c.orcamentoDiarioCentavos));
    const b = comp ? { inicio: `${comp}-01`, fim: `${comp}-${String(diasNoMes(comp)).padStart(2, "0")}` } : null;
    const ini = periodoInicio || (b && b.inicio), fim = periodoFim || (b && b.fim);
    return {
      comp, clienteId: clienteId || null,
      investimentoCentavos: isNum(R.investimentoCentavos) ? R.investimentoCentavos : null,
      alcance: isNum(R.alcance) ? R.alcance : null, impressoes: isNum(R.impressoes) ? R.impressoes : null, cliquesLink: isNum(R.cliquesLink) ? R.cliquesLink : null,
      conversas, leadsForm, leads,
      leadsQualificados: isNum(C.leadsQualificados) ? C.leadsQualificados : null,
      vendas: isNum(C.vendasAtribuidas) ? C.vendasAtribuidas : null,
      receita: isNum(C.receitaAtribuidaCentavos) ? C.receitaAtribuidaCentavos : null,
      faturamentoTotal: isNum(C.faturamentoTotalCentavos) ? C.faturamentoTotalCentavos : null,
      custosExtras: isNum(C.custosExtrasCentavos) ? C.custosExtrasCentavos : null,
      orcamentoDiario: isNum(R.orcamentoDiarioCentavos) ? R.orcamentoDiarioCentavos : orcCamps.length ? orcCamps.reduce((s, c) => s + c.orcamentoDiarioCentavos, 0) : null,
      dias: ini && fim ? diasEntre(ini, fim) : null,
      diasMes: comp ? diasNoMes(comp) : null,
      margemPct: isNum(M.margemPct) ? M.margemPct : null,
    };
  }

  /** Consolida linhas. carteira: linhas de vários clientes. */
  function consolidar(rows, opts) {
    rows = rows || []; opts = opts || {};
    const um = rows.length === 1 ? rows[0] : null;
    const clientes = new Set(rows.map(r => r.clienteId)).size;
    const umMesPorCliente = rows.length > 0 && clientes === rows.length;
    let alcance;
    if (um) alcance = isNum(um.alcance) ? { v: um.alcance, m: null } : na("Alcance: não informado");
    else if (opts.carteira && umMesPorCliente) { const s = soma(rows, "alcance"); alcance = { ...s, nota: "Soma do alcance de cada cliente" }; }
    else alcance = na(opts.carteira ? "Alcance só é somado para um mês" : "Alcance não é somável entre meses");
    // orçamento diário: o informado (um mês) ou a média gasta por dia
    let orcamentoDiario;
    if (um && isNum(um.orcamentoDiario)) orcamentoDiario = { v: um.orcamentoDiario, m: null, nota: "Orçamento diário informado" };
    else if (opts.carteira && umMesPorCliente && rows.every(r => isNum(r.orcamentoDiario))) orcamentoDiario = { v: rows.reduce((s, r) => s + r.orcamentoDiario, 0), m: null, nota: "Soma dos orçamentos diários" };
    else { const r = ponderada(rows.filter(x => isNum(x.dias)), "investimentoCentavos", "dias", 1); orcamentoDiario = { ...r, nota: r.v == null ? null : "Média gasta por dia" }; }
    // CAC: mídia + custos extras, só quando os custos extras foram informados em todos os meses com vendas
    const comVendas = rows.filter(r => isNum(r.vendas) && isNum(r.investimentoCentavos));
    const cac = !comVendas.length ? na("Vendas: não informado")
      : comVendas.some(r => !isNum(r.custosExtras)) ? na("Informe os custos além da mídia (fee, produção) em Resultados comerciais")
      : ponderada(comVendas.map(r => ({ custo: r.investimentoCentavos + r.custosExtras, vendas: r.vendas })), "custo", "vendas", 1);
    // lucro estimado: receita × margem − investimento − custos extras, por linha
    const comReceita = rows.filter(r => isNum(r.receita) && isNum(r.investimentoCentavos));
    const comMargem = comReceita.filter(r => isNum(r.margemPct));
    let lucro;
    if (!comReceita.length) lucro = na("Faturamento atribuído: não informado");
    else if (!comMargem.length) lucro = na(opts.carteira ? "Nenhum cliente com margem de lucro cadastrada nas metas" : "Cadastre a margem de lucro do cliente em Metas");
    else {
      lucro = { v: comMargem.reduce((s, r) => s + Math.round(r.receita * r.margemPct / 100) - r.investimentoCentavos - (r.custosExtras || 0), 0), m: null };
      const fora = new Set(comReceita.filter(r => !isNum(r.margemPct)).map(r => r.clienteId)).size;
      if (fora) lucro.nota = `${fora} ${fora === 1 ? "cliente sem margem cadastrada ficou" : "clientes sem margem cadastrada ficaram"} de fora`;
    }
    return {
      linhas: rows.length, clientes,
      investimentoCentavos: soma(rows, "investimentoCentavos"),
      orcamentoDiario, alcance,
      impressoes: soma(rows, "impressoes"),
      frequencia: um ? ratio(um.impressoes, um.alcance, 1, "impressoes", "alcance") : na("Frequência só é calculada para um mês de um cliente"),
      cpm: ponderada(rows, "investimentoCentavos", "impressoes", 1000),
      cliquesLink: soma(rows, "cliquesLink"),
      ctr: ponderada(rows, "cliquesLink", "impressoes", 100),
      cpc: ponderada(rows, "investimentoCentavos", "cliquesLink", 1),
      conversas: soma(rows, "conversas"),
      leadsForm: soma(rows, "leadsForm"),
      leads: soma(rows, "leads"),
      cpl: ponderada(rows, "investimentoCentavos", "leads", 1),
      taxaCliqueLead: ponderada(rows, "leads", "cliquesLink", 100),
      leadsQualificados: soma(rows, "leadsQualificados"),
      taxaQualificacao: ponderada(rows, "leadsQualificados", "leads", 100),
      vendas: soma(rows, "vendas"),
      receita: soma(rows, "receita"),
      faturamentoTotal: soma(rows, "faturamentoTotal"),
      participacao: ponderada(rows, "receita", "faturamentoTotal", 100),
      cac,
      custoVenda: ponderada(rows, "investimentoCentavos", "vendas", 1),
      roas: ponderada(rows, "receita", "investimentoCentavos", 1),
      taxaLeadVenda: ponderada(rows, "vendas", "leads", 100),
      ticket: ponderada(rows, "receita", "vendas", 1),
      lucro,
    };
  }

  /** Definição de cada indicador do painel (nome, formato, direção e fórmula). */
  const IND = {
    investimentoCentavos: { nome: "Investimento em anúncios", fmt: "moeda", dir: 0, formula: "Soma do valor usado no período." },
    orcamentoDiario: { nome: "Orçamento diário", fmt: "moeda", dir: 0, formula: "Orçamento informado no resumo do mês ou soma dos orçamentos das campanhas importadas. Sem isso, a média gasta por dia (investimento ÷ dias do período)." },
    alcance: { nome: "Alcance", fmt: "int", dir: 1, formula: "Pessoas únicas que viram os anúncios (total do mês)." },
    impressoes: { nome: "Impressões", fmt: "int", dir: 1, formula: "Soma das exibições." },
    frequencia: { nome: "Frequência", fmt: "dec", dir: 0, formula: "Impressões ÷ Alcance." },
    cpm: { nome: "CPM", fmt: "moeda", dir: -1, formula: "Investimento ÷ Impressões × 1.000." },
    cliquesLink: { nome: "Cliques no link", fmt: "int", dir: 1, formula: "Soma dos cliques no link." },
    ctr: { nome: "CTR", fmt: "pct", dir: 1, formula: "Cliques no link ÷ Impressões × 100." },
    cpc: { nome: "CPC", fmt: "moeda", dir: -1, formula: "Investimento ÷ Cliques no link." },
    conversas: { nome: "Conversas iniciadas", fmt: "int", dir: 1, formula: "Resultados das campanhas de mensagem." },
    leadsForm: { nome: "Leads gerados", fmt: "int", dir: 1, formula: "Resultados das campanhas de cadastro (formulário)." },
    leads: { nome: "Leads totais", fmt: "int", dir: 1, formula: "Conversas iniciadas + Leads gerados." },
    cpl: { nome: "CPL", fmt: "moeda", dir: -1, formula: "Investimento ÷ (Conversas iniciadas + Leads gerados)." },
    taxaCliqueLead: { nome: "Conversão clique → lead", fmt: "pct", dir: 1, formula: "(Conversas + Leads) ÷ Cliques no link × 100." },
    leadsQualificados: { nome: "Leads qualificados", fmt: "int", dir: 1, formula: "Informado pelo cliente." },
    taxaQualificacao: { nome: "Taxa de qualificação", fmt: "pct", dir: 1, formula: "Leads qualificados ÷ Leads totais × 100." },
    vendas: { nome: "Vendas realizadas", fmt: "int", dir: 1, formula: "Vendas atribuídas aos anúncios, informadas pelo cliente." },
    receita: { nome: "Faturamento dos anúncios", fmt: "moeda", dir: 1, formula: "Receita das vendas atribuídas aos anúncios, informada pelo cliente." },
    faturamentoTotal: { nome: "Faturamento geral", fmt: "moeda", dir: 1, formula: "Tudo o que o cliente faturou no mês, de qualquer origem. Informado pelo cliente." },
    participacao: { nome: "Peso dos anúncios no faturamento", fmt: "pct", dir: 1, formula: "Faturamento dos anúncios ÷ Faturamento geral × 100." },
    cac: { nome: "CAC", fmt: "moeda", dir: -1, formula: "(Investimento + custos além da mídia) ÷ Vendas." },
    custoVenda: { nome: "Custo por venda", fmt: "moeda", dir: -1, formula: "Investimento ÷ Vendas." },
    roas: { nome: "ROAS", fmt: "x", dir: 1, formula: "Faturamento dos anúncios ÷ Investimento." },
    taxaLeadVenda: { nome: "Conversão lead → venda", fmt: "pct", dir: 1, formula: "Vendas ÷ Leads totais × 100." },
    ticket: { nome: "Ticket médio", fmt: "moeda", dir: 1, formula: "Faturamento dos anúncios ÷ Vendas." },
    lucro: { nome: "Lucro estimado", fmt: "moeda", dir: 1, formula: "Faturamento dos anúncios × margem de lucro do cliente − Investimento − custos além da mídia." },
  };

  /** Metas por cliente. volume: meta mensal, ajustada aos dias do período. */
  const METAS = [
    { k: "investimentoMensalCentavos", ind: "investimentoCentavos", nome: "Investimento mensal planejado", tipo: "money", volume: true, neutra: true },
    { k: "cplMaxCentavos", ind: "cpl", nome: "CPL máximo", tipo: "money", dir: -1 },
    { k: "ctrMin", ind: "ctr", nome: "CTR mínimo", tipo: "pct", dir: 1 },
    { k: "cpcMaxCentavos", ind: "cpc", nome: "CPC máximo", tipo: "money", dir: -1 },
    { k: "cpmMaxCentavos", ind: "cpm", nome: "CPM máximo", tipo: "money", dir: -1 },
    { k: "leadsMin", ind: "leads", nome: "Leads por mês", tipo: "int", dir: 1, volume: true },
    { k: "vendasMin", ind: "vendas", nome: "Vendas por mês", tipo: "int", dir: 1, volume: true },
    { k: "faturamentoMinCentavos", ind: "receita", nome: "Faturamento dos anúncios por mês", tipo: "money", dir: 1, volume: true },
    { k: "roasMin", ind: "roas", nome: "ROAS mínimo", tipo: "x", dir: 1 },
    { k: "cacMaxCentavos", ind: "cac", nome: "CAC máximo", tipo: "money", dir: -1 },
  ];
  const TOLERANCIA = 0.15;

  /** Compara o consolidado com as metas. rows: linhas do período (para ajustar metas de volume). */
  function avaliar(cons, metas, rows) {
    metas = metas || {};
    const fracao = (rows || []).reduce((s, r) => s + (isNum(r.dias) && isNum(r.diasMes) ? Math.min(1, r.dias / r.diasMes) : 1), 0);
    const out = [];
    for (const d of METAS) {
      let alvo = metas[d.k];
      if (!isNum(alvo)) continue;
      if (d.volume) alvo = alvo * fracao;
      const v = cons[d.ind] ? cons[d.ind].v : null;
      let status;
      if (!isNum(v)) status = "sem";
      else if (d.neutra) status = "info";
      else if (d.dir > 0) status = v >= alvo ? "ok" : v >= alvo * (1 - TOLERANCIA) ? "perto" : "fora";
      else status = v <= alvo ? "ok" : v <= alvo * (1 + TOLERANCIA) ? "perto" : "fora";
      out.push({ k: d.k, ind: d.ind, nome: d.nome, alvo, v, status, pct: isNum(v) && alvo ? v / alvo * 100 : null, volume: !!d.volume, fmt: IND[d.ind].fmt });
    }
    return out;
  }
  /** Saúde geral: pior status entre as metas avaliadas. */
  function saude(aval) {
    const st = (aval || []).map(a => a.status);
    if (st.includes("fora")) return "fora";
    if (st.includes("perto")) return "perto";
    if (st.includes("ok")) return "ok";
    return "sem";
  }
  return { linha, consolidar, IND, METAS, avaliar, saude, TOLERANCIA };
})();
