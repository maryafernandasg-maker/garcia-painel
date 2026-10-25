"use strict";
/* =====================================================================
   FINANCEIRO — cobranças (receitas), despesas, despesas fixas, reserva e fluxo de caixa
   Coleções: financeiro (lançamentos), recorrencias (despesas fixas), reservas
   Dinheiro em centavos. Situação de cada lançamento:
     cancelado > pago (tem data de pagamento) > atrasado (venceu e não foi pago) > pendente.
   ===================================================================== */
const CATEG_RECEITA = { mensalidade: "Mensalidade", projeto: "Projeto avulso", consultoria: "Consultoria", outros: "Outros" };
const CATEG_DESPESA = { ferramentas: "Ferramentas / softwares", design: "Design", edicao: "Edição / produção", marketing: "Marketing", freelancers: "Freelancers",
  impostos: "Impostos", contabilidade: "Contabilidade", equipamentos: "Equipamentos", prolabore: "Pró-labore", outros: "Outros" };
const FORMAS_PAG = { pix: "Pix", boleto: "Boleto", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro" };
const SITUACAO = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado", cancelado: "Cancelado" };
UI.finMes = Fmt.currentComp();
UI.finTab = "resumo";

function situacao(l, hoje = Fmt.todayISO()) {
  if (l.cancelado) return "cancelado";
  if (l.pagamento) return "pago";
  if (l.vencimento && l.vencimento < hoje) return "atrasado";
  return "pendente";
}
const venceEm = (comp, dia) => { const [y, m] = comp.split("-").map(Number); return `${comp}-${pad2(Math.min(dia, new Date(y, m, 0).getDate()))}`; };

/** Totais de um conjunto de lançamentos (centavos) */
function totaisFin(ls, hoje) {
  const t = { previsto: 0, pago: 0, aberto: 0, atrasado: 0, n: 0 };
  for (const l of ls) {
    const s = situacao(l, hoje);
    if (s === "cancelado") continue;
    const v = l.valorCentavos || 0;
    t.n++; t.previsto += v;
    if (s === "pago") t.pago += v; else { t.aberto += v; if (s === "atrasado") t.atrasado += v; }
  }
  return t;
}
/** Lançamentos que faltam gerar para o mês: mensalidades dos clientes ativos e despesas fixas ativas */
function planoGeracao(comp) {
  const fin = AG("financeiro") || [], ids = new Set(fin.map(l => l.id));
  const novos = [];
  for (const c of Store.state.clientes || []) {
    if ((c.status || "ativo") !== "ativo" || c.interno || !c.mensalidadeCentavos) continue;
    const id = `rec_${c.id}_${comp}`;
    if (ids.has(id)) continue;
    novos.push(["financeiro", id, { tipo: "receita", origem: "mensalidade", clienteId: c.id, descricao: `Mensalidade ${c.nome}`, categoria: "mensalidade", valorCentavos: c.mensalidadeCentavos,
      vencimento: c.diaVencimento ? venceEm(comp, c.diaVencimento) : `${comp}-10`, competencia: comp, pagamento: null, forma: null, cancelado: false, observacoes: null, schema: Domain.SCHEMA }]);
  }
  for (const r of AG("recorrencias") || []) {
    if (!r.ativa) continue;
    const id = `fix_${r.id}_${comp}`;
    if (ids.has(id)) continue;
    novos.push(["financeiro", id, { tipo: "despesa", origem: "fixa", recorrenciaId: r.id, descricao: r.descricao, categoria: r.categoria, valorCentavos: r.valorCentavos,
      vencimento: venceEm(comp, r.dia || 10), competencia: comp, pagamento: null, forma: r.forma || null, cancelado: false, observacoes: null, schema: Domain.SCHEMA }]);
  }
  return novos;
}

function viewFinanceiro() {
  const fin = AG("financeiro"), rec = AG("recorrencias"), res = AG("reservas");
  const comp = UI.finMes;
  const top = head("Agência", "Financeiro", "Cobranças dos clientes, despesas da agência, reserva e fluxo de caixa.",
    [h("button", { class: "btn", type: "button", disabled: !canWrite(), onclick: () => openLancForm(null, "despesa") }, "Nova despesa"),
     h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openLancForm(null, "receita") }, "Nova receita")]);
  if (fin == null || rec == null || res == null || Store.state.clientes == null) return [top, loadingPanel()];
  const hoje = Fmt.todayISO();
  const doMes = fin.filter(l => l.competencia === comp);
  const R = totaisFin(doMes.filter(l => l.tipo === "receita"), hoje), D = totaisFin(doMes.filter(l => l.tipo === "despesa"), hoje);
  const faltam = planoGeracao(comp);
  const tabs = [["resumo", "Resumo"], ["receitas", "Cobranças"], ["despesas", "Despesas"], ["fixas", "Despesas fixas"], ["reserva", "Reserva"], ["fluxo", "Fluxo de caixa"]];
  const nR = faltam.filter(x => x[2].tipo === "receita").length, nD = faltam.length - nR;
  const partes = [nR ? `${nR} ${nR === 1 ? "mensalidade de cliente ativo" : "mensalidades de clientes ativos"}` : null, nD ? `${nD} ${nD === 1 ? "despesa fixa" : "despesas fixas"}` : null].filter(Boolean).join(" e ");
  const gerar = faltam.length ? h("div", { class: "banner warn" }, h("div", null, h("strong", null, `${faltam.length === 1 ? "Falta" : "Faltam"} ${faltam.length} ${faltam.length === 1 ? "lançamento" : "lançamentos"} em ${Fmt.month(comp)}`),
      `${partes} ainda ${faltam.length === 1 ? "não foi lançada" : "não foram lançadas"} neste mês. `,
      h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: async e => { e.target.disabled = true; try { await Store.putMany(faltam); toast(`${faltam.length} lançamentos criados.`); } catch (x) { toast(Store.message(x), "bad"); e.target.disabled = false; } } }, "Gerar agora"))) : null;
  const kpis = h("div", { class: "kpis-row" },
    kpiCard("A receber no mês", Fmt.money(R.previsto), `${Fmt.money(R.pago)} recebido · ${Fmt.money(R.aberto)} em aberto`),
    kpiCard("Em atraso", Fmt.money(R.atrasado), R.atrasado ? "cobranças vencidas" : "nenhuma cobrança vencida", R.atrasado ? "bad" : null),
    kpiCard("Despesas do mês", Fmt.money(D.previsto), `${Fmt.money(D.pago)} pago · ${Fmt.money(D.aberto)} a pagar`),
    kpiCard("Resultado previsto", Fmt.money(R.previsto - D.previsto), "receitas menos despesas do mês", R.previsto - D.previsto < 0 ? "bad" : "good"),
    kpiCard("Saldo realizado", Fmt.money(R.pago - D.pago), "recebido menos pago"));
  let corpo;
  if (UI.finTab === "receitas") corpo = tabelaLanc(doMes.filter(l => l.tipo === "receita"), "receita");
  else if (UI.finTab === "despesas") corpo = tabelaLanc(doMes.filter(l => l.tipo === "despesa"), "despesa");
  else if (UI.finTab === "fixas") corpo = painelFixas(rec);
  else if (UI.finTab === "reserva") corpo = painelReserva(res);
  else if (UI.finTab === "fluxo") corpo = painelFluxo(fin, comp);
  else corpo = resumoFin(doMes, fin, hoje);
  return [top, h("div", { class: "toolbar bare" }, mesNav(comp, c => { UI.finMes = c; render(); })), gerar, kpis,
    h("div", { class: "panel" }, h("div", { class: "tabs", role: "tablist" }, tabs.map(([k, l]) => h("button", { type: "button", role: "tab", "aria-selected": String(UI.finTab === k), onclick: () => { UI.finTab = k; render(); } }, l))), corpo)];
}

function resumoFin(doMes, fin, hoje) {
  const atrasadas = fin.filter(l => l.tipo === "receita" && situacao(l, hoje) === "atrasado").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const proximas = fin.filter(l => situacao(l, hoje) === "pendente" && l.vencimento && l.vencimento <= addDias(hoje, 10)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const porCat = {};
  for (const l of doMes) if (l.tipo === "despesa" && !l.cancelado) porCat[l.categoria || "outros"] = (porCat[l.categoria || "outros"] || 0) + (l.valorCentavos || 0);
  const totalD = Object.values(porCat).reduce((a, b) => a + b, 0);
  const linha = l => h("li", null, h("button", { class: "linkbtn", type: "button", onclick: () => openLancForm(l, l.tipo) }, l.descricao || "Sem descrição"),
    h("span", { class: "sub" }, `${l.tipo === "receita" ? "Receber" : "Pagar"} · ${Fmt.date(l.vencimento)} · ${Fmt.money(l.valorCentavos)}`), botaoPagar(l));
  return h("div", { class: "fin-resumo" },
    h("div", { class: "panel-pad" }, h("h2", null, "Cobranças em atraso"), atrasadas.length ? h("ul", { class: "fin-list" }, atrasadas.map(linha)) : h("p", { class: "muted-line" }, "Nenhuma cobrança atrasada.")),
    h("div", { class: "panel-pad" }, h("h2", null, "Vencem nos próximos 10 dias"), proximas.length ? h("ul", { class: "fin-list" }, proximas.map(linha)) : h("p", { class: "muted-line" }, "Nada vencendo nos próximos dias.")),
    h("div", { class: "panel-pad" }, h("h2", null, "Despesas do mês por categoria"), totalD ? h("ul", { class: "cat-bars" }, Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
      h("li", null, h("span", null, CATEG_DESPESA[k] || k), h("span", { class: "bar" }, h("i", { style: `width:${Math.max(2, Math.round(v / totalD * 100))}%` })), h("span", { class: "num" }, Fmt.money(v))))) : h("p", { class: "muted-line" }, "Nenhuma despesa lançada neste mês.")));
}
function botaoPagar(l) {
  if (l.cancelado) return null;
  const rot = l.tipo === "receita" ? "Recebido" : "Pago";
  return l.pagamento
    ? h("button", { class: "btn btn-ghost btn-xs", type: "button", title: "Desfazer", disabled: !canWrite(), onclick: async () => { try { await Store.patch("financeiro", l.id, { pagamento: null }); } catch (x) { toast(Store.message(x), "bad"); } } }, "Desfazer")
    : h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: async () => { try { await Store.patch("financeiro", l.id, { pagamento: Fmt.todayISO() }); toast(`Marcado como ${rot.toLowerCase()} hoje.`); } catch (x) { toast(Store.message(x), "bad"); } } }, `Marcar ${rot.toLowerCase()}`);
}
function tabelaLanc(ls, tipo) {
  const hoje = Fmt.todayISO();
  ls = ls.slice().sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  if (!ls.length) return h("div", { class: "empty" }, h("p", null, tipo === "receita" ? "Nenhuma cobrança neste mês." : "Nenhuma despesa neste mês."),
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openLancForm(null, tipo) }, tipo === "receita" ? "Nova receita" : "Nova despesa"));
  const cats = tipo === "receita" ? CATEG_RECEITA : CATEG_DESPESA;
  const t = totaisFin(ls, hoje);
  return h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", null, h("tr", null, h("th", null, "Descrição"), h("th", null, "Categoria"), h("th", null, "Vencimento"), h("th", { class: "num" }, "Valor"), h("th", null, "Situação"), h("th", null, ""))),
    h("tbody", null, ls.map(l => { const s = situacao(l, hoje); return h("tr", { class: s === "cancelado" ? "muted" : null },
      h("td", { style: "white-space:normal" }, h("div", { class: "name" }, l.descricao || "Sem descrição"), h("div", { class: "sub" }, [l.clienteId ? nomeCliente(l.clienteId) : null, l.forma ? FORMAS_PAG[l.forma] : null, l.pagamento ? `${tipo === "receita" ? "recebido" : "pago"} em ${Fmt.date(l.pagamento)}` : null].filter(Boolean).join(" · "))),
      h("td", null, cats[l.categoria] || "—"), h("td", null, Fmt.date(l.vencimento)), h("td", { class: "num" }, Fmt.money(l.valorCentavos)),
      h("td", null, h("span", { class: "pill sit-" + s }, SITUACAO[s])),
      h("td", null, h("div", { class: "row-actions" }, botaoPagar(l), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => openLancForm(l, tipo) }, "Editar")))); })),
    h("tfoot", null, h("tr", null, h("td", { colspan: 3 }, `Total (${t.n})`), h("td", { class: "num" }, Fmt.money(t.previsto)), h("td", { colspan: 2 }, `${Fmt.money(t.pago)} ${tipo === "receita" ? "recebido" : "pago"}`)))));
}
function openLancForm(l, tipo) {
  const v = l || { tipo, vencimento: Fmt.todayISO(), categoria: tipo === "receita" ? "mensalidade" : null };
  gavetaForm({
    title: l ? (tipo === "receita" ? "Editar receita" : "Editar despesa") : (tipo === "receita" ? "Nova receita" : "Nova despesa"), values: v,
    spec: [
      { k: "descricao", l: "Descrição", req: true, max: 160 },
      tipo === "receita" ? { k: "clienteId", l: "Cliente", type: "select", blank: "Nenhum", opts: () => clientesOrdenados().map(c => [c.id, c.nome]) } : null,
      { row: [{ k: "valorCentavos", l: "Valor", type: "money", req: true }, { k: "categoria", l: "Categoria", type: "select", blank: "Sem categoria", opts: tipo === "receita" ? CATEG_RECEITA : CATEG_DESPESA }] },
      { row: [{ k: "vencimento", l: "Vencimento", type: "date", req: true }, { k: "pagamento", l: tipo === "receita" ? "Recebido em" : "Pago em", type: "date", help: "Deixe vazio enquanto não for pago." }] },
      { row: [{ k: "forma", l: "Forma de pagamento", type: "select", blank: "Não informada", opts: FORMAS_PAG }, { k: "competencia", l: "Mês de referência", type: "select", opts: () => Fmt.compsUntil(addMes(Fmt.currentComp(), 6), 24).reverse().map(c => [c, Fmt.month(c)]), def: v.vencimento ? v.vencimento.slice(0, 7) : UI.finMes }] },
      { k: "cancelado", l: "Cancelado (não entra nos totais)", type: "bool" },
      { k: "observacoes", l: "Observações", type: "textarea", rows: 3, max: 2000 },
    ].filter(Boolean),
    validate: d => (d.valorCentavos != null && d.valorCentavos <= 0 ? { valorCentavos: "O valor precisa ser maior que zero." } : null),
    onDelete: l ? () => excluirDoc("financeiro", l, "este lançamento") : null,
    onSave: async d => {
      const data = { ...d, tipo, schema: Domain.SCHEMA };
      if (l) await Store.patch("financeiro", l.id, data);
      else { await Store.put("financeiro", Domain.novoId(d.descricao), { origem: "manual", clienteId: null, ...data }); UI.finMes = d.competencia; UI.finTab = tipo === "receita" ? "receitas" : "despesas"; }
      return "Lançamento salvo.";
    },
  });
}

/* ---------- despesas fixas ---------- */
function painelFixas(rec) {
  const ativos = rec.filter(r => r.ativa), total = ativos.reduce((s, r) => s + (r.valorCentavos || 0), 0);
  return h("div", null,
    h("div", { class: "tab-bar" }, h("p", null, `Despesas que se repetem todo mês. Somam ${Fmt.money(total)} por mês. Elas entram no mês quando você clica em “Gerar agora”.`),
      h("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !canWrite(), onclick: () => openFixaForm(null) }, "Nova despesa fixa")),
    rec.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, h("th", null, "Descrição"), h("th", null, "Categoria"), h("th", null, "Dia"), h("th", { class: "num" }, "Valor"), h("th", null, "Situação"), h("th", null, ""))),
      h("tbody", null, rec.slice().sort((a, b) => (a.dia || 0) - (b.dia || 0)).map(r => h("tr", { class: r.ativa ? null : "muted" },
        h("td", null, r.descricao), h("td", null, CATEG_DESPESA[r.categoria] || "—"), h("td", null, r.dia ? `Dia ${r.dia}` : "—"), h("td", { class: "num" }, Fmt.money(r.valorCentavos)),
        h("td", null, h("span", { class: "pill " + (r.ativa ? "ativo" : "encerrado") }, r.ativa ? "Ativa" : "Pausada")),
        h("td", null, h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => openFixaForm(r) }, "Editar"))))))) : h("div", { class: "empty" }, h("p", null, "Nenhuma despesa fixa cadastrada. Ex.: Canva, contador, internet.")));
}
function openFixaForm(r) {
  gavetaForm({
    title: r ? "Editar despesa fixa" : "Nova despesa fixa", values: r || { ativa: true, dia: 10 },
    spec: [{ k: "descricao", l: "Descrição", req: true, max: 120 },
      { row: [{ k: "valorCentavos", l: "Valor mensal", type: "money", req: true }, { k: "dia", l: "Dia do vencimento", type: "int", req: true }] },
      { row: [{ k: "categoria", l: "Categoria", type: "select", blank: "Sem categoria", opts: CATEG_DESPESA }, { k: "forma", l: "Forma de pagamento", type: "select", blank: "Não informada", opts: FORMAS_PAG }] },
      { k: "ativa", l: "Ativa (entra nos próximos meses)", type: "bool" }],
    validate: d => (d.dia != null && (d.dia < 1 || d.dia > 31) ? { dia: "Use um dia entre 1 e 31." } : d.valorCentavos != null && d.valorCentavos <= 0 ? { valorCentavos: "O valor precisa ser maior que zero." } : null),
    onDelete: r ? () => excluirDoc("recorrencias", r, "esta despesa fixa") : null,
    onSave: async d => { if (r) await Store.patch("recorrencias", r.id, d); else await Store.put("recorrencias", Domain.novoId(d.descricao), { ...d, schema: Domain.SCHEMA }); return "Despesa fixa salva."; },
  });
}

/* ---------- reserva ---------- */
function painelReserva(res) {
  const total = res.reduce((s, r) => s + (r.atualCentavos || 0), 0);
  return h("div", null,
    h("div", { class: "tab-bar" }, h("p", null, `Dinheiro separado por finalidade. Total guardado: ${Fmt.money(total)}.`),
      h("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !canWrite(), onclick: () => openReservaForm(null) }, "Nova finalidade")),
    res.length ? h("div", { class: "res-grid" }, res.slice().sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)).map(r => {
      const pct = r.metaCentavos ? Math.min(100, Math.round((r.atualCentavos || 0) / r.metaCentavos * 100)) : null;
      return h("button", { class: "res-card", type: "button", onclick: () => openReservaForm(r) },
        h("span", { class: "res-t" }, r.finalidade), h("span", { class: "res-v" }, Fmt.money(r.atualCentavos ?? null)),
        h("span", { class: "bar" }, h("i", { style: `width:${pct ?? 0}%` })),
        h("span", { class: "sub" }, r.metaCentavos ? `${pct}% de ${Fmt.money(r.metaCentavos)} · faltam ${Fmt.money(Math.max(0, r.metaCentavos - (r.atualCentavos || 0)))}` : "Sem meta definida"),
        r.mensalCentavos ? h("span", { class: "sub" }, `Separar ${Fmt.money(r.mensalCentavos)} por mês`) : null);
    })) : h("div", { class: "empty" }, h("p", null, "Nenhuma finalidade cadastrada.")));
}
function openReservaForm(r) {
  gavetaForm({
    title: r ? `Reserva · ${r.finalidade}` : "Nova finalidade de reserva", values: r || {},
    spec: [{ k: "finalidade", l: "Finalidade", req: true, max: 80 },
      { row: [{ k: "atualCentavos", l: "Valor guardado hoje", type: "money" }, { k: "metaCentavos", l: "Meta", type: "money" }] },
      { k: "mensalCentavos", l: "Quanto separar por mês", type: "money" }, { k: "observacoes", l: "Observações", type: "textarea", rows: 3 }],
    onDelete: r ? () => excluirDoc("reservas", r, "esta finalidade") : null,
    onSave: async d => { if (r) await Store.patch("reservas", r.id, d); else await Store.put("reservas", Domain.novoId(d.finalidade), { ...d, schema: Domain.SCHEMA }); return "Reserva salva."; },
  });
}

/* ---------- fluxo de caixa ---------- */
function painelFluxo(fin, comp) {
  const hoje = Fmt.todayISO(), atual = Fmt.currentComp();
  const meses = Fmt.compsUntil(addMes(comp, 2), 9);
  let acum = 0;
  const linhas = meses.map(m => {
    // meses passados e o atual: o que foi pago no mês (pela data de pagamento); meses futuros: o previsto pelo vencimento
    const futuro = m > atual;
    const sel = l => !l.cancelado && (futuro ? !l.pagamento && (l.vencimento || "").startsWith(m) : (l.pagamento || "").startsWith(m));
    const ent = fin.filter(l => l.tipo === "receita" && sel(l)).reduce((s, l) => s + (l.valorCentavos || 0), 0);
    const sai = fin.filter(l => l.tipo === "despesa" && sel(l)).reduce((s, l) => s + (l.valorCentavos || 0), 0);
    acum += ent - sai;
    return { m, futuro, ent, sai, saldo: ent - sai, acum };
  });
  const max = Math.max(1, ...linhas.map(x => Math.max(x.ent, x.sai)));
  return h("div", { class: "panel-pad", style: "display:flex;flex-direction:column;gap:16px" },
    h("p", { class: "lead", style: "margin:0" }, "Meses passados e o atual mostram o que entrou e saiu de fato (pela data de pagamento). Meses futuros mostram o previsto pelos vencimentos em aberto."),
    h("div", { class: "fluxo", role: "img", "aria-label": "Entradas e saídas por mês" }, linhas.map(x => h("div", { class: "fluxo-col" + (x.futuro ? " fut" : "") + (x.m === comp ? " sel" : "") },
      h("div", { class: "fluxo-bars" }, h("i", { class: "e", style: `height:${Math.round(x.ent / max * 100)}%`, title: `Entradas ${Fmt.money(x.ent)}` }), h("i", { class: "s", style: `height:${Math.round(x.sai / max * 100)}%`, title: `Saídas ${Fmt.money(x.sai)}` })),
      h("span", null, Fmt.monthTiny(x.m))))),
    h("div", { class: "ec-legend" }, h("span", { class: "lg-e" }, h("i"), "Entradas"), h("span", { class: "lg-s" }, h("i"), "Saídas"), h("span", null, "Barras claras: previsto")),
    h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", null, h("tr", null, ["Mês", "Entradas", "Saídas", "Saldo do mês", "Acumulado no período"].map((t, i) => h("th", { class: i ? "num" : null }, t)))),
      h("tbody", null, linhas.map(x => h("tr", null, h("td", null, Fmt.month(x.m) + (x.futuro ? " (previsto)" : "")), h("td", { class: "num" }, Fmt.money(x.ent)), h("td", { class: "num" }, Fmt.money(x.sai)),
        h("td", { class: "num " + (x.saldo < 0 ? "neg" : "") }, Fmt.money(x.saldo)), h("td", { class: "num " + (x.acum < 0 ? "neg" : "") }, Fmt.money(x.acum))))))));
}
