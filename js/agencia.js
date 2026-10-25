"use strict";
/* =====================================================================
   AGÊNCIA — login, Início (painel do dia) e tarefas
   ===================================================================== */
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const AG = col => (Store.state.ag && Store.state.ag[col]) || null;

/* ---------- login ---------- */
function renderAuth(st) {
  const root = document.getElementById("auth");
  if (st === "connecting") { root.replaceChildren(h("div", { class: "auth-card" }, h("p", { class: "lead" }, "Carregando…"))); return; }
  if (st === "config") {
    root.replaceChildren(h("div", { class: "auth-card" }, h("div", { class: "auth-brand" }, "Garcia Marketing"),
      h("h1", null, "Falta configurar o banco"),
      h("p", { class: "lead" }, "Preencha o endereço do projeto e a chave pública do Supabase no arquivo js/config.js e publique de novo.")));
    return;
  }
  const err = h("p", { class: "err-text", role: "alert", hidden: true });
  const btn = h("button", { class: "btn btn-primary", type: "submit" }, "Entrar");
  const form = h("form", { class: "auth-form", novalidate: true },
    h("div", { class: "field" }, h("label", { for: "lgEmail" }, "E-mail"), h("input", { id: "lgEmail", type: "email", autocomplete: "username", required: true })),
    h("div", { class: "field" }, h("label", { for: "lgSenha" }, "Senha"), h("input", { id: "lgSenha", type: "password", autocomplete: "current-password", required: true })),
    err, btn);
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.hidden = true;
    const email = form.querySelector("#lgEmail").value.trim(), senha = form.querySelector("#lgSenha").value;
    if (!email || !senha) { err.hidden = false; err.textContent = "Informe o e-mail e a senha."; return; }
    btn.disabled = true; btn.textContent = "Entrando…";
    try { await Store.login(email, senha); }
    catch (x) { err.hidden = false; err.textContent = /invalid|credentials/i.test(String(x && x.message)) ? "E-mail ou senha incorretos." : Store.message(x); btn.disabled = false; btn.textContent = "Entrar"; }
  });
  root.replaceChildren(h("div", { class: "auth-wrap" },
    h("div", { class: "auth-side" }, h("div", { class: "auth-brand" }, "Garcia Marketing"), h("p", null, "Painel da agência: clientes, tráfego, social media e financeiro em um só lugar.")),
    h("div", { class: "auth-card" }, h("div", { class: "eyebrow" }, "Acesso restrito"), h("h1", null, "Entrar no painel"), form)));
  setTimeout(() => document.getElementById("lgEmail")?.focus(), 0);
}
function renderUser() {
  const el = document.getElementById("userBox");
  if (!el) return;
  el.replaceChildren(h("span", { class: "user-mail", title: Store.state.user?.email || "" }, Store.state.user?.email || ""),
    h("button", { class: "btn btn-ghost btn-sm side-btn", type: "button", onclick: () => Store.logout() }, "Sair"));
}

/* ---------- Início ---------- */
function saudacao() { const hr = new Date().getHours(); return hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"; }
function nomeUsuario() { return (window.GARCIA_CONFIG && window.GARCIA_CONFIG.nome) || (Store.state.user?.email || "").split("@")[0]; }
const hojeISO = () => Fmt.todayISO();

function viewInicio() {
  const clientes = Store.state.clientes;
  const tarefas = AG("tarefas");
  if (clientes == null || tarefas == null) return [head("Início", `${saudacao()}, ${nomeUsuario()}`), loadingPanel()];
  const hoje = hojeISO(), d = new Date();
  const ativos = clientes.filter(c => (c.status || "ativo") === "ativo" && !c.interno);
  const porServ = k => ativos.filter(c => (c.servicos || []).includes(k)).length;
  const recorrente = ativos.reduce((s, c) => s + (c.mensalidadeCentavos || 0), 0);
  const semValor = ativos.filter(c => c.mensalidadeCentavos == null).length;
  const abertas = tarefas.filter(t => !t.feita);
  const atrasadas = abertas.filter(t => t.data && t.data < hoje);
  const deHoje = abertas.filter(t => t.data === hoje);
  // vencimentos dos próximos 10 dias
  const venc = ativos.filter(c => c.diaVencimento).map(c => {
    let dt = new Date(d.getFullYear(), d.getMonth(), Math.min(c.diaVencimento, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    if (dt < new Date(d.getFullYear(), d.getMonth(), d.getDate())) dt = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(c.diaVencimento, new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate()));
    return { c, dt, dias: Math.round((dt - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000) };
  }).filter(x => x.dias <= 10).sort((a, b) => a.dias - b.dias);
  // tráfego do mês anterior (o mês a relatar)
  const compRel = Fmt.previousComp(Fmt.currentComp());
  const rels = AG("relatorios") || [];
  const trafego = ativos.filter(c => (c.servicos || []).includes("trafego") || rels.some(r => r.clienteId === c.id));
  // social media: posts dos próximos 7 dias e em revisão
  const posts = AG("posts") || [];
  const semana = posts.filter(p => p.data && p.data >= hoje && p.data <= addDias(hoje, 6) && p.status !== "publicado").sort(ordemPost);
  const atrasadosPost = posts.filter(p => p.data && p.data < hoje && !["publicado"].includes(p.status));
  const emRevisao = posts.filter(p => p.status === "revisao").length;
  // financeiro do mês
  const fin = AG("financeiro") || [], compAtual = Fmt.currentComp();
  const R = totaisFin(fin.filter(l => l.tipo === "receita" && l.competencia === compAtual), hoje);
  const atrasoTotal = fin.filter(l => l.tipo === "receita" && situacao(l, hoje) === "atrasado").reduce((s2, l) => s2 + (l.valorCentavos || 0), 0);
  const fups = (AG("leads") || []).filter(l => l.proximoFollowup && l.proximoFollowup <= hoje && !["fechado", "perdido"].includes(l.status));

  const sub = `Hoje é ${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${Fmt.MESES[d.getMonth()]}. ${deHoje.length ? `${deHoje.length} ${deHoje.length === 1 ? "tarefa" : "tarefas"} para hoje` : "Nenhuma tarefa marcada para hoje"}${atrasadas.length ? ` e ${atrasadas.length} ${atrasadas.length === 1 ? "atrasada" : "atrasadas"}` : ""}.`;
  const hero = h("div", { class: "home-head" },
    h("div", null, h("div", { class: "eyebrow" }, "Agência · Início"), h("h1", { class: "hello" }, `${saudacao()}, ${nomeUsuario()}`), h("p", { class: "lead" }, sub)),
    h("button", { class: "btn btn-primary", type: "button", onclick: () => openTarefaForm(null) }, "Nova tarefa"));

  const cardClientes = h("div", { class: "hcard accent" },
    h("div", { class: "hcard-k" }, "Clientes ativos"),
    h("div", { class: "hcard-v" }, Fmt.integer(ativos.length)),
    h("div", { class: "hcard-sub" }, `${porServ("trafego")} em tráfego · ${porServ("social")} em social media`),
    h("button", { class: "hcard-link", type: "button", onclick: () => go("clientes") }, "Ver clientes"));
  const cardReceita = h("div", { class: "hcard dark" },
    h("div", { class: "hcard-k" }, "Receita recorrente mensal"),
    h("div", { class: "hcard-v" }, Fmt.money(recorrente)),
    h("div", { class: "hcard-sub" }, semValor ? `${semValor} ${semValor === 1 ? "cliente ativo sem mensalidade cadastrada" : "clientes ativos sem mensalidade cadastrada"}` : "Soma das mensalidades dos clientes ativos"),
    venc.length ? h("ul", { class: "hcard-list" }, venc.slice(0, 4).map(x => h("li", null, h("span", null, x.c.nome), h("span", null, `${x.dias === 0 ? "hoje" : x.dias === 1 ? "amanhã" : `em ${x.dias} dias`} · ${Fmt.money(x.c.mensalidadeCentavos)}`)))) : h("div", { class: "hcard-sub" }, "Nenhum vencimento nos próximos 10 dias."));

  const fluxo = h("div", { class: "panel panel-pad" },
    h("div", { class: "chart-head" }, h("h2", null, `Tráfego · relatórios de ${Fmt.month(compRel)}`), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => go("relatorios") }, "Abrir relatórios")),
    trafego.length ? h("ul", { class: "flow" }, trafego.map(c => {
      const r = rels.find(x => x.clienteId === c.id && x.competencia === compRel);
      const passos = [["Dados lançados", !!(r && r.resumo && r.resumo.investimentoCentavos != null)], ["PDF gerado", !!(r && r.ultimoPdfEm)]];
      return h("li", null, h("button", { class: "flow-name", type: "button", onclick: () => { UI.clienteId = c.id; Prefs.set("cliente", c.id); UI.comp = compRel; Prefs.set("comp", compRel); go(r ? "relatorios" : "lancamentos"); } }, c.nome),
        h("div", { class: "flow-steps" }, passos.map(([l, okk]) => h("span", { class: "step " + (okk ? "ok" : "") }, h("span", { class: "dotc", "aria-hidden": "true" }), l))));
    })) : h("p", { class: "muted-line" }, "Nenhum cliente ativo de tráfego. Marque o serviço “Tráfego pago” no cadastro do cliente."));

  const cardSocial = h("div", { class: "hcard light" },
    h("div", { class: "hcard-k" }, "Social media · próximos 7 dias"),
    h("div", { class: "hcard-v" }, Fmt.integer(semana.length)),
    h("div", { class: "hcard-sub" }, [`${emRevisao} em revisão`, atrasadosPost.length ? `${atrasadosPost.length} com data passada sem publicar` : null].filter(Boolean).join(" · ")),
    h("button", { class: "hcard-link", type: "button", onclick: () => go("social") }, "Abrir calendário"));
  const cardFin = h("div", { class: "hcard light" },
    h("div", { class: "hcard-k" }, `Financeiro · ${Fmt.MESES[d.getMonth()]}`),
    h("div", { class: "hcard-v" }, Fmt.money(R.pago)),
    h("div", { class: "hcard-sub" }, R.n ? `recebido de ${Fmt.money(R.previsto)} · ${Fmt.money(R.aberto)} em aberto` : "Nenhuma cobrança lançada neste mês."),
    atrasoTotal ? h("div", { class: "hcard-sub late" }, `${Fmt.money(atrasoTotal)} em cobranças atrasadas`) : null,
    h("button", { class: "hcard-link", type: "button", onclick: () => go("financeiro") }, "Abrir financeiro"));
  const semanaPanel = h("div", { class: "panel panel-pad" },
    h("div", { class: "chart-head" }, h("h2", null, "Publicações da semana"), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => go("producao") }, "Abrir produção")),
    semana.length ? h("ul", { class: "week-posts" }, semana.map(p => h("li", null,
      h("span", { class: "wp-d" }, `${DIAS_SEMANA[new Date(p.data + "T12:00").getDay()].slice(0, 3)} ${dataCurta(p.data)}`),
      h("button", { class: "linkbtn", type: "button", onclick: () => openPost(p) }, p.titulo || p.tema || "Sem título"),
      h("span", { class: "sub" }, [nomeCliente(p.clienteId), FORMATOS_POST[p.formato]].filter(Boolean).join(" · ")),
      h("span", { class: "pill sm st-" + p.status }, ETAPA_NOME[p.status])))) : h("p", { class: "muted-line" }, "Nenhum post com data para os próximos 7 dias."));
  const fupPanel = fups.length ? h("div", { class: "panel panel-pad" }, h("div", { class: "chart-head" }, h("h2", null, "Follow-ups comerciais"), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => go("comercial") }, "Abrir")),
    h("ul", { class: "tasks compact" }, fups.map(l => h("li", { class: "task" + (l.proximoFollowup < hoje ? " late" : "") }, h("button", { class: "linkbtn", type: "button", onclick: () => openLead(l) }, l.empresa),
      h("span", { class: "task-m" }, l.proximoFollowup < hoje ? `Atrasado · ${Fmt.date(l.proximoFollowup)}` : "Hoje"))))) : null;

  return [hero, h("div", { class: "home-grid" },
    h("div", { class: "home-main" }, h("div", { class: "hcards" }, cardClientes, cardReceita, cardSocial, cardFin), tarefasPanel(tarefas, clientes), semanaPanel, fluxo),
    h("div", { class: "home-side" }, miniCalendario(tarefas, ativos, posts), fupPanel, proximasPanel(abertas, clientes)))];
}

/* ---------- mini calendário ---------- */
function miniCalendario(tarefas, ativos, posts) {
  const hoje = hojeISO();
  const mes = UI.homeMes || hoje.slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(), first = new Date(y, m - 1, 1).getDay();
  const comTarefa = new Set(tarefas.filter(t => !t.feita && t.data && t.data.startsWith(mes)).map(t => t.data));
  const comVenc = new Set(ativos.filter(c => c.diaVencimento).map(c => `${mes}-${String(Math.min(c.diaVencimento, last)).padStart(2, "0")}`));
  const comPost = new Set((posts || []).filter(p => p.data && p.data.startsWith(mes)).map(p => p.data));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h("span", { class: "mc-cell empty" }));
  for (let dd = 1; dd <= last; dd++) {
    const ds = `${mes}-${String(dd).padStart(2, "0")}`;
    cells.push(h("button", { type: "button", class: "mc-cell" + (ds === hoje ? " today" : "") + (UI.homeDia === ds ? " sel" : ""),
      "aria-label": `${Fmt.date(ds)}${comTarefa.has(ds) ? ", com tarefas" : ""}${comVenc.has(ds) ? ", com vencimento" : ""}${comPost.has(ds) ? ", com posts" : ""}`,
      onclick: () => { UI.homeDia = UI.homeDia === ds ? null : ds; render(); } }, String(dd),
      h("span", { class: "mc-dots" }, comTarefa.has(ds) ? h("i", { class: "t" }) : null, comVenc.has(ds) ? h("i", { class: "v" }) : null, comPost.has(ds) ? h("i", { class: "p" }) : null)));
  }
  const nav = n => { const dt = new Date(y, m - 1 + n, 1); UI.homeMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; render(); };
  return h("div", { class: "panel panel-pad minical" },
    h("div", { class: "mc-head" }, h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Mês anterior", onclick: () => nav(-1) }, "‹"),
      h("span", { class: "mc-title" }, `${Fmt.MESES[m - 1]} ${y}`), h("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Próximo mês", onclick: () => nav(1) }, "›")),
    h("div", { class: "mc-grid" }, ["D", "S", "T", "Q", "Q", "S", "S"].map(x => h("span", { class: "mc-h" }, x)), cells),
    h("div", { class: "mc-legend" }, h("span", null, h("i", { class: "t" }), "Tarefas"), h("span", null, h("i", { class: "v" }), "Vencimentos"), h("span", null, h("i", { class: "p" }), "Posts")),
    UI.homeDia ? h("div", { class: "mc-note" }, `Mostrando tarefas de ${Fmt.date(UI.homeDia)}. `, h("button", { class: "linkbtn", type: "button", onclick: () => { UI.homeDia = null; render(); } }, "Ver todas"),
      (posts || []).filter(p => p.data === UI.homeDia).length ? h("ul", { class: "mc-posts" }, (posts || []).filter(p => p.data === UI.homeDia).map(p => h("li", null, h("button", { class: "linkbtn", type: "button", onclick: () => openPost(p) }, `${FORMATOS_POST[p.formato] || "Post"}: ${p.titulo || p.tema || "Sem título"}`)))) : null) : null);
}

/* ---------- tarefas ---------- */
const AREAS = { geral: "Geral", trafego: "Tráfego", social: "Social media", financeiro: "Financeiro", comercial: "Comercial" };
function tarefaItem(t, clientes) {
  const cli = t.clienteId && clientes.find(c => c.id === t.clienteId);
  const hoje = hojeISO();
  const quando = !t.data ? "Sem data" : t.data === hoje ? "Hoje" : t.data < hoje && !t.feita ? `Atrasada · ${Fmt.date(t.data)}` : Fmt.date(t.data);
  return h("li", { class: "task" + (t.feita ? " done" : "") + (t.data && t.data < hoje && !t.feita ? " late" : "") },
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!t.feita, "aria-label": `Concluir ${t.titulo}`,
      onchange: async e => { try { await Store.patch("tarefas", t.id, { feita: e.target.checked }); } catch (x) { toast(Store.message(x), "bad"); } } }),
      h("span", null, h("span", { class: "task-t" }, t.titulo), h("span", { class: "task-m" }, [quando, AREAS[t.area] && t.area !== "geral" ? AREAS[t.area] : null, cli ? cli.nome : null].filter(Boolean).join(" · ")))),
    h("div", { class: "row-actions" }, h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => openTarefaForm(t) }, "Editar")));
}
function tarefasPanel(tarefas, clientes) {
  const hoje = hojeISO();
  let lista = tarefas.filter(t => !t.feita && (!t.data || t.data <= hoje));
  let titulo = "Para hoje e atrasadas";
  if (UI.homeDia) { lista = tarefas.filter(t => t.data === UI.homeDia); titulo = `Tarefas de ${Fmt.date(UI.homeDia)}`; }
  lista.sort((a, b) => (a.data || "9").localeCompare(b.data || "9"));
  const feitasHoje = tarefas.filter(t => t.feita && t.data === hoje).length;
  return h("div", { class: "panel panel-pad" },
    h("div", { class: "chart-head" }, h("h2", null, titulo), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => openTarefaForm(null, UI.homeDia) }, "Adicionar")),
    lista.length ? h("ul", { class: "tasks" }, lista.map(t => tarefaItem(t, clientes))) : h("p", { class: "muted-line" }, UI.homeDia ? "Nenhuma tarefa neste dia." : "Tudo em dia por aqui."),
    !UI.homeDia && feitasHoje ? h("p", { class: "muted-line" }, `${feitasHoje} ${feitasHoje === 1 ? "tarefa concluída" : "tarefas concluídas"} hoje.`) : null);
}
function proximasPanel(abertas, clientes) {
  const hoje = hojeISO();
  const prox = abertas.filter(t => t.data && t.data > hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
  return h("div", { class: "panel panel-pad" }, h("h2", null, "Próximas tarefas"),
    prox.length ? h("ul", { class: "tasks compact" }, prox.map(t => tarefaItem(t, clientes))) : h("p", { class: "muted-line" }, "Nenhuma tarefa futura."));
}
function openTarefaForm(t, diaPadrao) {
  const clientes = clientesOrdenados();
  const err = h("p", { class: "err-text", hidden: true });
  const titulo = h("input", { id: "tfTitulo", type: "text", maxlength: 160, value: t ? t.titulo : "" });
  const data = h("input", { id: "tfData", type: "date", value: t ? t.data || "" : diaPadrao || hojeISO() });
  const area = h("select", { id: "tfArea" }, Object.entries(AREAS).map(([k, l]) => h("option", { value: k, selected: (t ? t.area : "geral") === k }, l)));
  const cli = h("select", { id: "tfCliente" }, h("option", { value: "" }, "Nenhum"), clientes.map(c => h("option", { value: c.id, selected: t && t.clienteId === c.id }, c.nome)));
  const salvar = h("button", { class: "btn btn-primary", type: "submit" }, "Salvar");
  const form = h("form", { class: "dialog", novalidate: true, "aria-labelledby": "tf-t" },
    h("h2", { id: "tf-t" }, t ? "Editar tarefa" : "Nova tarefa"),
    h("div", { class: "field" }, h("label", { for: "tfTitulo" }, "Tarefa"), titulo),
    h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { for: "tfData" }, "Data"), data), h("div", { class: "field" }, h("label", { for: "tfArea" }, "Área"), area)),
    h("div", { class: "field" }, h("label", { for: "tfCliente" }, "Cliente"), cli),
    err,
    h("div", { class: "actions-row", style: "justify-content:space-between" },
      t ? h("button", { class: "btn btn-ghost danger-link", type: "button", onclick: async () => { try { await Store.remove("tarefas", t.id); close(); toast("Tarefa excluída."); } catch (x) { err.hidden = false; err.textContent = Store.message(x); } } }, "Excluir") : h("span"),
      h("div", { class: "actions-row" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Cancelar"), salvar)));
  const close = openOverlay(form, true);
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.hidden = true;
    const tt = titulo.value.trim().replace(/\s+/g, " ");
    if (tt.length < 2) { err.hidden = false; err.textContent = "Descreva a tarefa."; titulo.focus(); return; }
    if (data.value && !/^\d{4}-\d{2}-\d{2}$/.test(data.value)) { err.hidden = false; err.textContent = "Data inválida."; return; }
    salvar.disabled = true;
    const d = { titulo: tt, data: data.value || null, area: area.value, clienteId: cli.value || null, feita: t ? !!t.feita : false, schema: Domain.SCHEMA };
    try { if (t) await Store.patch("tarefas", t.id, d); else await Store.put("tarefas", Domain.novoId(tt), d); close(); toast(t ? "Tarefa atualizada." : "Tarefa criada."); }
    catch (x) { err.hidden = false; err.textContent = Store.message(x); salvar.disabled = false; }
  });
}
