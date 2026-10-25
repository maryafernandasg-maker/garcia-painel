// Visão geral do tráfego: todos os clientes, por cliente, funil e metas. Rodar: node tests/e2e-visao.js
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/js/config.js') { res.setHeader('content-type', 'text/javascript'); return res.end('window.GARCIA_CONFIG={supabaseUrl:"https://teste.supabase.co",supabaseKey:"x",nome:"Marya"};'); }
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(8772);
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const pad = n => String(n).padStart(2, '0');
const d0 = new Date(); const prevComp = (y, m) => m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
const C2 = prevComp(d0.getFullYear(), d0.getMonth() + 1); // mês padrão do painel
const C1 = prevComp(+C2.slice(0, 4), +C2.slice(5, 7));
const last = c => new Date(+c.slice(0, 4), +c.slice(5, 7), 0).getDate();
// dados
const rows = [];
const doc = (collection, id, data) => rows.push({ owner: 'u1', collection, id, data, updated_at: '' });
doc('clientes', 'silvia', { nome: 'Silvia Salgados', status: 'ativo', servicos: ['trafego', 'social'], segmento: 'Salgados', metas: { cplMaxCentavos: 1000, roasMin: 4, margemPct: 35, leadsMin: 100 } });
doc('clientes', 'clinica', { nome: 'Clínica Bella', status: 'ativo', servicos: ['trafego'], segmento: 'Estética' });
doc('clientes', 'novo', { nome: 'Studio Novo', status: 'ativo', servicos: ['trafego'] });
doc('clientes', 'garcia', { nome: 'Garcia Marketing', status: 'ativo', servicos: ['social'], interno: true });
const mes = (cli, comp, R, Cm, camps) => {
  const id = `${cli}_${comp}`;
  doc('relatorios', id, { clienteId: cli, competencia: comp, periodoInicio: `${comp}-01`, periodoFim: `${comp}-${last(comp)}`, resumo: R });
  if (Cm) doc('resultados_comerciais', id, { clienteId: cli, relatorioId: id, competencia: comp, ...Cm });
  (camps || []).forEach((c, i) => doc('campanhas', `${id}_c${i}`, { clienteId: cli, relatorioId: id, competencia: comp, ...c }));
};
mes('silvia', C1, { investimentoCentavos: 90000, impressoes: 60000, alcance: 25000, cliquesLink: 900, tipoResultado: 'conversas', resultados: 85 }, { leadsQualificados: 40, vendasAtribuidas: 18, receitaAtribuidaCentavos: 360000, faturamentoTotalCentavos: 1500000 });
mes('silvia', C2, { investimentoCentavos: 120000, impressoes: 80000, alcance: 30000, cliquesLink: 1400, tipoResultado: 'conversas', resultados: 110, orcamentoDiarioCentavos: 4000 },
  { leadsQualificados: 55, vendasAtribuidas: 25, receitaAtribuidaCentavos: 540000, faturamentoTotalCentavos: 1800000, custosExtrasCentavos: 60000 },
  [{ nome: 'Mensagens', tipoResultado: 'conversas', resultados: 100, investimentoCentavos: 100000 }, { nome: 'Cadastro', tipoResultado: 'leads', resultados: 10, investimentoCentavos: 20000 }]);
mes('clinica', C2, { investimentoCentavos: 200000, impressoes: 150000, alcance: 60000, cliquesLink: 1800, tipoResultado: 'conversas', resultados: 120 }, { vendasAtribuidas: 8, receitaAtribuidaCentavos: 960000 });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ body: 'window.pdfMake={}', contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8772/'); await p.evaluate(r => { localStorage.clear(); localStorage.setItem('fakeSupaRows', JSON.stringify(r)); }, rows); await p.reload(); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(500);
  await p.selectOption('#clientSelect', '__nenhum'); await W(150);
  await p.click('nav >> text=Visão geral'); await W(400);
  const v = (await p.textContent('#view')).replace(/\u00a0/g, ' ');
  ok('abre em Todos os clientes', v.includes('Todos os clientes') && v.includes('Números somados'));
  ok('investimento da carteira = 1.200 + 2.000', v.includes('R$ 3.200,00'));
  ok('faturamento dos anúncios da carteira = 5.400 + 9.600', v.includes('R$ 15.000,00'));
  ok('perfil interno fora da tabela', !(await p.textContent('table.carteira')).includes('Garcia Marketing'));
  ok('cliente sem lançamento aparece na tabela', (await p.textContent('table.carteira')).includes('Sem lançamento no período'));
  ok('selo de metas da Sílvia em atenção (CPL 10,91 vs meta 10)', (await p.locator('tr', { hasText: 'Silvia Salgados' }).locator('.saude').getAttribute('class')).includes('perto'));
  ok('gráfico investimento × faturamento', await p.locator('.chart svg rect').count() >= 3);
  ok('sem [object Object]', !v.includes('[object'));
  await p.screenshot({ path: OUT + '/30-visao-todos.png', fullPage: true });
  // ordenar por ROAS
  await p.click('table.carteira th >> text=ROAS'); await W(200);
  ok('ordena por ROAS (maior primeiro)', (await p.locator('table.carteira tbody tr').first().textContent()).includes('Clínica Bella'));
  // abrir cliente
  await p.click('table.carteira tbody tr >> text=Silvia Salgados'); await W(400);
  const c = (await p.textContent('#view')).replace(/\u00a0/g, ' ');
  ok('abre a visão do cliente', c.includes('Silvia Salgados') && c.includes('Investimento e alcance') && c.includes('Funil'));
  ok('seletor do menu acompanha o cliente', (await p.$eval('#clientSelect', s => s.options[s.selectedIndex].text)) === 'Silvia Salgados');
  ok('conversas e leads separados', c.includes('Conversas iniciadas') && c.includes('Leads gerados'));
  ok('orçamento diário informado', c.includes('R$ 40,00'));
  ok('CPL = 1.200 ÷ 110', c.includes('R$ 10,91'));
  ok('CAC = (1.200 + 600) ÷ 25', c.includes('R$ 72,00'));
  ok('lucro estimado = 35% × 5.400 − 1.200 − 600', c.includes('R$ 90,00'));
  ok('faturamento geral', c.includes('R$ 18.000,00'));
  ok('meta de CPL em atenção', await p.locator('.kpi.kpi-meta-perto').count() >= 1);
  ok('funil tem 7 etapas', await p.locator('.funil-etapa').count() === 7);
  ok('sem [object Object] no cliente', !c.includes('[object'));
  await p.screenshot({ path: OUT + '/31-visao-cliente.png', fullPage: true });
  // metas
  await p.click('.page-head >> text=Editar metas'); await W(200);
  await p.fill('#gf-cplMaxCentavos', '12,00'); await p.fill('#gf-ctrMin', '1,5'); await p.fill('#gf-margemPct', '150');
  await p.click('form.drawer button[type=submit]'); await W(200);
  ok('valida margem acima de 100%', (await p.textContent('#gf-e-margemPct')).includes('entre 0 e 100'));
  await p.fill('#gf-margemPct', '35'); await p.click('form.drawer button[type=submit]'); await W(500);
  ok('metas salvas e CTR avaliado', (await p.textContent('.metas')).includes('CTR mínimo'));
  ok('CPL 10,91 dentro da nova meta de 12', (await p.locator('.metas li', { hasText: 'CPL máximo' }).getAttribute('class')) === 'ok');
  // por cliente sem cliente → lista
  await p.selectOption('#clientSelect', '__nenhum'); await W(300);
  ok('Por cliente sem cliente mostra a lista', await p.locator('.pick').count() === 3);
  await p.click('.pick >> text=Clínica Bella'); await W(300);
  ok('lucro sem margem explica o motivo', (await p.textContent('#view')).includes('Cadastre a margem de lucro'));
  // celular
  await p.setViewportSize({ width: 390, height: 844 }); await W(300);
  ok('sem rolagem lateral no celular (cliente)', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/32-visao-cliente-celular.png', fullPage: true });
  await p.click('.seg >> text=Todos os clientes'); await W(300);
  ok('sem rolagem lateral no celular (todos)', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/33-visao-todos-celular.png', fullPage: true });
  ok('sem erros de script', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} verificações passaram, ${fail} falharam.`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
