"use strict";
/* =====================================================================
   RELATÓRIO EM PDF (pdfmake). Recebe um modelo pronto (views.reportModel):
   todos os números vêm do núcleo de cálculo, igual às telas.
   ===================================================================== */
const PdfReport = (() => {
  const C = { dark: "#2B1A12", brown: "#6F4A31", mid: "#8B5E3C", beige: "#D8C3A5", light: "#F4EADF", paper: "#FFFCF8", text: "#2B1A12", muted: "#7A6455", line: "#E4D4C0", ok: "#3D7350", bad: "#A3392A" };
  const FONTS = {
    Jost: { normal: "Jost-Regular.ttf", bold: "Jost-SemiBold.ttf", italics: "Jost-Regular.ttf", bolditalics: "Jost-SemiBold.ttf" },
    JostMedium: { normal: "Jost-Medium.ttf", bold: "Jost-SemiBold.ttf", italics: "Jost-Medium.ttf", bolditalics: "Jost-SemiBold.ttf" },
    Serif: { normal: "InstrumentSerif-Regular.ttf", bold: "InstrumentSerif-Regular.ttf", italics: "InstrumentSerif-Regular.ttf", bolditalics: "InstrumentSerif-Regular.ttf" },
  };
  const NI = "Não informado.";
  const chartColors = { mark: C.mid, markMuted: C.beige, text: C.text, muted: C.muted, grid: C.line, bg: C.paper };

  const sec = (n, t) => ({ text: `${n}. ${t}`, font: "Serif", fontSize: 19, color: C.dark, margin: [0, 18, 0, 8], headlineLevel: 1 });
  const para = t => t ? { text: t, fontSize: 10.5, lineHeight: 1.35, color: C.text, margin: [0, 0, 0, 6] } : { text: NI, fontSize: 10.5, italics: true, color: C.muted, margin: [0, 0, 0, 6] };
  const sub = t => ({ text: t, font: "JostMedium", fontSize: 10.5, color: C.brown, margin: [0, 6, 0, 3] });
  const note = t => ({ text: t, fontSize: 8.5, color: C.muted, margin: [0, 4, 0, 0], lineHeight: 1.3 });

  function delta(cur, prev, fmt, dir, prevLabel, bloq) {
    if (bloq) return { text: bloq, fontSize: 8, color: C.muted };
    if (!prev) return { text: "Sem comparação", fontSize: 8, color: C.muted };
    const vr = Metrics.variacao(cur && cur.v, prev.v, dir);
    if (!vr) return { text: prev.v == null ? `Sem dado em ${prevLabel}` : "Sem comparação", fontSize: 8, color: C.muted };
    const main = fmt === "pct" ? Fmt.signed("pct", vr.abs) : vr.pct == null ? Fmt.signed(fmt, vr.abs) : Fmt.signedPct(vr.pct);
    const color = vr.sentido === "melhor" ? C.ok : vr.sentido === "pior" ? C.bad : C.muted;
    return { text: `${main} vs ${prevLabel}`, fontSize: 8, color };
  }
  function kpiCell(label, cur, prev, fmt, dir, prevLabel, bloq) {
    return {
      stack: [
        { text: label, fontSize: 8.5, color: C.muted },
        { text: Fmt.metric(fmt, cur && cur.v), font: "Serif", fontSize: 18, color: cur && cur.v != null ? C.dark : C.muted, margin: [0, 1, 0, 1] },
        cur && cur.v == null ? { text: cur.m || "Não informado", fontSize: 7.5, color: C.muted } : delta(cur, prev, fmt, dir, prevLabel, bloq),
      ], margin: [8, 7, 8, 7],
    };
  }
  function grid(cells, cols) {
    const body = [];
    for (let i = 0; i < cells.length; i += cols) { const row = cells.slice(i, i + cols); while (row.length < cols) row.push({ text: "" }); body.push(row); }
    return { table: { widths: Array(cols).fill("*"), body }, layout: { fillColor: () => C.light, hLineColor: () => C.paper, vLineColor: () => C.paper, hLineWidth: () => 3, vLineWidth: () => 3, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }, unbreakable: true };
  }
  const tableLayout = {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => C.line,
    fillColor: (i, node) => (i === 0 ? C.dark : node.table.footer && i === node.table.body.length - 1 ? C.light : null),
    paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4,
  };
  const th = (t, right) => ({ text: t, color: C.light, fontSize: 8, font: "JostMedium", alignment: right ? "right" : "left" });
  const td = (t, right, opts) => ({ text: t, fontSize: 8.5, alignment: right ? "right" : "left", color: t === Fmt.NA ? C.muted : C.text, ...(opts || {}) });

  function build(m) {
    const { cliente, cur, prev } = m;
    const prevLabel = Fmt.monthShort(m.prevComp);
    const tipo = cur.tipoResultado ? Domain.tipoLabel(cur.tipoResultado, cur.tipoResultadoOutro) : "Resultados";
    const bloqTipo = prev && prev.resultados.v != null && (prev.tipoResultado !== cur.tipoResultado || (prev.tipoResultadoOutro || null) !== (cur.tipoResultadoOutro || null)) ? "Tipo de resultado diferente" : null;
    const D = Metrics.DEFS;
    const an = m.analise || {};
    const content = [];

    /* 1 e 2 — identificação e período (faixa da capa) */
    content.push({
      columns: [
        { width: "*", stack: [
          { text: "GARCIA MARKETING", fontSize: 8.5, characterSpacing: 2, color: C.beige },
          { text: "Relatório mensal", font: "Serif", fontSize: 30, color: C.light, margin: [0, 4, 0, 0] },
          { text: "Tráfego pago · Meta Ads", fontSize: 10, color: C.beige },
        ] },
        { width: "auto", alignment: "right", stack: [
          { text: cliente.nome, font: "Serif", fontSize: 20, color: C.light },
          { text: Fmt.month(m.comp).replace(/^./, s => s.toUpperCase()), fontSize: 10, color: C.beige, margin: [0, 4, 0, 0] },
          { text: `Período: ${Fmt.date(m.rel.periodoInicio)} a ${Fmt.date(m.rel.periodoFim)}`, fontSize: 9, color: C.beige },
        ] },
      ], margin: [0, 6, 0, 52],
    });

    /* 3 — resumo executivo */
    const bloco = (n, t, ...first) => ({ stack: [sec(n, t), ...first], unbreakable: true });
    content.push(bloco(1, "Resumo executivo", para(an.resumoExecutivo)));

    /* 4 — indicadores */
    const cells = [
      kpiCell("Investimento", cur.investimentoCentavos, prev && prev.investimentoCentavos, "moeda", 0, prevLabel),
      kpiCell("Alcance", cur.alcance, prev && prev.alcance, "int", 1, prevLabel),
      kpiCell("Impressões", cur.impressoes, prev && prev.impressoes, "int", 1, prevLabel),
      kpiCell("Frequência", cur.frequencia, prev && prev.frequencia, "dec", 0, prevLabel),
      kpiCell("Cliques no link", cur.cliquesLink, prev && prev.cliquesLink, "int", 1, prevLabel),
      kpiCell("CTR de link", cur.ctr, prev && prev.ctr, "pct", D.ctr.dir, prevLabel),
      kpiCell("CPC de link", cur.cpc, prev && prev.cpc, "moeda", D.cpc.dir, prevLabel),
      kpiCell("CPM", cur.cpm, prev && prev.cpm, "moeda", D.cpm.dir, prevLabel),
      kpiCell(tipo, cur.resultados, prev && prev.resultados, "int", 1, prevLabel, bloqTipo),
      kpiCell("Custo por resultado", cur.cpr, prev && prev.cpr, "moeda", D.cpr.dir, prevLabel, bloqTipo),
    ];
    const temCom = [cur.leadsQualificados, cur.vendas, cur.receita].some(x => x.v != null);
    if (temCom) cells.push(
      kpiCell("Leads qualificados", cur.leadsQualificados, prev && prev.leadsQualificados, "int", 1, prevLabel),
      kpiCell("Vendas atribuídas", cur.vendas, prev && prev.vendas, "int", 1, prevLabel),
      kpiCell("Receita atribuída", cur.receita, prev && prev.receita, "moeda", 1, prevLabel),
      kpiCell("ROAS", cur.roas, prev && prev.roas, "x", D.roas.dir, prevLabel),
      kpiCell("CAC de mídia", cur.cacMidia, prev && prev.cacMidia, "moeda", D.cacMidia.dir, prevLabel));
    content.push(bloco(2, "Principais indicadores", grid(cells, 3)),
      note(`Comparação com ${Fmt.month(m.prevComp)}${prev ? "" : " (mês sem dados lançados)"}. Verde indica melhora e vermelho piora para o indicador; investimento e frequência não têm direção certa.` +
        (temCom ? " Leads qualificados, vendas e receita foram informados pelo cliente." : " Leads qualificados, vendas e receita não foram informados pelo cliente neste mês.")));

    /* 5 — evolução */
    const labels = m.evol.map(e => Fmt.monthTiny(e.comp));
    const comDados = m.evol.filter(e => e.cons).length;
    content.push(bloco(3, "Evolução dos resultados",
      comDados < 2 ? para("A evolução aparece a partir do segundo mês com dados lançados.") : "",
      { columns: [
        { width: "*", stack: [sub("Investimento por mês"), { svg: Charts.svg({ labels, values: m.evol.map(e => e.cons && e.cons.investimentoCentavos.v), fmt: "moeda", kind: "bar", width: 250, height: 150, colors: chartColors, font: "Jost", fontSize: 7 }), width: 250 }] },
        { width: "*", stack: [sub(`Custo por resultado (${cur.tipoResultado ? Domain.tipoLabel(cur.tipoResultado, cur.tipoResultadoOutro, true) : "resultado"})`),
          { svg: Charts.svg({ labels, values: m.evol.map(e => e.cons && e.cons.tipoResultado === cur.tipoResultado ? e.cons.cpr.v : null), fmt: "moeda", kind: "line", width: 250, height: 150, colors: chartColors, font: "Jost", fontSize: 7 }), width: 250 }] },
      ], columnGap: 15 }),
      note("Últimos 6 meses. “—” indica mês sem lançamento ou sem o dado. O custo por resultado só considera meses com o mesmo tipo de resultado."));

    /* 6 — campanhas */
    content.push(sec(4, "Desempenho das campanhas"));
    if (!m.campanhas.length) content.push(para("As campanhas não foram detalhadas neste mês. Os números acima são da conta como um todo."));
    else {
      const body = [[th("Campanha"), th("Investimento", 1), th("Impressões", 1), th("Cliques", 1), th("CTR", 1), th("Resultados", 1), th("Custo/resultado", 1)]];
      for (const c of m.campanhas) {
        const res = Fmt.isNum(c.resultados) ? Domain.qtdTipo(c.resultados, c.tipoResultado, c.tipoResultadoOutro) : Fmt.NA;
        body.push([{ stack: [td(c.nome), c.objetivo ? { text: Domain.OBJ_META[c.objetivo], fontSize: 7.5, color: C.muted } : ""] },
          td(Fmt.money(c.investimentoCentavos), 1), td(Fmt.integer(c.impressoes), 1), td(Fmt.integer(c.cliquesLink), 1), td(Fmt.pct(c.b.ctr.v), 1), td(res, 1), td(Fmt.money(c.b.cpr.v), 1)]);
      }
      const t = m.campTotal, r1 = t.resultados.length === 1 ? t.resultados[0] : null;
      body.push([td("Total", 0, { bold: true }), td(Fmt.money(t.investimentoCentavos.v), 1, { bold: true }), td(Fmt.integer(t.impressoes.v), 1, { bold: true }), td(Fmt.integer(t.cliquesLink.v), 1, { bold: true }),
        td(Fmt.pct(t.ctr.v), 1, { bold: true }), td(r1 ? Fmt.integer(r1.resultados) : t.resultados.length > 1 ? "Tipos diferentes" : Fmt.NA, 1, { bold: true }), td(r1 ? Fmt.money(r1.cpr.v) : Fmt.NA, 1, { bold: true })]);
      content.push({ table: { headerRows: 1, widths: ["*", 62, 58, 44, 40, 70, 62], body, footer: true }, layout: tableLayout },
        note("CTR e custo do total são ponderados pelo volume de cada campanha."));
    }

    /* 7 — funil */
    const funilSec = sec(5, "Funil: do anúncio à venda");
    const f = m.funil;
    const fb = [[th("Etapa"), th("Origem"), th("Quantidade", 1)]];
    for (const e of f.etapas) fb.push([td(e.nome), td(e.origem === "meta" ? "Meta Ads" : "Informado pelo cliente", 0, { color: C.muted }), td(e.v == null ? (e.motivo ? "Não se aplica" : "Não informado") : e.fmt === "moeda" ? Fmt.money(e.v) : Fmt.integer(e.v), 1)]);
    const tx = f.taxas, cel = (k) => kpiCell(D[k].nome, tx[k], null, D[k].fmt, D[k].dir, prevLabel, " ");
    content.push({ stack: [funilSec, { columns: [
      { width: 250, table: { headerRows: 1, widths: ["*", 92, 60], body: fb }, layout: tableLayout },
      { width: "*", stack: [grid(["taxaCliqueLead", "taxaQualificacao", "taxaLeadVenda", "cpl", "cacMidia", "roas"].map(cel), 2)] },
    ], columnGap: 15 }], unbreakable: true });
    if (m.com) {
      const crit = [m.com.criterioAtribuicao && Domain.ATRIBUICAO[m.com.criterioAtribuicao], m.com.atribuicaoDetalhe].filter(Boolean).join(" · ");
      content.push(note(`Vendas atribuídas aos anúncios pelo critério: ${crit || "não informado"}. ${m.com.criterioQualificacao ? "Lead qualificado: " + m.com.criterioQualificacao + ". " : ""}${m.com.fonteInformacao ? "Fonte: " + m.com.fonteInformacao + "." : ""}`));
      if (tx.cacTotal.v != null) content.push(note(`CAC total (mídia + ${Fmt.money(m.com.custosExtrasCentavos)} em outros custos de aquisição${m.com.custosExtrasDescricao ? ": " + m.com.custosExtrasDescricao : ""}): ${Fmt.money(tx.cacTotal.v)}.`));
    } else content.push(note("Leads qualificados, vendas e receita não foram informados pelo cliente neste mês, por isso as etapas comerciais e o retorno não puderam ser calculados."));

    /* 8 — aprendizados */
    content.push(sec(6, "Principais aprendizados"));
    if (!an.aprendizados && !an.funcionou && !an.naoFuncionou && !m.testes.some(t => t.aprendizado)) content.push(para(null));
    if (an.aprendizados) content.push(para(an.aprendizados));
    if (an.funcionou) content.push(sub("O que funcionou"), para(an.funcionou));
    if (an.naoFuncionou) content.push(sub("O que não funcionou como esperado"), para(an.naoFuncionou));
    const tcom = m.testes.filter(t => t.aprendizado || t.resultadoObservado);
    if (tcom.length) {
      content.push(sub("Testes do mês"));
      for (const t of tcom) content.push({ text: [{ text: t.hipotese + " ", bold: true }, t.resultadoObservado ? `Resultado: ${t.resultadoObservado} ` : "", t.aprendizado ? `Aprendizado: ${t.aprendizado}` : ""], fontSize: 9.5, lineHeight: 1.3, margin: [0, 0, 0, 5] });
    }

    /* 9 — pontos de atenção */
    content.push(sec(7, "Pontos de atenção"));
    if (!an.pontosAtencao && !an.gargalos) content.push(para(null));
    if (an.pontosAtencao) content.push(para(an.pontosAtencao));
    if (an.gargalos) content.push(sub("Gargalos identificados"), para(an.gargalos));

    /* 10 — plano de ação */
    content.push(sec(8, "Plano de ação para o próximo período"));
    if (an.acoes && an.acoes.length) {
      const body = [[th("Ação"), th("Responsável"), th("Prazo"), th("Status")]];
      for (const a of an.acoes) body.push([td(a.acao), td(a.responsavel || Fmt.NA), td(a.prazo ? Fmt.date(a.prazo) : Fmt.NA), td(Domain.STATUS_ACAO[a.status] || "Pendente")]);
      content.push({ table: { headerRows: 1, widths: ["*", 90, 60, 70], body }, layout: tableLayout });
    } else content.push(para(null));

    const gerado = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(m.geradoEm);
    return {
      pageSize: "A4", pageMargins: [40, 46, 40, 46],
      info: { title: `Relatório ${cliente.nome} — ${Fmt.month(m.comp)}`, author: "Garcia Marketing", subject: "Relatório mensal de Meta Ads" },
      defaultStyle: { font: "Jost", fontSize: 10, color: C.text },
      background: (page, size) => page === 1 ? { canvas: [{ type: "rect", x: 0, y: 0, w: size.width, h: 148, color: C.dark }] } : null,
      header: (page) => page === 1 ? null : { columns: [{ text: "Garcia Marketing", font: "Serif", fontSize: 11, color: C.brown }, { text: `${cliente.nome} · ${Fmt.month(m.comp)}`, alignment: "right", fontSize: 8, color: C.muted }], margin: [40, 18, 40, 0] },
      footer: (page, total) => ({ columns: [{ text: `Fonte: Gerenciador de Anúncios da Meta (lançamento manual) e dados informados pelo cliente. Valores em R$. Gerado em ${gerado}.`, fontSize: 7, color: C.muted }, { text: `${page}/${total}`, alignment: "right", fontSize: 7.5, color: C.muted, width: 30 }], margin: [40, 14, 40, 0] }),
      pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
      content,
    };
  }

  /** Relatório de um intervalo de datas (dados diários). */
  function buildPeriodo(m) {
    const { cliente, cur, prev } = m;
    const umDia = m.ini === m.fim;
    const periodoTxt = umDia ? Fmt.date(m.ini) : `${Fmt.date(m.ini)} a ${Fmt.date(m.fim)}`;
    const cmpTxt = m.cmp ? (m.cmp.ini === m.cmp.fim ? Fmt.date(m.cmp.ini) : `${Fmt.date(m.cmp.ini).slice(0, 5)} a ${Fmt.date(m.cmp.fim).slice(0, 5)}`) : null;
    const tipoCurto = m.tipo ? Domain.TIPOS_CURTO[m.tipo] || "resultados" : "resultados";
    const um = tipoCurto.replace(/s$/, "");
    const content = [];
    let n = 0;
    content.push({
      columns: [
        { width: "*", stack: [
          { text: "GARCIA MARKETING", fontSize: 8.5, characterSpacing: 2, color: C.beige },
          { text: umDia ? "Relatório do dia" : "Relatório do período", font: "Serif", fontSize: 30, color: C.light, margin: [0, 4, 0, 0] },
          { text: "Tráfego pago · Meta Ads", fontSize: 10, color: C.beige },
        ] },
        { width: "auto", alignment: "right", stack: [
          { text: cliente.nome, font: "Serif", fontSize: 20, color: C.light },
          { text: periodoTxt, fontSize: 10, color: C.beige, margin: [0, 4, 0, 0] },
          { text: m.campanha ? `Campanha: ${m.campanha}` : "Todas as campanhas", fontSize: 9, color: C.beige },
        ] },
      ], margin: [0, 6, 0, 52],
    });
    if (m.comentario) content.push({ stack: [sec(++n, "Comentários"), para(m.comentario)], unbreakable: true });
    const P = prev;
    const lbl = cmpTxt || "";
    const cells = [
      kpiCell("Investimento", cur.investimentoCentavos, P && P.investimentoCentavos, "moeda", 0, lbl),
      kpiCell("Impressões", cur.impressoes, P && P.impressoes, "int", 1, lbl),
      kpiCell("Cliques no link", cur.cliquesLink, P && P.cliquesLink, "int", 1, lbl),
      kpiCell("CTR de link", cur.ctr, P && P.ctr, "pct", 1, lbl),
      kpiCell("CPC de link", cur.cpc, P && P.cpc, "moeda", -1, lbl),
      kpiCell("CPM", cur.cpm, P && P.cpm, "moeda", -1, lbl),
      kpiCell(m.tipo ? Domain.tipoLabel(m.tipo) : "Resultados", cur.resultados, P && P.resultados, "int", 1, lbl),
      kpiCell(`Custo por ${um}`, cur.cpr, P && P.cpr, "moeda", -1, lbl),
    ];
    content.push({ stack: [sec(++n, "Principais indicadores"), grid(cells, 3)], unbreakable: true },
      note((P ? `Comparação com ${m.cmpModo === "mes" ? "as mesmas datas do mês anterior" : "o período anterior de mesma duração"} (${m.cmp.ini === m.cmp.fim ? Fmt.date(m.cmp.ini) : Fmt.date(m.cmp.ini) + " a " + Fmt.date(m.cmp.fim)}). Verde indica melhora e vermelho piora; investimento não tem direção certa. ` : "Sem dados no período de comparação. ") +
        `O custo por ${um} considera só o investimento das campanhas que geram ${tipoCurto}${cur.investimentoTipo.v != null ? ` (${Fmt.money(cur.investimentoTipo.v)})` : ""}.`));
    if (m.instagram) {
      const { A, B } = m.instagram;
      const cells = [
        kpiCell("Visitas ao perfil", A.p.visitas, B && B.p.visitas, "int", 1, lbl),
        kpiCell("Novos seguidores", A.p.seguidores, B && B.p.seguidores, "int", 1, lbl),
        kpiCell("Visitas que viraram seguidores", A.t.visitaSeguidor, B && B.t.visitaSeguidor, "pct", 1, lbl),
        kpiCell("Investimento por novo seguidor", A.t.investimentoPorSeguidor, B && B.t.investimentoPorSeguidor, "moeda", -1, lbl),
        kpiCell("Visitas vindas dos anúncios", A.anuncios, B && B.anuncios, "int", 1, lbl),
      ];
      content.push({ stack: [sec(++n, "Instagram"), grid(cells, 3)], unbreakable: true },
        note("Visitas ao perfil e novos seguidores importados do Meta, somando os dias do período. O investimento por novo seguidor é uma referência (todo o investimento do período dividido pelos seguidores ganhos), não um custo exato."));
    }
    if (!umDia) {
      const labels = m.serie.map(d => `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`);
      content.push({ stack: [sec(++n, "Evolução por dia"), { columns: [
        { width: "*", stack: [sub("Investimento"), { svg: Charts.svg({ labels, values: m.serie.map(d => d.dados ? d.r.investimentoCentavos.v : null), fmt: "moeda", kind: "bar", width: 250, height: 150, colors: chartColors, font: "Jost", fontSize: 7 }), width: 250 }] },
        { width: "*", stack: [sub(`${m.tipo ? Domain.tipoLabel(m.tipo, null, true).replace(/^./, x => x.toUpperCase()) : "Resultados"} por dia`), { svg: Charts.svg({ labels, values: m.serie.map(d => d.dados ? d.r.resultados.v : null), fmt: "int", kind: "bar", width: 250, height: 150, colors: chartColors, font: "Jost", fontSize: 7 }), width: 250 }] },
      ], columnGap: 15 }], unbreakable: true });
    }
    // campanhas
    const cb = [[th("Campanha"), th("Investimento", 1), th("Impressões", 1), th("Cliques", 1), th("CTR", 1), th("Resultados", 1), th("Custo/resultado", 1)]];
    for (const c of m.campanhas) {
      const b = Metrics.basicas(c);
      const res = Fmt.isNum(c.resultados) ? Domain.qtdTipo(c.resultados, c.tipoResultado, c.tipoResultadoOutro) : Fmt.NA;
      cb.push([td(c.nome), td(Fmt.money(c.investimentoCentavos), 1), td(Fmt.integer(c.impressoes), 1), td(Fmt.integer(c.cliquesLink), 1), td(Fmt.pct(b.ctr.v), 1), td(res, 1), td(Fmt.money(b.cpr.v), 1)]);
    }
    content.push(sec(++n, "Campanhas no período"), m.campanhas.length ? { table: { headerRows: 1, widths: ["*", 62, 58, 44, 40, 70, 62], body: cb }, layout: tableLayout } : para("Nenhuma campanha com veiculação no período."));
    // conjuntos e criativos
    if (m.conjuntos && m.conjuntos.length) {
      const situ = i => i.melhor ? { text: "Melhor custo", color: C.ok, bold: true, fontSize: 8 } : i.vol.baixo ? { text: "Em teste (pouco volume)", color: C.muted, fontSize: 8 } : !i.relevante && i.tipoResultado ? { text: "Pouca verba", color: C.muted, fontSize: 8 } : { text: "", fontSize: 8 };
      const resT = i => Fmt.isNum(i.resultados) ? Domain.qtdTipo(i.resultados, i.tipoResultado, i.tipoResultadoOutro) : Fmt.NA;
      const cb2 = [[th("Conjunto"), th("Investimento", 1), th("Cliques", 1), th("CTR", 1), th("Resultados", 1), th("Custo/resultado", 1), th("")]];
      for (const i of m.conjuntos) cb2.push([{ stack: [td(i.conjunto), { text: i.campanha, fontSize: 7, color: C.muted }] }, td(Fmt.money(i.investimentoCentavos), 1), td(Fmt.integer(i.cliquesLink), 1), td(Fmt.pct(i.ctr.v), 1), td(resT(i), 1), td(Fmt.money(i.cpr.v), 1), situ(i)]);
      content.push(sec(++n, "Conjuntos de anúncios"), { table: { headerRows: 1, widths: ["*", 62, 44, 40, 70, 62, 70], body: cb2 }, layout: tableLayout });
      const ab = [[th(""), th("Criativo"), th("Investimento", 1), th("CTR", 1), th("Resultados", 1), th("Custo/resultado", 1), th("")]];
      for (const i of m.anuncios) {
        const img = m.imagens && m.imagens[i.anuncio];
        ab.push([img ? { image: img, fit: [46, 46], alignment: "center" } : { text: "sem\nimagem", fontSize: 6.5, color: C.muted, alignment: "center", margin: [0, 12, 0, 0] },
          { stack: [td(i.anuncio, 0, { bold: !!i.melhor }), { text: `${i.conjunto} · ${i.campanha}`, fontSize: 7, color: C.muted }] },
          td(Fmt.money(i.investimentoCentavos), 1), td(Fmt.pct(i.ctr.v), 1), td(resT(i), 1), td(Fmt.money(i.cpr.v), 1, { bold: !!i.melhor }), situ(i)]);
      }
      content.push(sec(++n, "Criativos"), { table: { headerRows: 1, widths: [50, "*", 60, 38, 66, 58, 64], body: ab, dontBreakRows: true }, layout: tableLayout },
        note(`Ordem: primeiro os criativos que geram ${m.tipo ? Domain.tipoLabel(m.tipo, null, true) : "o resultado principal"}, do menor para o maior custo. “Melhor custo” só é apontado entre criativos com volume suficiente (pelo menos ${Fmt.integer(Metrics.VOLUME_MIN.impressoes)} impressões e ${Metrics.VOLUME_MIN.resultados} resultados) e pelo menos 10% do investimento do período; os demais ainda estão em teste e não devem ser comparados só pelo custo.`));
    }
    // dia a dia
    if (!umDia) {
      const db = [[th("Dia"), th("Investimento", 1), th("Impressões", 1), th("Cliques", 1), th("CTR", 1), th(m.tipo ? Domain.tipoLabel(m.tipo, null, true).replace(/^./, x => x.toUpperCase()) : "Resultados", 1), th(`Custo/${um}`, 1)]];
      for (const d of m.serie) {
        const b = Metrics.basicas({ investimentoCentavos: d.r.investimentoCentavos.v, impressoes: d.r.impressoes.v, cliquesLink: d.r.cliquesLink.v });
        db.push([td(Fmt.date(d.data)), td(Fmt.money(d.r.investimentoCentavos.v), 1), td(Fmt.integer(d.r.impressoes.v), 1), td(Fmt.integer(d.r.cliquesLink.v), 1), td(Fmt.pct(b.ctr.v), 1), td(Fmt.integer(d.r.resultados.v), 1), td(Fmt.money(d.r.cpr.v), 1)]);
      }
      content.push(sec(++n, "Dia a dia"), { table: { headerRows: 1, widths: ["*", 70, 64, 50, 46, 64, 64], body: db }, layout: tableLayout },
        note("“—” indica dia sem veiculação ou sem o dado."));
    }
    content.push(note("Alcance e frequência não constam neste relatório porque são calculados pelo Meta para cada período e não podem ser somados a partir dos dias."));
    const gerado = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(m.geradoEm);
    return {
      pageSize: "A4", pageMargins: [40, 46, 40, 46],
      info: { title: `Relatório ${cliente.nome} — ${periodoTxt}`, author: "Garcia Marketing", subject: "Relatório de período de Meta Ads" },
      defaultStyle: { font: "Jost", fontSize: 10, color: C.text },
      background: (page, size) => page === 1 ? { canvas: [{ type: "rect", x: 0, y: 0, w: size.width, h: 148, color: C.dark }] } : null,
      header: (page) => page === 1 ? null : { columns: [{ text: "Garcia Marketing", font: "Serif", fontSize: 11, color: C.brown }, { text: `${cliente.nome} · ${periodoTxt}`, alignment: "right", fontSize: 8, color: C.muted }], margin: [40, 18, 40, 0] },
      footer: (page, total) => ({ columns: [{ text: `Fonte: Gerenciador de Anúncios da Meta (relatório diário importado). Valores em R$. Gerado em ${gerado}.`, fontSize: 7, color: C.muted }, { text: `${page}/${total}`, alignment: "right", fontSize: 7.5, color: C.muted, width: 30 }], margin: [40, 14, 40, 0] }),
      pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
      content,
    };
  }

  function generate(model, builder) {
    return new Promise((resolve, reject) => {
      if (!window.pdfMake || !window.GM_FONTS) return reject({ code: "pdf_lib" });
      try { window.pdfMake.createPdf((builder || build)(model), null, FONTS, window.GM_FONTS).getBlob(resolve); }
      catch (e) { reject(e); }
    });
  }
  return { build, buildPeriodo, generate, generatePeriodo: m => generate(m, buildPeriodo) };
})();
