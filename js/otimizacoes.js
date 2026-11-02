"use strict";
/* =====================================================================
   OTIMIZAÇÕES — calendário geral e diário de otimizações das contas
   Coleção: otimizacoes (uma por otimização feita ou planejada)
   { clienteId, data, otimizado, campanhas, conjuntos, anuncios, proxima, anotacoes }
   ===================================================================== */
UI.otmMes = Fmt.currentComp();
UI.otmCli = "";
UI.otmBusca = "";
const INTERVALO_PADRAO = 3;
const SIT_OTM = { atrasada: "Atrasada", hoje: "Hoje", emdia: "Em dia", sem: "Sem próxima data" };

/** Situação de cada conta: última otimização feita, próxima data e situação */
function contasOtm() {
  const regs = AG("otimizacoes") || [], hoje = Fmt.todayISO();
  const comReg = new Set(regs.map(r => r.clienteId));
  const clientes = clientesOrdenados().filter(c => !c.interno && (comReg.has(c.id) || ((c.servicos || []).includes("trafego") && (c.status || "ativo") === "ativo")));
  return clientes.map(c => {
    const meus = regs.filter(r => r.clienteId === c.id && r.data);
    const feitas = meus.filter(r => r.otimizado).sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || "").localeCompare(a.criadoEm || ""));
    const ultima = feitas[0] || null;
    const planejadas = meus.filter(r => !r.otimizado).sort((a, b) => a.data.localeCompare(b.data));
    const proxima = planejadas.length ? planejadas[0].data : ultima && ultima.proxima ? ultima.proxima : null;
    const sit = !proxima ? "sem" : proxima < hoje ? "atrasada" : proxima === hoje ? "hoje" : "emdia";
    const intervalo = ultima && ultima.proxima && ultima.proxima > ultima.data ? Diario.diff(ultima.data, ultima.proxima) : INTERVALO_PADRAO;
    return { c, ultima, planejada: planejadas[0] || null, proxima, sit, intervalo, total: feitas.length };
  });
}

function viewOtimizacoes() {
  const top = head("Tráfego", "Otimizações", "Calendário de otimização de cada conta e o registro do que foi feito em campanhas, conjuntos e anúncios.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openOtmForm(null, { clienteId: UI.otmCli || null }) }, "Registrar otimização"));
  const regs = AG("otimizacoes");
  if (regs == null || Store.state.clientes == null) return [top, loadingPanel()];
  const contas = contasOtm(), hoje = Fmt.todayISO();
  if (!contas.length) return [top, emptyPanel("Nenhuma conta de tráfego", "Cadastre um cliente com o serviço Tráfego pago para acompanhar as otimizações.",
    h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Ir para Clientes"))];
  const n = s => contas.filter(x => x.sit === s).length;
  const fimSemana = addDias(hoje, 7);
  const semana = contas.filter(x => x.proxima && x.proxima > hoje && x.proxima <= fimSemana).length;
  const mesAtual = Fmt.currentComp();
  const kpis = h("div", { class: "kpis-row" },
    kpiCard("Atrasadas", Fmt.integer(n("atrasada")), n("atrasada") ? "contas com a otimização vencida" : "nenhuma conta atrasada", n("atrasada") ? "bad" : null),
    kpiCard("Para hoje", Fmt.integer(n("hoje"))),
    kpiCard("Próximos 7 dias", Fmt.integer(semana)),
    kpiCard("Feitas no mês", Fmt.integer(regs.filter(r => r.otimizado && (r.data || "").startsWith(mesAtual)).length), Fmt.month(mesAtual)),
    kpiCard("Sem próxima data", Fmt.integer(n("sem")), n("sem") ? "defina quando otimizar" : null));
  return [top, kpis, tabelaContas(contas), calendarioOtm(contas), historicoOtm()];
}

/* ---------- contas ---------- */
function tabelaContas(contas) {
  const ordem = { atrasada: 0, hoje: 1, emdia: 2, sem: 3 };
  const rows = contas.slice().sort((a, b) => ordem[a.sit] - ordem[b.sit] || (a.proxima || "9").localeCompare(b.proxima || "9") || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
  return h("div", { class: "panel" }, h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Contas. "), "A próxima data vem da última otimização registrada (ou de uma otimização planejada).")),
    h("div", { class: "table-wrap" }, h("table", { class: "data otm-contas" },
      h("thead", null, h("tr", null, ["Cliente", "Última otimização", "Próxima otimização", "Situação", ""].map(t => h("th", null, t)))),
      h("tbody", null, rows.map(x => h("tr", null,
        h("td", null, h("div", { class: "name" }, x.c.nome), h("div", { class: "sub" }, x.total ? `${x.total} ${x.total === 1 ? "otimização registrada" : "otimizações registradas"}` : "Nenhuma otimização registrada")),
        h("td", null, x.ultima ? Fmt.date(x.ultima.data) : h("span", { class: "na" }, "—")),
        h("td", null, x.proxima ? Fmt.date(x.proxima) : h("span", { class: "na" }, "—")),
        h("td", null, h("span", { class: "otm-sit " + x.sit }, SIT_OTM[x.sit])),
        h("td", { class: "num" }, h("button", { class: "btn btn-sm" + (x.sit === "atrasada" || x.sit === "hoje" ? " btn-primary" : ""), type: "button", disabled: !canWrite(),
          onclick: () => x.planejada ? openOtmForm(x.planejada, { otimizado: true, data: Fmt.todayISO() }) : openOtmForm(null, { clienteId: x.c.id }) }, "Registrar"))))))));
}

/* ---------- calendário geral ---------- */
function calendarioOtm(contas) {
  const regs = (AG("otimizacoes") || []).filter(r => !UI.otmCli || r.clienteId === UI.otmCli);
  const comp = UI.otmMes, [y, m] = comp.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(), first = new Date(y, m - 1, 1).getDay(), hoje = Fmt.todayISO();
  // eventos: otimizações feitas, planejadas e a próxima data de cada conta
  const ev = [];
  for (const r of regs) if (r.data) ev.push({ data: r.data, tipo: r.otimizado ? "feita" : "planejada", r, clienteId: r.clienteId });
  for (const x of contas) if (!x.planejada && x.ultima && x.ultima.proxima && (!UI.otmCli || x.c.id === UI.otmCli)) ev.push({ data: x.ultima.proxima, tipo: "proxima", clienteId: x.c.id });
  const doMes = ev.filter(e => e.data.startsWith(comp)).sort((a, b) => (nomeCliente(a.clienteId) || "").localeCompare(nomeCliente(b.clienteId) || "", "pt-BR"));
  const abrir = e => e.tipo === "feita" ? openOtmForm(e.r) : e.tipo === "planejada" ? openOtmForm(e.r, { otimizado: true }) : openOtmForm(null, { clienteId: e.clienteId, data: e.data < hoje ? hoje : e.data });
  const chip = e => {
    const late = e.tipo !== "feita" && e.data < hoje;
    const rot = e.tipo === "feita" ? "Otimizada" : late ? "Atrasada" : "Otimizar";
    return h("button", { type: "button", class: `ochip ${e.tipo}${late ? " late" : ""}`, title: `${nomeCliente(e.clienteId) || "Cliente"} · ${rot}`, onclick: () => abrir(e) },
      h("span", { class: "ochip-i", "aria-hidden": "true" }, e.tipo === "feita" ? "✓" : "•"), h("span", { class: "pchip-t" }, nomeCliente(e.clienteId) || "Cliente"), h("span", { class: "sr" }, ` · ${rot}`));
  };
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h("div", { class: "ec-cell empty", "aria-hidden": "true" }));
  for (let d = 1; d <= last; d++) {
    const ds = `${comp}-${pad2(d)}`;
    cells.push(h("div", { class: "ec-cell otm-cell" + (ds === hoje ? " today" : "") },
      h("div", { class: "ec-d" }, h("span", null, String(d)), h("button", { class: "ec-add", type: "button", "aria-label": `Registrar otimização em ${Fmt.date(ds)}`, disabled: !canWrite(),
        onclick: () => openOtmForm(null, { clienteId: UI.otmCli || null, data: ds, otimizado: ds <= hoje }) }, "+")),
      doMes.filter(e => e.data === ds).map(chip)));
  }
  const dias = [...new Set(doMes.map(e => e.data))].sort();
  const agenda = h("div", { class: "ec-agenda" }, dias.length ? dias.map(ds => h("div", { class: "ec-ag-day" + (ds === hoje ? " today" : "") },
    h("div", { class: "ec-ag-h" }, `${DIAS_SEMANA[new Date(ds + "T12:00").getDay()]}, ${Fmt.date(ds)}`), doMes.filter(e => e.data === ds).map(chip))) : h("p", { class: "muted-line" }, "Nenhuma otimização neste mês."));
  return h("div", { class: "panel" },
    h("div", { class: "toolbar" }, mesNav(comp, c => { UI.otmMes = c; render(); }), clienteFiltro("otmCli", UI.otmCli, v => { UI.otmCli = v; render(); }, { incluir: c => !c.interno })),
    h("div", { class: "ec" }, h("div", { class: "ec-grid" }, ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(x => h("div", { class: "ec-h" }, x)), cells), agenda),
    h("div", { class: "ec-legend otm-legend" }, h("span", { class: "feita" }, h("i"), "Otimizada"), h("span", { class: "proxima" }, h("i"), "A otimizar"), h("span", { class: "late" }, h("i"), "Atrasada")));
}

/* ---------- histórico (diário de otimizações) ---------- */
function historicoOtm() {
  const q = Domain.norm(UI.otmBusca);
  const regs = (AG("otimizacoes") || []).filter(r => (!UI.otmCli || r.clienteId === UI.otmCli) &&
    (!q || Domain.norm([nomeCliente(r.clienteId), r.campanhas, r.conjuntos, r.anuncios, r.anotacoes].join(" ")).includes(q)))
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  const busca = h("input", { class: "search", id: "otmBusca", type: "search", placeholder: "Buscar no que foi otimizado", value: UI.otmBusca, "aria-label": "Buscar otimizações",
    oninput: e => { UI.otmBusca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("otmBusca"); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } });
  const txt = t => t ? h("div", { class: "otm-txt", title: t }, t) : h("span", { class: "na" }, "—");
  const toggle = async (r, v) => { try { await Store.patch("otimizacoes", r.id, { otimizado: v, ...(v && r.data > Fmt.todayISO() ? { data: Fmt.todayISO() } : {}) }); } catch (x) { toast(Store.message(x), "bad"); } };
  return h("div", { class: "panel" },
    h("div", { class: "tab-bar" }, h("p", null, h("strong", null, "Registro de otimizações"), UI.otmCli ? ` · ${nomeCliente(UI.otmCli)}` : ""), busca),
    regs.length ? h("div", { class: "table-wrap" }, h("table", { class: "data otm-hist" },
      h("thead", null, h("tr", null, ["Cliente", "Data", "Campanhas", "Conjuntos", "Anúncios", "Próxima", "Anotações e estratégias validadas", "Otimizado"].map(t => h("th", null, t)))),
      h("tbody", null, regs.map(r => h("tr", { class: "row-link", tabindex: "0", onclick: e => { if (!e.target.closest("input")) openOtmForm(r); }, onkeydown: e => { if (e.key === "Enter" && !e.target.closest("input")) openOtmForm(r); } },
        h("td", null, h("div", { class: "name" }, nomeCliente(r.clienteId) || "Cliente excluído")),
        h("td", null, r.data ? Fmt.date(r.data) : "—"),
        h("td", null, txt(r.campanhas)), h("td", null, txt(r.conjuntos)), h("td", null, txt(r.anuncios)),
        h("td", null, r.proxima ? Fmt.date(r.proxima) : h("span", { class: "na" }, "—")),
        h("td", null, txt(r.anotacoes)),
        h("td", { class: "num" }, h("input", { type: "checkbox", checked: !!r.otimizado, disabled: !canWrite(), "aria-label": `Otimizado em ${Fmt.date(r.data)}`, onchange: e => toggle(r, e.target.checked) })))))))
      : h("div", { class: "empty" }, h("p", null, q ? "Nada encontrado." : "Nenhuma otimização registrada ainda.")));
}

/* ---------- formulário ---------- */
function openOtmForm(r, preset) {
  preset = preset || {};
  const hoje = Fmt.todayISO();
  let values;
  if (r) {
    values = { ...r, ...preset };
    if (!values.proxima) { const conta = contasOtm().find(x => x.c.id === r.clienteId); values.proxima = addDias(values.data || hoje, conta ? conta.intervalo : INTERVALO_PADRAO); }
  }
  else {
    const cli = preset.clienteId || null, data = preset.data || hoje;
    const conta = cli ? contasOtm().find(x => x.c.id === cli) : null;
    values = { otimizado: preset.otimizado ?? data <= hoje, ...preset, clienteId: cli, data, proxima: addDias(data, conta ? conta.intervalo : INTERVALO_PADRAO) };
  }
  gavetaForm({
    title: r ? `Otimização · ${nomeCliente(r.clienteId) || ""}` : "Registrar otimização", values, saveLabel: "Salvar",
    spec: [
      { k: "clienteId", l: "Cliente", type: "select", req: true, blank: "Escolha o cliente", opts: () => clientesOrdenados().filter(c => !c.interno).map(c => [c.id, c.nome]) },
      { row: [{ k: "data", l: "Data da otimização", type: "date", req: true }, { k: "proxima", l: "Próxima otimização", type: "date", help: "Aparece no calendário geral." }] },
      { k: "otimizado", l: "Otimização feita", type: "bool" },
      { note: "Desmarque para deixar como otimização planejada para essa data." },
      { section: "O que otimizei" },
      { k: "campanhas", l: "Campanhas", type: "textarea", rows: 3, ph: "Ex.: subi o orçamento da campanha de mensagens de R$ 30 para R$ 40/dia." },
      { k: "conjuntos", l: "Conjuntos", type: "textarea", rows: 3, ph: "Ex.: pausei o conjunto aberto 25–45, CPL acima de R$ 15 há 5 dias." },
      { k: "anuncios", l: "Anúncios", type: "textarea", rows: 3, ph: "Ex.: subi 2 vídeos novos do combo; pausei o carrossel com CTR baixo." },
      { section: "Aprendizados" },
      { k: "anotacoes", l: "Anotações e estratégias validadas", type: "textarea", rows: 4, ph: "Ex.: vídeo mostrando o preparo segue trazendo conversa mais barata que foto." },
    ],
    validate: d => {
      const e = {};
      if (d.proxima && d.data && d.proxima <= d.data) e.proxima = "A próxima otimização precisa ser depois da data desta.";
      if (d.otimizado && d.data && d.data > hoje) e.data = "Uma otimização feita não pode ter data no futuro. Desmarque “Otimização feita” para planejar.";
      return e;
    },
    onDelete: r ? () => excluirDoc("otimizacoes", r, "esta otimização") : null,
    onSave: async d => {
      if (r) await Store.patch("otimizacoes", r.id, d);
      else await Store.put("otimizacoes", Domain.novoId(`${nomeCliente(d.clienteId) || "otm"} ${d.data}`), { ...d, schema: Domain.SCHEMA });
      return d.otimizado ? "Otimização registrada." : "Otimização planejada.";
    },
  });
}
