"use strict";
/* =====================================================================
   SOCIAL MEDIA — calendário editorial, quadro de produção e planejamento do mês
   Coleções: posts, planejamentos
   ===================================================================== */
const FORMATOS_POST = { feed: "Feed", reels: "Reels", stories: "Stories" };
const TIPOS_FEED = { carrossel: "Carrossel", estatico: "Estático" };
const PILARES = { autoridade: "Autoridade", educativo: "Educativo", prova_social: "Prova social", conexao: "Conexão", conversao: "Conversão", institucional: "Institucional" };
const ETAPAS_POST = [["ideia", "Ideias"], ["conteudo", "Conteúdo"], ["producao", "Produção"], ["revisao", "Revisão"], ["agendado", "Agendado"], ["publicado", "Publicado"]];
const ETAPA_NOME = Object.fromEntries(ETAPAS_POST);
UI.socialCli = Prefs.get("socialCli") || "";
UI.socialMes = Fmt.currentComp();
UI.socialFmt = "todos";
UI.prodBusca = "";
UI.prodSel = null; // Set de ids no modo de seleção

const clientesSocial = c => (c.status || "ativo") !== "encerrado" && ((c.servicos || []).includes("social") || c.interno || (AG("posts") || []).some(p => p.clienteId === c.id));
function setSocialCli(v) { UI.socialCli = v; Prefs.set("socialCli", v || null); render(); }
function postsFiltrados() {
  const all = AG("posts");
  if (all == null) return null;
  return all.filter(p => (!UI.socialCli || p.clienteId === UI.socialCli) && (UI.socialFmt === "todos" || p.formato === UI.socialFmt));
}
function postRotulo(p) {
  const meio = p.formato === "stories" ? (p.data ? dataCurta(p.data) : "sem data") : p.numero != null ? pad2(p.numero) : "s/nº";
  return `${(FORMATOS_POST[p.formato] || "Post").toUpperCase()} — ${meio} — ${p.titulo || p.tema || "Sem título"}`;
}
const ordemPost = (a, b) => (a.data || "9999").localeCompare(b.data || "9999") || (a.numero ?? 999) - (b.numero ?? 999) || (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");

function socialToolbar(extra) {
  return h("div", { class: "toolbar" },
    clienteFiltro("socialCli", UI.socialCli, setSocialCli, { incluir: clientesSocial }),
    segFiltro("Formato", [["todos", "Todos"], ["feed", "Feed"], ["reels", "Reels"], ["stories", "Stories"]], UI.socialFmt, k => { UI.socialFmt = k; render(); }),
    extra || null);
}

/* ---------- calendário editorial ---------- */
function viewSocial() {
  const top = head("Social media", "Calendário editorial", "Os posts de cada cliente por data de publicação. Clique em um post para ver o conteúdo completo.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openPostForm(null, { clienteId: UI.socialCli || null }) }, "Novo post"));
  const posts = postsFiltrados();
  if (posts == null || Store.state.clientes == null) return [top, loadingPanel()];
  const comp = UI.socialMes, [y, m] = comp.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(), first = new Date(y, m - 1, 1).getDay(), hoje = Fmt.todayISO();
  const doMes = posts.filter(p => p.data && p.data.startsWith(comp)).sort(ordemPost);
  const semData = posts.filter(p => !p.data && p.status !== "publicado").sort(ordemPost);
  const chip = p => h("button", { type: "button", class: `pchip f-${p.formato || "feed"} st-${p.status || "ideia"}`, title: `${postRotulo(p)} · ${ETAPA_NOME[p.status] || ""}${UI.socialCli ? "" : " · " + (nomeCliente(p.clienteId) || "")}`, onclick: () => openPost(p) },
    h("span", { class: "pchip-f" }, (FORMATOS_POST[p.formato] || "Post").slice(0, 1)), h("span", { class: "pchip-t" }, p.titulo || p.tema || "Sem título"));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h("div", { class: "ec-cell empty", "aria-hidden": "true" }));
  for (let d = 1; d <= last; d++) {
    const ds = `${comp}-${pad2(d)}`, doDia = doMes.filter(p => p.data === ds);
    cells.push(h("div", { class: "ec-cell" + (ds === hoje ? " today" : "") },
      h("div", { class: "ec-d" }, h("span", null, String(d)), h("button", { class: "ec-add", type: "button", "aria-label": `Novo post em ${Fmt.date(ds)}`, disabled: !canWrite(), onclick: () => openPostForm(null, { clienteId: UI.socialCli || null, data: ds }) }, "+")),
      doDia.map(chip)));
  }
  const dias = [...new Set(doMes.map(p => p.data))];
  const agenda = h("div", { class: "ec-agenda" }, dias.length ? dias.map(ds => h("div", { class: "ec-ag-day" + (ds === hoje ? " today" : "") },
    h("div", { class: "ec-ag-h" }, `${DIAS_SEMANA[new Date(ds + "T12:00").getDay()]}, ${Fmt.date(ds)}`), doMes.filter(p => p.data === ds).map(chip))) : h("p", { class: "muted-line" }, "Nenhum post com data neste mês."));
  const cont = k => doMes.filter(p => p.formato === k).length;
  const resumo = h("div", { class: "kpis-row" },
    kpiCard("Posts no mês", Fmt.integer(doMes.length), `${cont("feed")} feed · ${cont("reels")} reels · ${cont("stories")} stories`),
    kpiCard("Publicados", Fmt.integer(doMes.filter(p => p.status === "publicado").length), "com data neste mês"),
    kpiCard("Agendados", Fmt.integer(doMes.filter(p => p.status === "agendado").length)),
    kpiCard("Em revisão", Fmt.integer(doMes.filter(p => p.status === "revisao").length)),
    kpiCard("Sem data", Fmt.integer(semData.length), "fora do calendário"));
  return [top,
    h("div", { class: "panel" }, socialToolbar(mesNav(comp, c => { UI.socialMes = c; render(); })),
      h("div", { class: "ec" }, h("div", { class: "ec-grid" }, ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(x => h("div", { class: "ec-h" }, x)), cells), agenda),
      h("div", { class: "ec-legend" }, ETAPAS_POST.map(([k, l]) => h("span", { class: "st-" + k }, h("i"), l)))),
    resumo,
    h("div", { class: "panel panel-pad" }, h("div", { class: "chart-head" }, h("h2", null, `Sem data definida (${semData.length})`)),
      semData.length ? h("div", { class: "chip-wrap" }, semData.map(chip)) : h("p", { class: "muted-line" }, "Todos os posts em andamento têm data."))];
}

/* ---------- quadro de produção ---------- */
function viewProducao() {
  const top = head("Social media", "Produção", "Arraste os cartões entre as colunas, ou use as setas, para mudar a etapa do post.",
    h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => openPostForm(null, { clienteId: UI.socialCli || null }) }, "Novo post"));
  let posts = postsFiltrados();
  if (posts == null || Store.state.clientes == null) return [top, loadingPanel()];
  const q = Domain.norm(UI.prodBusca);
  if (q) posts = posts.filter(p => Domain.norm([p.titulo, p.tema, nomeCliente(p.clienteId)].join(" ")).includes(q));
  posts = posts.slice().sort(ordemPost);
  const busca = h("input", { class: "search", id: "prodBusca", type: "search", placeholder: "Buscar post", value: UI.prodBusca, "aria-label": "Buscar post",
    oninput: e => { UI.prodBusca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("prodBusca"); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } });
  const hoje = Fmt.todayISO();
  // modo de seleção: só conta o que está visível com os filtros atuais
  const selIds = UI.prodSel ? new Set(posts.filter(p => UI.prodSel.has(p.id)).map(p => p.id)) : null;
  const btnSel = h("button", { class: "btn" + (UI.prodSel ? " btn-primary" : ""), type: "button", disabled: !canWrite(), onclick: () => { UI.prodSel = UI.prodSel ? null : new Set(); render(); } }, UI.prodSel ? "Concluir seleção" : "Selecionar");
  const sel = UI.prodSel ? {
    ids: selIds,
    alternar: id => { UI.prodSel.has(id) ? UI.prodSel.delete(id) : UI.prodSel.add(id); render(); },
    alternarVarios: (ids, marcar) => { ids.forEach(id => marcar ? UI.prodSel.add(id) : UI.prodSel.delete(id)); render(); },
  } : null;
  const barra = UI.prodSel ? h("div", { class: "sel-bar", role: "region", "aria-label": "Posts selecionados" },
    h("strong", null, selIds.size ? `${selIds.size} ${selIds.size === 1 ? "post selecionado" : "posts selecionados"}` : "Nenhum post selecionado"),
    h("div", { class: "actions-row wrap" },
      h("button", { class: "btn btn-sm", type: "button", disabled: !posts.length || selIds.size === posts.length, onclick: () => { posts.forEach(p => UI.prodSel.add(p.id)); render(); } }, `Selecionar todos (${posts.length})`),
      selIds.size ? h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { UI.prodSel.clear(); render(); } }, "Limpar seleção") : null,
      h("button", { class: "btn btn-danger btn-sm", type: "button", disabled: !selIds.size, onclick: () => excluirPosts([...selIds]) }, selIds.size ? `Excluir ${selIds.size}` : "Excluir"))) : null;
  return [top, h("div", { class: "panel" }, socialToolbar(h("div", { class: "actions-row" }, busca, btnSel))), barra,
    quadro({ colunas: ETAPAS_POST, itens: posts, vazio: "Nenhum post nesta etapa.", sel,
      onOpen: openPost,
      onMove: async (p, st) => { try { await Store.patch("posts", p.id, { status: st }); } catch (x) { toast(Store.message(x), "bad"); } },
      card: p => [
        h("div", { class: "bcard-tags" }, h("span", { class: "tag f-" + p.formato }, FORMATOS_POST[p.formato] || "Post"), p.tipoFeed ? h("span", { class: "tag" }, TIPOS_FEED[p.tipoFeed]) : null, p.numero != null && p.formato !== "stories" ? h("span", { class: "tag" }, "Nº " + p.numero) : null),
        h("div", { class: "bcard-t" }, p.titulo || p.tema || "Sem título"),
        h("div", { class: "bcard-m" }, [UI.socialCli ? null : nomeCliente(p.clienteId), p.data ? (p.data < hoje && !["publicado"].includes(p.status) ? "⚠ " : "") + Fmt.date(p.data) : "Sem data", PILARES[p.pilar]].filter(Boolean).join(" · ")),
        (() => { const pr = MD.progresso(p.conteudo); return pr.total ? h("div", { class: "bar", title: `${pr.feitas} de ${pr.total} itens do checklist` }, h("i", { style: `width:${Math.round(pr.feitas / pr.total * 100)}%` })) : null; })(),
      ] })];
}

function excluirPosts(ids) {
  const n = ids.length;
  confirmDialog({ title: `Excluir ${n} ${n === 1 ? "post" : "posts"}?`, text: `${n === 1 ? "O post selecionado será apagado" : `Os ${n} posts selecionados serão apagados`} do calendário e da produção. A exclusão é definitiva e não pode ser desfeita.`,
    confirmLabel: n === 1 ? "Excluir post" : `Excluir ${n} posts`,
    onConfirm: async () => { await Store.removeAll(ids.map(id => ["posts", id])); UI.prodSel = null; return n === 1 ? "Post excluído." : `${n} posts excluídos.`; } });
}

/* ---------- post: leitura e edição ---------- */
function openPost(p0) {
  const atual = () => (AG("posts") || []).find(x => x.id === p0.id) || p0;
  const p = atual();
  gavetaLeitura({
    eyebrow: [nomeCliente(p.clienteId), ETAPA_NOME[p.status]].filter(Boolean).join(" · "),
    title: postRotulo(p),
    facts: [["Etapa", ETAPA_NOME[p.status]], ["Data de publicação", p.data ? Fmt.date(p.data) : "Sem data"], ["Formato", [FORMATOS_POST[p.formato], TIPOS_FEED[p.tipoFeed]].filter(Boolean).join(" · ")],
      ["Pilar", PILARES[p.pilar]], ["Tema", p.tema], ["Canva", p.canva ? h("a", { href: p.canva, target: "_blank", rel: "noopener noreferrer" }, "Abrir no Canva") : null]],
    conteudo: p.conteudo || "Sem conteúdo ainda. Clique em Editar para escrever o brief, os slides e a legenda.",
    onToggle: async (idx, checked) => { try { const cur = atual(); await Store.patch("posts", cur.id, { conteudo: MD.toggle(cur.conteudo, idx, checked) }); } catch (x) { toast(Store.message(x), "bad"); } },
    actions: close => [
      h("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !canWrite(), onclick: () => { close(); openPostForm(atual()); } }, "Editar"),
      h("label", { class: "inline-field" }, h("span", null, "Etapa"), h("select", { onchange: async e => { try { await Store.patch("posts", p.id, { status: e.target.value }); toast(`Movido para ${ETAPA_NOME[e.target.value]}.`); } catch (x) { toast(Store.message(x), "bad"); } } },
        ETAPAS_POST.map(([k, l]) => h("option", { value: k, selected: k === p.status }, l)))),
      p.notionUrl ? h("a", { class: "btn btn-ghost btn-sm", href: p.notionUrl, target: "_blank", rel: "noopener noreferrer" }, "Ver no Notion") : null,
    ],
  });
}
function openPostForm(p, preset) {
  const v = p || { status: "ideia", formato: "feed", ...(preset || {}) };
  const clientes = clientesOrdenados().filter(c => (c.status || "ativo") !== "encerrado" || c.id === v.clienteId);
  gavetaForm({
    title: p ? "Editar post" : "Novo post", values: v,
    spec: [
      { k: "clienteId", l: "Cliente", type: "select", req: true, blank: "Escolha o cliente", opts: clientes.map(c => [c.id, c.nome]) },
      { k: "titulo", l: "Título", req: true, max: 160, help: "Aparece no calendário e no quadro." },
      { row: [{ k: "formato", l: "Formato", type: "select", opts: FORMATOS_POST }, { k: "tipoFeed", l: "Tipo de feed", type: "select", blank: "Não se aplica", opts: TIPOS_FEED }] },
      { row: [{ k: "numero", l: "Número do post", type: "int", ph: "Ex.: 12" }, { k: "data", l: "Data de publicação", type: "date" }] },
      { row: [{ k: "status", l: "Etapa", type: "select", opts: ETAPAS_POST }, { k: "pilar", l: "Pilar", type: "select", blank: "Sem pilar", opts: PILARES }] },
      { k: "tema", l: "Tema", type: "textarea", rows: 2, max: 600 },
      { k: "canva", l: "Link do Canva", type: "url" },
      { k: "conteudo", l: "Conteúdo", type: "textarea", rows: 16, help: "Brief, slides, roteiro, legenda e checklist. Use ## para títulos, - para listas e - [ ] para caixinhas." },
    ],
    validate: d => (d.formato !== "feed" && d.tipoFeed ? { tipoFeed: "Só posts de feed têm tipo (carrossel ou estático)." } : null),
    onDelete: p ? () => excluirDoc("posts", p, "este post") : null,
    onSave: async d => {
      const data = { ...d, schema: Domain.SCHEMA };
      if (!p && !data.conteudo) data.conteudo = MODELO_POST[data.formato] || "";
      if (p) await Store.patch("posts", p.id, data); else await Store.put("posts", Domain.novoId(d.titulo), { ...data, origem: "painel" });
      return p ? "Post atualizado." : "Post criado.";
    },
  });
}
const MODELO_POST = {
  feed: "## Brief\n\n- **Objetivo:** \n- **Gancho:** \n- **Copy:** \n- **CTA:** \n- **Legenda:** \n- **Referência:** \n\n## Estrutura\n\n- **Slide 1:** \n- **Slide 2:** \n- **Slide 3:** \n\n## Checklist\n\n- [ ] Ideia definida\n- [ ] Copy pronta\n- [ ] Estrutura dos slides\n- [ ] Design\n- [ ] CTA\n- [ ] Legenda\n- [ ] Revisão\n- [ ] Aprovado",
  reels: "## Brief\n\n- **Objetivo:** \n- **Gancho:** \n- **Roteiro:** \n- **CTA:** \n- **Legenda:** \n- **Referência:** \n- **Arquivos:** \n\n## Checklist\n\n- [ ] Roteiro pronto\n- [ ] Gravação\n- [ ] Edição\n- [ ] Legendas\n- [ ] Capa\n- [ ] Legenda\n- [ ] Revisão\n- [ ] Aprovado",
  stories: "## Sequência\n\n- **Objetivo:** \n- **Story 1:** \n- **Story 2:** \n- **Story 3:** \n- **Story 4:** \n- **Story 5:** \n\n## Checklist\n\n- [ ] Story 1\n- [ ] Story 2\n- [ ] Story 3\n- [ ] Story 4\n- [ ] Story 5\n- [ ] CTA\n- [ ] Revisão",
};

/* ---------- planejamento do mês ---------- */
const CAMPOS_PLANO = [
  ["objetivo", "Objetivo do mês"], ["meta", "Meta"], ["foco", "Produto ou serviço foco"], ["oferta", "Oferta"], ["datas", "Datas importantes"],
  ["publico", "Público"], ["pilares", "Pilares de conteúdo"], ["qtdFeed", "Quantidade de feed"], ["qtdReels", "Quantidade de reels"], ["qtdStories", "Frequência de stories"],
  ["campanhas", "Campanhas"], ["observacoes", "Observações"],
];
const MODELO_PLANO = "## Objetivo do mês\n\n\n\n## Meta\n\n\n\n## Produto ou serviço foco\n\n\n\n## Oferta\n\n\n\n## Datas importantes\n\n- \n\n## Público\n\n\n\n## Pilares de conteúdo\n\n- \n\n## Quantidade de posts\n\n- **Feed:** \n- **Reels:** \n- **Stories:** \n\n## Campanhas\n\n\n\n## Observações\n\n";
/** Texto do planejamento: o texto da página ou, em planejamentos antigos, os campos convertidos em seções */
function textoPlano(pl) {
  if (!pl) return "";
  if (pl.texto != null) return pl.texto;
  return CAMPOS_PLANO.filter(([k]) => pl[k]).map(([k, l]) => `## ${l}\n\n${pl[k]}`).join("\n\n");
}
UI.planEdit = null; // { id, texto }
function viewPlanejamento() {
  const top = head("Social media", "Planejamento do mês", "Uma página por cliente e por mês, escrita como um documento.");
  const all = AG("planejamentos"), posts = AG("posts");
  if (all == null || posts == null || Store.state.clientes == null) return [top, loadingPanel()];
  const lista = clientesOrdenados().filter(clientesSocial);
  if (!lista.length) return [top, emptyPanel("Nenhum cliente de social media", "Marque o serviço “Social media” no cadastro do cliente.", h("button", { class: "btn btn-primary", type: "button", onclick: () => go("clientes") }, "Abrir clientes"))];
  const cli = lista.find(c => c.id === UI.socialCli) || lista[0];
  const comp = UI.socialMes, id = `${cli.id}_${comp}`;
  const plano = all.find(x => x.id === id);
  const doMes = posts.filter(p => p.clienteId === cli.id && p.data && p.data.startsWith(comp));
  const cont = k => doMes.filter(p => p.formato === k).length;
  const doCliente = all.filter(x => x.clienteId === cli.id).sort((a, b) => b.competencia.localeCompare(a.competencia));
  const anterior = doCliente.find(x => x.competencia < comp);
  const editando = UI.planEdit && UI.planEdit.id === id;
  const bar = h("div", { class: "toolbar" }, clienteFiltro("planCli", cli.id, v => { UI.planEdit = null; setSocialCli(v); }, { incluir: clientesSocial, semTodos: true }), mesNav(comp, c => { UI.planEdit = null; UI.socialMes = c; render(); }));
  const editar = (texto) => { UI.planEdit = { id, texto }; render(); setTimeout(() => document.getElementById("planTexto")?.focus(), 0); };
  let pagina;
  if (editando) {
    const ta = h("textarea", { id: "planTexto", class: "plan-editor", "aria-label": "Texto do planejamento", spellcheck: "true", oninput: e => { UI.planEdit.texto = e.target.value; } });
    ta.value = UI.planEdit.texto;
    const salvar = h("button", { class: "btn btn-primary", type: "button", onclick: async () => {
      salvar.disabled = true; salvar.textContent = "Salvando…";
      try { await Store.put("planejamentos", id, { ...(plano || {}), texto: UI.planEdit.texto, clienteId: cli.id, competencia: comp, schema: Domain.SCHEMA }); UI.planEdit = null; toast("Planejamento salvo."); render(); }
      catch (x) { toast(Store.message(x), "bad"); salvar.disabled = false; salvar.textContent = "Salvar"; } } }, "Salvar");
    pagina = h("article", { class: "plan-page editing" },
      h("div", { class: "plan-head" }, h("div", null, h("div", { class: "eyebrow" }, `${cli.nome} · ${Fmt.month(comp)}`), h("h2", null, "Editando o planejamento")),
        h("div", { class: "actions-row" }, h("button", { class: "btn", type: "button", onclick: () => { UI.planEdit = null; render(); } }, "Cancelar"), salvar)),
      h("p", { class: "plan-dica" }, "Escreva como num documento. ## cria um título, - cria uma lista, - [ ] cria uma caixinha para marcar e **texto** deixa em negrito."), ta);
  } else if (plano) {
    const texto = textoPlano(plano);
    pagina = h("article", { class: "plan-page" },
      h("div", { class: "plan-head" }, h("div", null, h("div", { class: "eyebrow" }, "Planejamento do mês"), h("h2", null, `${cli.nome} · ${Fmt.month(comp)}`)),
        h("div", { class: "actions-row" }, h("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !canWrite(), onclick: () => excluirDoc("planejamentos", plano, "este planejamento") }, "Excluir"),
          h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => editar(texto) }, "Editar"))),
      texto.trim() ? MD.render(texto, async (idx, checked) => { try { await Store.patch("planejamentos", id, { texto: MD.toggle(textoPlano(all.find(x => x.id === id) || plano), idx, checked) }); } catch (x) { toast(Store.message(x), "bad"); } })
        : h("p", { class: "muted-line" }, "Página em branco. Clique em Editar para escrever."));
  } else {
    pagina = h("div", { class: "plan-page" }, h("div", { class: "empty" }, h("div", { class: "empty-title" }, `Sem planejamento para ${Fmt.month(comp)}`),
      h("p", null, anterior ? `Último planejamento: ${Fmt.month(anterior.competencia)}.` : "Crie a página de planejamento deste mês."),
      h("div", { class: "actions-row wrap", style: "justify-content:center" },
        h("button", { class: "btn btn-primary", type: "button", disabled: !canWrite(), onclick: () => editar(MODELO_PLANO) }, "Criar planejamento"),
        anterior ? h("button", { class: "btn", type: "button", disabled: !canWrite(), onclick: () => editar(textoPlano(anterior)) }, `Começar a partir de ${Fmt.monthShort(anterior.competencia)}`) : null)));
  }
  const meses = h("nav", { class: "plan-meses", "aria-label": "Planejamentos do cliente" }, h("div", { class: "plan-label" }, "Meses planejados"),
    doCliente.length ? doCliente.map(x => h("button", { type: "button", class: "doc-link", "aria-current": x.id === id ? "true" : null, onclick: () => { UI.planEdit = null; UI.socialMes = x.competencia; render(); } }, h("span", null, Fmt.month(x.competencia)))) : h("p", { class: "muted-line" }, "Nenhum ainda."));
  const resumo = h("div", { class: "plan-resumo" }, h("div", { class: "plan-label" }, "No calendário"),
    [["Feed", cont("feed")], ["Reels", cont("reels")], ["Stories", cont("stories")], ["Publicados", doMes.filter(p => p.status === "publicado").length]].map(([l, n]) => h("div", { class: "plan-n" }, h("span", null, l), h("strong", null, Fmt.integer(n)))),
    h("button", { class: "linkbtn", type: "button", onclick: () => go("social") }, "Abrir calendário"));
  return [top, h("div", { class: "panel" }, bar), h("div", { class: "plan-layout" }, h("div", { class: "panel plan-main" }, pagina), h("aside", { class: "panel plan-side" }, resumo, meses))];
}
