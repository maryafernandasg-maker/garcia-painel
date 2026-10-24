// Dados diários: importação (arquivo sintético no formato validado do Meta, com uma linha por campanha e dia) e séries.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { Intl, Number, Math, String, Object, Date, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8") + "\nthis.Fmt=Fmt;this.Metrics=Metrics;this.MetaCsv=MetaCsv;this.Diario=Diario;", ctx);
const { MetaCsv, Diario } = ctx;
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log("FALHOU:", n)); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const hdr = fs.readFileSync(path.join(__dirname, "fixtures/meta-campanhas-set2026.csv"), "utf8").split(/\r?\n/)[0];
// gera 30 dias: ADV (orçamento 18) e duas "Instagram Post" com orçamentos diferentes; dia 15 sem entrega na ADV
const lines = [hdr];
const q = s => `"${s}"`;
let invADV = 0, convADV = 0;
for (let d = 1; d <= 30; d++) {
  const dia = `2026-09-${String(d).padStart(2, "0")}`;
  const g = d === 15 ? 0 : 13 + (d % 5);           // reais
  const conv = d === 15 ? "" : String(10 + (d % 4));
  if (d !== 15) { invADV += g * 100; convADV += 10 + (d % 4); }
  lines.push([dia, dia, q("[MENSAGENS] | [ADV]"), 18, "Diário", g, d === 15 ? 0 : 700, d === 15 ? 0 : 1600, 0, 0, d === 15 ? "" : 28, "", "", 0, 0, 0, conv, d === 15 ? "" : "actions:onsite_conversion.messaging_conversation_started_7d", "", "", "", "", ""].join(","));
  lines.push([dia, dia, q("Instagram Post"), 10, "Diário", "2.1", 180, 220, 0, 0, 20, "", "", 0, 0, 0, 21, "profile_visit_view", "", "", "", "", ""].join(","));
  lines.push([dia, dia, q("Instagram Post"), 6, "Diário", "3.5", 380, 470, 0, 0, 44, "", "", 0, 0, 0, 45, "profile_visit_view", "", "", "", "", ""].join(","));
}
const txt = lines.join("\n");
const r = MetaCsv.importarDiario(txt);
ok("importa diário", r.ok);
ok("30 dias", r.dias === 30);
ok("período", r.periodo.inicio === "2026-09-01" && r.periodo.fim === "2026-09-30");
ok("nomes separados por orçamento", r.campanhas.includes("Instagram Post (orçamento 10/dia)") && r.campanhas.includes("Instagram Post (orçamento 6/dia)"));
ok("dia sem entrega ignorado", r.meses["2026-09"].filter(l => l.data === "2026-09-15").length === 2);
ok("arquivo mensal recusado como diário", !MetaCsv.importarDiario(fs.readFileSync(path.join(__dirname, "fixtures/meta-campanhas-set2026.csv"), "utf8")).ok);
// variante com coluna "Dia" em dd/mm/aaaa
const txt2 = ["Dia," + hdr, ...lines.slice(1).map(l => { const d = l.slice(0, 10); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)},` + l; })].join("\n");
const r2 = MetaCsv.importarDiario(txt2);
ok("aceita coluna Dia", r2.ok && r2.dias === 30);
// séries
const L = r.meses["2026-09"];
const tipo = Diario.tipoPrincipal(L, "conversas");
ok("tipo principal preferido", tipo === "conversas");
const tot = Diario.resumo(L, tipo);
ok("conversas somadas", tot.resultados.v === convADV);
ok("custo por conversa só da ADV", near(tot.cpr.v, invADV / convADV));
ok("investimento total inclui tudo", tot.investimentoCentavos.v === invADV + 30 * 210 + 30 * 350);
const se = Diario.serie(L, "2026-09-10", "2026-09-16", tipo);
ok("série com 7 dias", se.length === 7);
ok("dia 15 sem conversas", se[5].r.resultados.v === null);
ok("CTR do dia ponderado", near(se[0].r.ctr.v, (28 + 20 + 44) / (1600 + 220 + 470) * 100));
// datas
ok("comparação anterior", JSON.stringify(Diario.comparacao("2026-10-01", "2026-10-07")) === JSON.stringify({ ini: "2026-09-24", fim: "2026-09-30" }));
ok("comparação mês anterior", JSON.stringify(Diario.comparacao("2026-10-01", "2026-10-31", "mes")) === JSON.stringify({ ini: "2026-09-01", fim: "2026-09-30" }));
ok("31/03 vira 28/02", Diario.mesAnterior("2027-03-31") === "2027-02-28");
ok("intervalo", Diario.range("2026-12-30", "2027-01-02").length === 4);
// mesclar: reimportar só parte do mês mantém o resto
const m = Diario.mesclar(L, L.filter(l => l.data <= "2026-09-05").map(l => ({ ...l, investimentoCentavos: 1 })));
ok("mesclar mantém dias fora do arquivo", m.length === L.length && m.filter(l => l.investimentoCentavos === 1).length === L.filter(l => l.data <= "2026-09-05").length);
const tc = Diario.totaisCampanhas(L);
ok("totais por campanha", tc.find(c => c.nome === "[MENSAGENS] | [ADV]").investimentoCentavos === invADV);
// arquivo real (Relatórios de anúncios, coluna "Dia" e "Tipo de resultado"): a soma dos dias bate com os arquivos mensais
const real = MetaCsv.importarDiario(fs.readFileSync(path.join(__dirname, "fixtures/meta-diario-relatorios-set-out2026.csv"), "utf8"));
ok("arquivo real importa", real.ok);
for (const [comp, file] of [["2026-09", "meta-campanhas-set2026.csv"], ["2026-10", "meta-campanhas-out2026-parcial.csv"]]) {
  const mensal = MetaCsv.importar(fs.readFileSync(path.join(__dirname, "fixtures/" + file), "utf8"), comp);
  const dias = Diario.resumo(real.meses[comp], "conversas");
  ok(`${comp}: investimento igual ao mensal`, dias.investimentoCentavos.v === mensal.resumo.investimentoCentavos);
  ok(`${comp}: impressões iguais`, dias.impressoes.v === mensal.resumo.impressoes);
  ok(`${comp}: cliques iguais`, dias.cliquesLink.v === mensal.resumo.cliquesLink);
  ok(`${comp}: conversas iguais`, dias.resultados.v === mensal.resumo.resultados);
}
ok("tipo de resultado em português", real.meses["2026-09"].some(l => l.tipoResultado === "visitas"));
// arquivo real por anúncio: somando os anúncios, cada campanha em cada dia bate com o arquivo diário de campanhas
const ads = MetaCsv.importarDiario(fs.readFileSync(path.join(__dirname, "fixtures/meta-diario-anuncios-set-out2026.csv"), "utf8"));
ok("arquivo por anúncio importa", ads.ok && ads.nivel === "anuncio");
ok("linhas têm conjunto e anúncio", ads.meses["2026-09"].every(l => l.conjunto && l.anuncio));
for (const comp of ["2026-09", "2026-10"]) {
  const soma = Diario.somarCampanhas(ads.meses[comp]);
  const camp = real.meses[comp];
  const k = l => l.data + "|" + l.campanha;
  const mapa = Object.fromEntries(soma.map(l => [k(l), l]));
  let iguais = 0, difs = [];
  for (const l of camp) {
    const a = mapa[k(l)];
    if (a && a.investimentoCentavos === l.investimentoCentavos && a.impressoes === l.impressoes && (a.cliquesLink || 0) === (l.cliquesLink || 0) && (a.resultados || 0) === (l.resultados || 0)) iguais++;
    else difs.push(k(l));
  }
  ok(`${comp}: anúncios somados = campanhas, dia a dia (${iguais}/${camp.length})`, iguais === camp.length && soma.length === camp.length);
  if (difs.length) console.log("  diferenças:", difs.slice(0, 5));
}
const rk = Diario.ranking(ads.meses["2026-10"], "anuncio", "conversas");
ok("ranking começa pelo tipo principal", rk[0].tipoResultado === "conversas");
ok("melhor só entre quem tem volume", rk.filter(i => i.melhor).every(i => i.vol.baixo === false));
ok("no máximo um melhor", rk.filter(i => i.melhor).length <= 1);
const rkConj = Diario.ranking(ads.meses["2026-09"], "conjunto", "conversas");
ok("ranking de conjuntos", rkConj.length >= 2 && rkConj.every(i => i.anuncio === null));
// estrutura mensal a partir dos anúncios
const campSet = [{ id: "c1", nome: "[MENSAGENS] | [COMBOS] | [ADV] | [AQUISIÇÃO]" }, { id: "c2", nome: "[MENSAGENS] | [COMBOS] | [ABERTO] | [AQUISIÇÃO]" },
  { id: "c3", nome: "[MENSAGENS] | [COMBOS] | [ADV] | [AQUISIÇÃO] [VIDEOS]" }, { id: "c4", nome: "Instagram Post (orçamento 10/dia)" }, { id: "c5", nome: "Instagram Post (orçamento 6/dia)" }];
const em = Diario.estruturaMensal(ads.meses["2026-09"], campSet);
ok("set: Instagram Post ambíguo fica de fora", em.ignoradas.length === 1 && em.ignoradas[0] === "Instagram Post");
ok("set: conjuntos ligados às campanhas", em.conjuntos.length === 3 && em.conjuntos.every(x => ["c1", "c2", "c3"].includes(x.campanhaId)));
ok("set: soma dos conjuntos da ADV = campanha", em.conjuntos.filter(x => x.campanhaId === "c1").reduce((a, x) => a + x.investimentoCentavos, 0) === 39814);
ok("set: soma dos anúncios = soma dos conjuntos", em.anuncios.reduce((a, x) => a + x.investimentoCentavos, 0) === em.conjuntos.reduce((a, x) => a + x.investimentoCentavos, 0));
ok("formato vídeo pelo nome", em.anuncios.some(x => x.formato === "video") && em.anuncios.some(x => x.formato === null));
const emOut = Diario.estruturaMensal(ads.meses["2026-10"], [{ id: "d1", nome: "[MENSAGENS] | [COMBOS] | [ADV] | [AQUISIÇÃO]" }, { id: "d2", nome: "Instagram Post (orçamento 6/dia)" }, { id: "d3", nome: "[MENSAGENS] | [COMBOS] | [ADV] | [AQUISIÇÃO] [VIDEOS]" }]);
ok("out: Instagram Post ligado à única candidata", emOut.ignoradas.length === 0 && emOut.conjuntos.some(x => x.campanhaId === "d2"));
// Instagram por dia (planilha)
vm.runInContext("this.Instagram=Instagram;", ctx);
const IG = ctx.Instagram;
const csvConta = ['"Visitas ao perfil do Instagram e novos seguidores"', 'Data,"Visitas ao perfil do Instagram","Novos seguidores"', '2026-10-01,40,3', '2026-10-02,35,2', '2026-10-03,50,"1"', 'Total,125,6'].join("\n");
const ig1 = IG.importar(csvConta);
ok("IG conta: importa", ig1.ok && ig1.dias === 3);
ok("IG conta: ignora título e total", ig1.meses["2026-10"][2].visitasPerfil === 50);
const csvAds = ['"Nome da campanha",Dia,"Visitas ao perfil do Instagram","Seguidores do Instagram","Custo por seguidor do Instagram"', '"A",2026-10-01,10,1,2', '"B",2026-10-01,5,,3', '"A",02/10/2026,7,2,1'].join("\n");
const ig2 = IG.importar(csvAds);
ok("IG anúncios: soma por dia", ig2.ok && ig2.meses["2026-10"][0].visitasPerfil === 15 && ig2.meses["2026-10"][0].novosSeguidores === 1);
ok("IG anúncios: ignora coluna de custo", ig2.colunas.seguidores === "Seguidores do Instagram");
ok("IG sem colunas", !IG.importar("Dia,Impressões\n2026-10-01,10").ok);
const dias = ig1.meses["2026-10"];
ok("IG período completo soma", IG.periodo(dias, "2026-10-01", "2026-10-03").visitas.v === 125);
ok("IG período com dia faltando", IG.periodo(dias, "2026-10-01", "2026-10-04").visitas.m === "Faltam dias na planilha (3 de 4 dias)");
ok("IG taxa", Math.abs(IG.taxas(IG.periodo(dias, "2026-10-01", "2026-10-03"), 10000).visitaSeguidor.v - 6 / 125 * 100) < 1e-9);
ok("IG mesclar", IG.mesclar(dias, [{ data: "2026-10-03", visitasPerfil: 1, novosSeguidores: 0 }]).find(d => d.data === "2026-10-03").visitasPerfil === 1);
console.log(rk.map(i => `${i.anuncio} | ${i.tipoResultado} | ${i.resultados} | ${i.cpr.v == null ? "-" : (i.cpr.v / 100).toFixed(2)} | ${i.vol.baixo ? "pouco" : "ok"}${i.melhor ? " | MELHOR" : ""}`).join("\n"));
console.log(`${pass} testes de dados diários passaram, ${fail} falharam.`);
fs.writeFileSync(path.join(__dirname, "fixtures/sintetico-diario-set2026.csv"), txt);
process.exit(fail ? 1 : 0);
