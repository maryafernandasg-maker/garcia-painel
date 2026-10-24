// Testes do núcleo com valores conhecidos. Rodar: node src/core.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { Intl, Number, Math, String, Object, Date, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8") + "\nthis.Fmt=Fmt;this.Metrics=Metrics;this.Domain=Domain;", ctx);
const { Fmt, Metrics, Domain } = ctx;

let pass = 0, fail = 0;
const near = (a, b) => (a === null && b === null) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
function eq(name, got, want) {
  const ok = typeof want === "number" || want === null ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log("FALHOU:", name, "\n  obtido:", JSON.stringify(got), "\n  esperado:", JSON.stringify(want));
}

/* ---- conversão de entrada ---- */
eq("money 1.234,56", Fmt.parseMoney("1.234,56").value, 123456);
eq("money R$ 1.500", Fmt.parseMoney("R$ 1.500").value, 150000);
eq("money 12,5", Fmt.parseMoney("12,5").value, 1250);
eq("money 0", Fmt.parseMoney("0").value, 0);
eq("money vazio = null", Fmt.parseMoney("").value, null);
eq("money formato americano recusado", Fmt.parseMoney("1,234.56").ok, false);
eq("money 3 decimais recusado", Fmt.parseMoney("10,555").ok, false);
eq("money 0,1+0,2 sem erro de ponto flutuante", Fmt.parseMoney("0,10").value + Fmt.parseMoney("0,20").value, 30);
eq("int 12.345", Fmt.parseInt("12.345").value, 12345);
eq("int 0 é zero real", Fmt.parseInt("0").value, 0);
eq("int vazio = null", Fmt.parseInt(" ").value, null);
eq("int com vírgula recusado", Fmt.parseInt("1,5").ok, false);
eq("int negativo recusado", Fmt.parseInt("-3").ok, false);

/* ---- exibição ---- */
eq("exibe moeda", Fmt.money(123456).replace(/\s/g, " "), "R$ 1.234,56");
eq("exibe pct", Fmt.pct(1.2), "1,20%");
eq("exibe ausente", Fmt.money(null), "—");
eq("limites do mês fev/2028 (bissexto)", Fmt.monthBounds("2028-02").fim, "2028-02-29");
eq("mês por extenso", Fmt.month("2026-09"), "setembro de 2026");
eq("mês anterior de janeiro", Fmt.previousComp("2027-01"), "2026-12");

/* ---- métricas básicas: R$ 1.500, 100.000 impressões, 40.000 alcance, 1.200 cliques, 60 conversas ---- */
const r = { investimentoCentavos: 150000, impressoes: 100000, alcance: 40000, cliquesLink: 1200, resultados: 60, tipoResultado: "conversas" };
const b = Metrics.basicas(r);
eq("CPM = R$ 15,00", b.cpm.v, 1500);
eq("CTR = 1,2%", b.ctr.v, 1.2);
eq("CPC = R$ 1,25", b.cpc.v, 125);
eq("Frequência = 2,5", b.frequencia.v, 2.5);
eq("Custo por resultado = R$ 25,00", b.cpr.v, 2500);
eq("CPC não arredonda antes da exibição", Metrics.basicas({ investimentoCentavos: 10000, cliquesLink: 3 }).cpc.v, 10000 / 3);

/* ---- zero real vs ausente ---- */
eq("0 cliques → CTR 0% (zero real)", Metrics.basicas({ cliquesLink: 0, impressoes: 1000 }).ctr.v, 0);
eq("0 cliques → CPC não calculável", Metrics.basicas({ investimentoCentavos: 5000, cliquesLink: 0 }).cpc, { v: null, m: "Cliques no link igual a zero" });
eq("cliques ausentes → motivo", Metrics.basicas({ investimentoCentavos: 5000 }).cpc.m, "Cliques no link: não informado");
eq("impressões 0 → CPM não calculável", Metrics.basicas({ investimentoCentavos: 5000, impressoes: 0 }).cpm.v, null);
eq("resultados sem tipo → sem CPR", Metrics.basicas({ investimentoCentavos: 5000, resultados: 10 }).cpr.v, null);

/* ---- agregação ponderada ---- */
const A = { investimentoCentavos: 10000, impressoes: 1000, cliquesLink: 100, alcance: 800, resultados: 10, tipoResultado: "conversas" };   // CTR 10%
const B = { investimentoCentavos: 90000, impressoes: 9000, cliquesLink: 90, alcance: 5000, resultados: 5, tipoResultado: "leads" };      // CTR 1%
const ag = Metrics.agregar([A, B]);
eq("soma investimento", ag.investimentoCentavos.v, 100000);
eq("CTR ponderado = 1,9% (não 5,5%)", ag.ctr.v, 1.9);
eq("CPC ponderado = 100000/190", ag.cpc.v, 100000 / 190);
eq("CPM ponderado = R$ 100,00 (R$ 1.000 / 10.000 impr.)", ag.cpm.v, 10000);
eq("alcance não somado", ag.alcance.v, null);
eq("tipos de resultado diferentes não somados", ag.resultados.length, 2);
eq("CPR por tipo (conversas)", ag.resultados.find(x => x.tipo === "conversas").cpr.v, 1000);
const ag2 = Metrics.agregar([A, { investimentoCentavos: 5000, impressoes: null, cliquesLink: 20 }]);
eq("linha sem impressões fica fora do CTR", ag2.ctr.linhas, 1);
eq("conta linhas sem o dado", ag2.impressoes.faltando, 1);
eq("CTR usa só linhas completas", ag2.ctr.v, 10);
eq("agregar vazio", Metrics.agregar([]).investimentoCentavos.v, null);

/* ---- funil ---- */
const com = { leadsQualificados: 30, vendasAtribuidas: 12, receitaAtribuidaCentavos: 600000, custosExtrasCentavos: 30000, custosCompletos: true };
const fz = Metrics.funil(r, com);
eq("cliques → conversas = 5%", fz.taxas.taxaCliqueLead.v, 5);
eq("qualificação = 50%", fz.taxas.taxaQualificacao.v, 50);
eq("leads → vendas = 20%", fz.taxas.taxaLeadVenda.v, 20);
eq("custo por lead = R$ 25", fz.taxas.cpl.v, 2500);
eq("custo por lead qualificado = R$ 50", fz.taxas.cplq.v, 5000);
eq("CAC mídia = R$ 125", fz.taxas.cacMidia.v, 12500);
eq("CAC total = (1500+300)/12 = R$ 150", fz.taxas.cacTotal.v, 15000);
eq("ROAS = 4", fz.taxas.roas.v, 4);
eq("CAC total exige custos completos", Metrics.funil(r, { ...com, custosCompletos: false }).taxas.cacTotal.v, null);
eq("CAC total com 0 vendas", Metrics.funil(r, { ...com, vendasAtribuidas: 0 }).taxas.cacTotal.m, "Vendas atribuídas igual a zero");
eq("receita ausente → sem ROAS (não zero)", Metrics.funil(r, { vendasAtribuidas: 2 }).taxas.roas.v, null);
const fc = Metrics.funil({ ...r, tipoResultado: "compras" }, com);
eq("compras não viram 'leads'", fc.etapas[2].v, null);
eq("custo por lead indisponível p/ compras", fc.taxas.cpl.m, "O resultado principal do mês não é conversa nem lead");
eq("etapas do cliente marcadas como cliente", fz.etapas.filter(e => e.origem === "cliente").length, 3);

/* ---- validação ---- */
const ctxV = { bounds: Fmt.monthBounds("2026-09"), campanhas: { c1: "Camp 1" }, conjuntosDe: id => id === "c1" ? { s1: "Conj" } : {} };
let v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-09-30", impressoes: "1.000", cliquesLink: "2.000" }, ctxV);
eq("cliques > impressões recusado", !!v.errors.cliquesLink, true);
v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-10-03" }, ctxV);
eq("período fora do mês recusado", !!v.errors.periodoFim, true);
v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-09-30", alcance: "5.000", impressoes: "4.000" }, ctxV);
eq("alcance > impressões recusado", !!v.errors.alcance, true);
v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-09-30", resultados: "10" }, ctxV);
eq("resultado sem tipo recusado", !!v.errors.tipoResultado, true);
v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-09-30", investimentoCentavos: "1.500,00", impressoes: "100.000", alcance: "40.000", cliquesLink: "1.200", tipoResultado: "conversas", resultados: "60" }, ctxV);
eq("resumo válido", v.ok, true);
eq("resumo convertido", [v.data.investimentoCentavos, v.data.impressoes, v.data.resultados], [150000, 100000, 60]);
v = Domain.validate("resumo", { periodoInicio: "2026-09-01", periodoFim: "2026-09-30", impressoes: "" }, ctxV);
eq("campo vazio fica null", v.data.impressoes, null);
v = Domain.validate("campanha", { nome: "" }, ctxV);
eq("campanha sem nome recusada", v.errors.nome, "Campo obrigatório.");
v = Domain.validate("anuncio", { nome: "Ad", campanhaId: "c1", conjuntoId: "s9" }, ctxV);
eq("conjunto de outra campanha recusado", !!v.errors.conjuntoId, true);
v = Domain.validate("conjunto", { nome: "X", campanhaId: "zz" }, ctxV);
eq("campanha inexistente recusada", !!v.errors.campanhaId, true);
v = Domain.validate("comercial", { custosCompletos: "on" }, {});
eq("custos completos exige valor", !!v.errors.custosExtrasCentavos, true);
v = Domain.validate("comercial", { leadsQualificados: "80" }, { leads: 60 });
eq("aviso: mais qualificados que leads", v.warnings.length, 1);
eq("id do relatório", Domain.relatorioId("silvia-x1", "2026-09"), "silvia-x1_2026-09");

/* ---- consolidação de meses ---- */
const mesA = { comp: "2026-08", resumo: { investimentoCentavos: 100000, impressoes: 50000, alcance: 20000, cliquesLink: 500, resultados: 40, tipoResultado: "conversas" }, com: { leadsQualificados: 20, vendasAtribuidas: 5, receitaAtribuidaCentavos: 250000, custosCompletos: true, custosExtrasCentavos: 50000 } };
const mesB = { comp: "2026-09", resumo: r, com };
const c1 = Metrics.consolidar([mesB]);
eq("1 mês: CPM igual ao básico", c1.cpm.v, b.cpm.v);
eq("1 mês: frequência", c1.frequencia.v, 2.5);
eq("1 mês: CAC total igual ao funil", c1.cacTotal.v, fz.taxas.cacTotal.v);
eq("1 mês: qualificação igual ao funil", c1.taxaQualificacao.v, fz.taxas.taxaQualificacao.v);
eq("1 mês: ROAS igual ao funil", c1.roas.v, fz.taxas.roas.v);
const c2 = Metrics.consolidar([mesA, mesB]);
eq("2 meses: investimento somado", c2.investimentoCentavos.v, 250000);
eq("2 meses: alcance não somado", c2.alcance.v, null);
eq("2 meses: CTR ponderado (1700/150000)", c2.ctr.v, 1700 / 150000 * 100);
eq("2 meses: conversas somadas", c2.resultados.v, 100);
eq("2 meses: custo por conversa ponderado", c2.cpr.v, 2500);
eq("2 meses: ROAS = 8500/2500", c2.roas.v, 850000 / 250000);
eq("2 meses: CAC total = (1500+300+1000+500)/17", c2.cacTotal.v, (180000 + 150000) / 17);
const c3 = Metrics.consolidar([mesA, { comp: "2026-09", resumo: { ...r, tipoResultado: "compras" } }]);
eq("tipos diferentes: resultados não somados", c3.resultados.v, null);
eq("tipos diferentes: motivo", c3.resultados.m, "Meses com tipos de resultado diferentes não são somados");
eq("CAC total exige custos completos em todos os meses", Metrics.consolidar([mesA, { comp: "x", resumo: r, com: { vendasAtribuidas: 3 } }]).cacTotal.v, null);
eq("ROAS só com meses que têm receita", Metrics.consolidar([mesA, { comp: "x", resumo: r, com: { vendasAtribuidas: 3 } }]).roas.v, 2.5);

/* ---- variação ---- */
eq("CPM subiu = pior", Metrics.variacao(1200, 1000, -1).sentido, "pior");
eq("CTR subiu = melhor", Metrics.variacao(2, 1, 1).sentido, "melhor");
eq("variação %", Metrics.variacao(1200, 1000, -1).pct, 20);
eq("base zero sem %", Metrics.variacao(5, 0, 1).pct, null);
eq("sem anterior", Metrics.variacao(5, null, 1), null);
eq("frequência é neutra", Metrics.variacao(3, 2, 0).sentido, "neutro");

/* ---- volume e leitura ---- */
eq("volume baixo por impressões", Metrics.volume({ impressoes: 800, resultados: 10 }).baixo, true);
eq("volume baixo por resultados", Metrics.volume({ impressoes: 8000, resultados: 3 }).baixo, true);
eq("volume ok", Metrics.volume({ impressoes: 8000, resultados: 30 }).baixo, false);
const lt = Metrics.leitura(Metrics.consolidar([mesB]), Metrics.consolidar([mesA]), { ticketMedioCentavos: 15000 });
eq("leitura aponta queda do CPM como positiva", lt.some(x => /^CPM caiu 25%/.test(x.texto) && x.tipo === "positivo"), true);
eq("leitura não acusa falta de comercial quando informado", lt.some(x => /Sem resultados comerciais/.test(x.texto)), false);
eq("leitura relaciona custo com ticket", lt.some(x => /ticket médio/.test(x.texto)), true);
eq("leitura sem comercial", Metrics.leitura(Metrics.consolidar([{ comp: "x", resumo: r }]), null).some(x => /Sem resultados comerciais/.test(x.texto)), true);

/* ---- plano de ação ---- */
let va = Domain.validateAcoes([{ acao: "Testar vídeo", responsavel: "Marya", prazo: "2026-10-15" }, { acao: "", responsavel: "", prazo: "" }]);
eq("linha vazia ignorada", va.acoes.length, 1);
va = Domain.validateAcoes([{ acao: "", responsavel: "Marya" }]);
eq("ação sem descrição recusada", va.ok, false);
v = Domain.validate("teste", { hipotese: "x", status: "andamento", inicio: "2026-09-10", fim: "2026-09-01" }, {});
eq("teste com fim antes do início recusado", !!v.errors.fim, true);
v = Domain.validate("teste", { hipotese: "", status: "planejado" }, {});
eq("teste exige hipótese", !!v.errors.hipotese, true);
eq("rótulo de período", Fmt.periodLabel(["2026-07", "2026-08", "2026-09"]), "jul/2026 a set/2026");
eq("competências do período", Fmt.compsUntil("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
eq("diferença em p.p.", Fmt.signed("pct", -0.5), "−0,50 p.p.");

console.log(`\n${pass} testes passaram, ${fail} falharam.`);
process.exit(fail ? 1 : 0);
