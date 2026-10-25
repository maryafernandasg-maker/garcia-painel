"use strict";
/* =====================================================================
   COMERCIAL — CRM de oportunidades (prospecção até fechamento)
   Coleção: leads
   ===================================================================== */
const ETAPAS_LEAD = [["prospeccao", "Prospecção"], ["contato", "Contato"], ["qualificado", "Qualificado"], ["reuniao", "Reunião"], ["proposta", "Proposta"], ["followup", "Follow-up"], ["fechado", "Fechado"], ["perdido", "Perdido"]];
const ETAPA_LEAD = Object.fromEntries(ETAPAS_LEAD);
const ORIGENS_LEAD = { instagram: "Instagram", indicacao: "Indicação", whatsapp: "WhatsApp", prospeccao: "Prospecção ativa", google: "Google", outro: "Outro" };
const SERVICOS_LEAD = { social: "Social media", trafego: "Tráfego pago", ambos: "Social + Tráfego", outro: "Outro" };
UI.leadBusca = "";
UI.leadVer = "abertos";

function viewComercial() {
  const all = AG("leads");
  const top = head("Agência", "Comercial", "Cada oportunidade é um cartão. Arraste entre as etapas ou use as setas.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openLeadForm(null) }, "Nova oportunidade"));
  if (all == null || Store.state.clientes == null) return [top, loadingPanel()];
  const hoje = Fmt.todayISO();
  const abertos = all.filter(l => !["fechado", "perdido"].includes(l.status));
  const fechados = all.filter(l => l.status === "fechado");
  const fups = abertos.filter(l => l.proximoFollowup && l.proximoFollowup <= hoje);
  const kpis = h("div", { class: "kpis-row" },
    kpiCard("Em aberto", Fmt.money(abertos.reduce((s, l) => s + (l.valorPropostaCentavos || 0), 0)), `${abertos.length} ${abertos.length === 1 ? "oportunidade" : "oportunidades"}`),
    kpiCard("Reuniões", Fmt.integer(all.filter(l => l.status === "reuniao").length), "na etapa Reunião"),
    kpiCard("Propostas", Fmt.integer(all.filter(l => l.status === "proposta").length), "na etapa Proposta"),
    kpiCard("Clientes fechados", Fmt.integer(fechados.length)),
    kpiCard("Valor mensal vendido", Fmt.money(fechados.reduce((s, l) => s + (l.valorMensalCentavos || 0), 0)), "soma dos fechados"),
    kpiCard("Follow-ups para hoje", Fmt.integer(fups.length), fups.length ? "incluindo atrasados" : "nenhum pendente", fups.length ? "bad" : null));
  const q = Domain.norm(UI.leadBusca);
  let itens = all.filter(l => !q || Domain.norm([l.empresa, l.responsavel, l.nicho, l.cidade].join(" ")).includes(q));
  const colunas = UI.leadVer === "todos" ? ETAPAS_LEAD : ETAPAS_LEAD.filter(([k]) => !["fechado", "perdido"].includes(k));
  const busca = h("input", { class: "search", id: "leadBusca", type: "search", placeholder: "Buscar empresa, nicho ou cidade", value: UI.leadBusca, "aria-label": "Buscar oportunidade",
    oninput: e => { UI.leadBusca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("leadBusca"); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } });
  return [top, kpis,
    h("div", { class: "panel" }, h("div", { class: "toolbar" }, segFiltro("Mostrar", [["abertos", "Em andamento"], ["todos", "Com fechados e perdidos"]], UI.leadVer, k => { UI.leadVer = k; render(); }), busca)),
    all.length ? quadro({ colunas, itens, vazio: "Nenhuma oportunidade.", onOpen: openLead,
      onMove: async (l, st) => { try { await Store.patch("leads", l.id, { status: st, ...(st === "fechado" && !l.fechamento ? { fechamento: Fmt.todayISO() } : {}) }); } catch (x) { toast(Store.message(x), "bad"); } },
      card: l => [
        h("div", { class: "bcard-t" }, l.empresa || "Sem nome"),
        h("div", { class: "bcard-m" }, [l.responsavel, SERVICOS_LEAD[l.servico]].filter(Boolean).join(" · ")),
        h("div", { class: "bcard-m" }, [l.valorPropostaCentavos != null ? Fmt.money(l.valorPropostaCentavos) : null,
          l.proximoFollowup ? h("span", { class: l.proximoFollowup <= hoje && !["fechado", "perdido"].includes(l.status) ? "late" : null }, `Follow-up ${dataCurta(l.proximoFollowup)}`) : null].filter(Boolean).flatMap((x, i) => i ? [" · ", x] : [x])),
      ] }) : emptyPanel("Nenhuma oportunidade ainda", "Cadastre um lead para acompanhar do primeiro contato ao fechamento.", h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openLeadForm(null) }, "Nova oportunidade"))];
}
function openLead(l0) {
  const l = (AG("leads") || []).find(x => x.id === l0.id) || l0;
  const link = (u, t) => u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, t || u) : null;
  const wpp = l.whatsapp ? `https://wa.me/${String(l.whatsapp).replace(/\D/g, "").replace(/^(?!55)/, "55")}` : null;
  const texto = [["Necessidade ou problema", l.necessidade], ["O que foi conversado", l.conversado], ["Objeções", l.objecoes], ["Próximo passo", l.proximoPasso], ["Observações", l.observacoes]]
    .filter(([, t]) => t).map(([k, t]) => `### ${k}\n\n${t}`).join("\n\n");
  gavetaLeitura({
    eyebrow: `Comercial · ${ETAPA_LEAD[l.status] || ""}`, title: l.empresa || "Oportunidade",
    facts: [["Responsável", l.responsavel], ["Nicho", l.nicho], ["Cidade", l.cidade], ["Origem", ORIGENS_LEAD[l.origem]], ["Serviço de interesse", SERVICOS_LEAD[l.servico]],
      ["Valor da proposta", l.valorPropostaCentavos != null ? Fmt.money(l.valorPropostaCentavos) : null], ["Valor mensal", l.valorMensalCentavos != null ? Fmt.money(l.valorMensalCentavos) : null],
      ["Primeiro contato", l.primeiroContato && Fmt.date(l.primeiroContato)], ["Reunião", l.reuniao && Fmt.date(l.reuniao)], ["Próximo follow-up", l.proximoFollowup && Fmt.date(l.proximoFollowup)],
      ["Fechamento", l.fechamento && Fmt.date(l.fechamento)], ["Instagram", link(l.instagram, "Abrir perfil")], ["WhatsApp", wpp ? link(wpp, l.whatsapp) : null],
      ["Cliente", l.clienteId ? nomeCliente(l.clienteId) : null]],
    conteudo: texto || null,
    actions: close => [
      h("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !canWrite(), onclick: () => { close(); openLeadForm(l); } }, "Editar"),
      l.status === "fechado" && !l.clienteId ? h("button", { class: "btn btn-sm", type: "button", disabled: !canWrite(), onclick: async () => { close(); await virarCliente(l); } }, "Cadastrar como cliente") : null,
    ],
  });
}
async function virarCliente(l) {
  const existentes = Store.state.clientes || [];
  if (existentes.some(c => Domain.norm(c.nome) === Domain.norm(l.empresa))) { toast("Já existe um cliente com esse nome. Ligue manualmente pelo cadastro.", "bad"); return; }
  const res = Domain.validateCliente({ nome: l.empresa, cidade: l.cidade || "", segmento: l.nicho || "", status: "ativo", contatoNome: l.responsavel || "", telefone: l.whatsapp || "",
    instagram: (l.instagram || "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, ""), mensalidade: Fmt.moneyInput(l.valorMensalCentavos),
    servicos: l.servico === "ambos" ? ["social", "trafego"] : ["social", "trafego"].includes(l.servico) ? [l.servico] : [], inicioGestao: l.inicio && l.inicio <= Fmt.todayISO() ? l.inicio : "" }, existentes);
  if (!res.ok) { toast("Confira os dados da oportunidade (nome, telefone ou Instagram) antes de cadastrar.", "bad"); return; }
  try {
    const id = Domain.novoId(res.data.nome);
    await Store.put("clientes", id, res.data);
    await Store.patch("leads", l.id, { clienteId: id });
    toast(`${res.data.nome} cadastrado em Clientes. Complete o vencimento no cadastro.`);
  } catch (x) { toast(Store.message(x), "bad"); }
}
function openLeadForm(l) {
  gavetaForm({
    title: l ? "Editar oportunidade" : "Nova oportunidade", values: l || { status: "prospeccao", primeiroContato: Fmt.todayISO() },
    spec: [
      { k: "empresa", l: "Empresa", req: true, max: 120 },
      { row: [{ k: "responsavel", l: "Responsável", max: 80 }, { k: "nicho", l: "Nicho", max: 80 }] },
      { row: [{ k: "cidade", l: "Cidade", max: 80 }, { k: "whatsapp", l: "WhatsApp", max: 30 }] },
      { k: "instagram", l: "Instagram (link)", type: "url" },
      { row: [{ k: "status", l: "Etapa", type: "select", opts: ETAPAS_LEAD }, { k: "origem", l: "Origem", type: "select", blank: "Não informada", opts: ORIGENS_LEAD }] },
      { row: [{ k: "servico", l: "Serviço de interesse", type: "select", blank: "Não definido", opts: SERVICOS_LEAD }, { k: "valorPropostaCentavos", l: "Valor da proposta", type: "money" }] },
      { k: "valorMensalCentavos", l: "Valor mensal fechado", type: "money", help: "Preencha quando fechar. Entra no “Valor mensal vendido”." },
      { section: "Datas" },
      { row: [{ k: "primeiroContato", l: "Primeiro contato", type: "date" }, { k: "reuniao", l: "Reunião", type: "date" }] },
      { row: [{ k: "proximoFollowup", l: "Próximo follow-up", type: "date" }, { k: "fechamento", l: "Fechamento", type: "date" }] },
      { k: "inicio", l: "Início do serviço", type: "date" },
      { section: "Conversa" },
      { k: "necessidade", l: "Necessidade ou problema identificado", type: "textarea", rows: 3 },
      { k: "conversado", l: "O que foi conversado", type: "textarea", rows: 4 },
      { k: "objecoes", l: "Objeções", type: "textarea", rows: 2 },
      { k: "proximoPasso", l: "Próximo passo", type: "textarea", rows: 2 },
    ],
    onDelete: l ? () => excluirDoc("leads", l, "esta oportunidade") : null,
    onSave: async d => { if (l) await Store.patch("leads", l.id, d); else await Store.put("leads", Domain.novoId(d.empresa), { ...d, schema: Domain.SCHEMA }); return "Oportunidade salva."; },
  });
}
