// Importação do CSV do Meta: confere com o arquivo real e com as métricas calculadas pelo próprio Meta.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { Intl, Number, Math, String, Object, Date, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8") + "\nthis.Fmt=Fmt;this.Metrics=Metrics;this.MetaCsv=MetaCsv;", ctx);
const { Metrics, MetaCsv } = ctx;
const txt = fs.readFileSync(path.join(__dirname, "fixtures/meta-campanhas-set2026.csv"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log("FALHOU:", n)); };
const r = MetaCsv.importar(txt, "2026-09");
ok("importa", r.ok);
ok("5 campanhas com entrega", r.campanhas.length === 5);
ok("cópia sem entrega ignorada", r.semEntrega.length === 1);
ok("nomes repetidos separados", new Set(r.campanhas.map(c => c.nome)).size === 5);
ok("investimento em centavos", r.campanhas[0].investimentoCentavos === 6282);
ok("resumo investimento = 661,64", r.resumo.investimentoCentavos === 6282 + 39814 + 8573 + 11346 + 149);
ok("resumo impressões", r.resumo.impressoes === 6662 + 48859 + 9285 + 14394 + 111);
ok("resultado principal = conversas", r.resumo.tipoResultado === "conversas" && r.resumo.resultados === 336 + 52 + 1);
ok("visitas ao perfil mapeadas", r.campanhas[0].tipoResultado === "visitas");
ok("mês errado recusado", !MetaCsv.importar(txt, "2026-08").ok);
// confronta com as métricas do próprio Meta, linha a linha
const rows = MetaCsv.parseCsv(txt), hdr = rows[0];
const col = n => hdr.indexOf(n);
let i = 0;
for (const row of rows.slice(1)) {
  if (!(Number(row[col("Impressões")]) > 0)) continue;
  const c = r.campanhas[i++], b = Metrics.basicas(c);
  const near = (a, m, tol) => Math.abs(a - m) <= tol;
  ok(`CPM ${c.nome}`, near(b.cpm.v / 100, Number(row[col("CPM (custo por 1.000 impressões) (BRL)")]), 0.005));
  ok(`CTR ${c.nome}`, near(b.ctr.v, Number(row[col("CTR (taxa de cliques no link)")]), 0.0005));
  ok(`CPC ${c.nome}`, near(b.cpc.v / 100, Number(row[col("CPC (custo por clique no link) (BRL)")]), 0.005));
  ok(`Frequência ${c.nome}`, near(b.frequencia.v, Number(row[col("Frequência")]), 0.0005));
  ok(`Custo/resultado ${c.nome}`, near(b.cpr.v / 100, Number(row[col("Custo por resultados")]), 0.005));
}
const o = MetaCsv.importar(fs.readFileSync(path.join(__dirname, "fixtures/meta-campanhas-out2026-parcial.csv"), "utf8"), "2026-10");
ok("outubro importa", o.ok);
ok("outubro: 3 com entrega", o.campanhas.length === 3);
ok("nome igual ao de setembro", o.campanhas.some(c => c.nome === "Instagram Post (orçamento 6/dia)"));
ok("período parcial detectado", o.periodo.parcial === true && o.periodo.fim === "2026-10-23");
ok("setembro não é parcial", r.periodo.parcial === false);
console.log(`${pass} testes de importação passaram, ${fail} falharam.`);
console.log(JSON.stringify(r.resumo), r.avisos.length, r.campanhas.map(c => c.nome));
process.exit(fail ? 1 : 0);
