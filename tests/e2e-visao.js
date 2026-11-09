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
doc('clientes', 'clinica', { nome: 'Clínica Bella', status: 'ativo', servicos: ['trafego'], segmento: 'Estética', plataformas: ['meta', 'google'] });
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
mes('clinica', C2, { investimentoCentavos: 200000, impressoes: 150000, alcance: 60000, cliquesLink: 1800, tipoResultado: 'conversas', resultados: 80 }, { vendasAtribuidas: 8, receitaAtribuidaCentavos: 960000 },
  [{ nome: 'Mensagens', plataforma: 'meta', tipoResultado: 'conversas', resultados: 80, investimentoCentavos: 120000, impressoes: 120000, cliquesLink: 1000, status: 'ACTIVE' }, { nome: '[PESQ] Estética Blumenau', plataforma: 'google', tipoResultado: 'leads', resultados: 40, investimentoCentavos: 80000, impressoes: 30000, cliquesLink: 800, status: 'ACTIVE' }]);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ body: 'window.pdfMake={}', contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8772/'); await p.evaluate(r => { localStorage.clear(); localStorage.setItem('fakeSupaRows', JSON.stringify(r)); }, rows); await p.reload(); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(500);
  await p.click('nav >> text=Dashboard'); await W(300);
  ok('dashboard abre no mês atual', await p.evaluate(() => UI.comp === Fmt.currentComp()));
  await p.evaluate(c => { UI.comp = c; render(); }, C2); await W(300);
  const T = async () => (await p.textContent('#view')).replace(/ /g, ' ');
  let v = await T();
  ok('dashboard com todos os clientes', v.includes('Faturamento × investimento × ROAS') && await p.locator('.dash-grid article.dcard').count() === 3);
  ok('total investido = 1.200 + 2.000', (await p.textContent('.dash-strip')).replace(/ /g, ' ').includes('R$ 3.200'));
  ok('faturamento total = 5.400 + 9.600', (await p.textContent('.dash-strip')).replace(/ /g, ' ').includes('R$ 15.000'));
  ok('perfil interno fora', !v.includes('Garcia Marketing'));
  ok('ordenado por faturamento (Clínica primeiro)', (await p.locator('.dash-grid article.dcard').first().textContent()).includes('Clínica Bella'));
  const clin = p.locator('article.dcard', { hasText: 'Clínica Bella' });
  ok('cartão com Meta e Google', await clin.locator('.plat.google').count() === 1 && (await clin.locator('.pleg').textContent()).replace(/ /g, ' ').includes('Google R$ 800,00'));
  ok('Sílvia só com Meta', await p.locator('article.dcard', { hasText: 'Silvia Salgados' }).locator('.plat').count() === 1);
  ok('cliente sem dados avisa', (await p.locator('article.dcard', { hasText: 'Studio Novo' }).textContent()).includes('Ligue a conta'));
  ok('sem [object Object]', !v.includes('[object'));
  await p.screenshot({ path: OUT + '/30-dashboard.png', fullPage: true });
  await p.selectOption('.sel-ordem', 'roas'); await W(200);
  ok('ordenar por ROAS', (await p.locator('.dash-grid article.dcard').first().textContent()).includes('Clínica Bella'));
  // dashboard da Sílvia
  await p.locator('article.dcard', { hasText: 'Silvia Salgados' }).locator('text=Dashboard ›').click(); await W(400);
  const c = await T();
  ok('abre o dashboard da cliente', c.includes('Investimento e alcance') && c.includes('Funil'));
  ok('abas só com Meta', (await p.textContent('.dash-tabs')).includes('Meta Ads') && !(await p.textContent('.dash-tabs')).includes('Google Ads'));
  ok('seletor do menu acompanha', (await p.$eval('#clientSelect', s => s.options[s.selectedIndex].text)) === 'Silvia Salgados');
  ok('CPL = 1.200 ÷ 110', c.includes('R$ 10,91'));
  ok('CAC = (1.200 + 600) ÷ 25', c.includes('R$ 72,00'));
  ok('lucro estimado', c.includes('R$ 90,00'));
  ok('menu marca Dashboard', (await p.textContent('nav a[aria-current=page]')).includes('Dashboard'));
  await p.screenshot({ path: OUT + '/31-dash-cliente.png', fullPage: true });
  await p.click('.page-head >> text=Editar metas'); await W(200);
  await p.fill('#gf-cplMaxCentavos', '12,00'); await p.fill('#gf-margemPct', '150'); await p.click('form.drawer button[type=submit]'); await W(200);
  ok('valida margem', (await p.textContent('#gf-e-margemPct')).includes('entre 0 e 100'));
  await p.fill('#gf-margemPct', '35'); await p.click('form.drawer button[type=submit]'); await W(500);
  ok('meta de CPL no alvo', (await p.locator('.metas li', { hasText: 'CPL máximo' }).getAttribute('class')) === 'ok');
  await p.click('.dash-tabs >> text=Campanhas'); await W(300);
  ok('aba Campanhas abre com as abas do cliente', await p.locator('.dash-tabs').count() === 1 && (await T()).includes('Mensagens'));
  await p.click('.dash-tabs >> text=Meta Ads'); await W(300);
  ok('aba Meta Ads', (await T()).includes('Tráfego pago · Meta Ads') && (await T()).includes('Cadastro'));
  // Clínica: Meta + Google
  await p.click('text=‹ Todos os clientes'); await W(300);
  await p.locator('article.dcard', { hasText: 'Clínica Bella' }).locator('text=Dashboard ›').click(); await W(400);
  ok('Meta × Google na visão geral', (await T()).includes('Meta × Google'));
  await p.click('.dash-tabs >> text=Google Ads'); await W(300);
  const g = await T();
  ok('aba Google Ads só com a campanha do Google', g.includes('[PESQ] Estética Blumenau') && !g.includes('>Mensagens<') && g.includes('R$ 800,00'));
  await p.screenshot({ path: OUT + '/32-dash-google.png', fullPage: true });
  // conexões
  await p.click('nav >> text=Conexões'); await W(300);
  ok('conexões lista as contas', (await T()).includes('Falta o ID da conta'));
  await p.locator('tr', { hasText: 'Studio Novo' }).locator('text=Editar').click(); await W(200);
  await p.uncheck('#gf-meta'); await p.check('#gf-google'); await p.fill('#gf-googleContaId', '123'); await p.click('form.drawer button[type=submit]'); await W(200);
  ok('valida ID do Google', (await p.textContent('#gf-e-googleContaId')).includes('123-456-7890'));
  await p.fill('#gf-googleContaId', '1234567890'); await p.click('form.drawer button[type=submit]'); await W(400);
  ok('Studio só Google, conta formatada', (await p.locator('tr', { hasText: 'Studio Novo' }).textContent()).includes('123-456-7890') && (await p.locator('tr', { hasText: 'Studio Novo' }).textContent()).includes('Não usa'));
  await p.screenshot({ path: OUT + '/33-conexoes.png', fullPage: true });
  // cadastro do cliente
  await p.click('nav >> text=Clientes'); await W(200); await p.click('text=Novo cliente'); await W(150);
  ok('cadastro tem plataformas e contas', await p.locator('input[name=plataformas]').count() === 2 && await p.locator('#cf-metaContaId').count() === 1);
  await p.keyboard.press('Escape'); await W(150);
  // celular
  await p.click('nav >> text=Dashboard').catch(() => {}); await p.evaluate(() => { UI.visaoModo = 'todos'; go('visao'); }); await W(300);
  await p.setViewportSize({ width: 390, height: 844 }); await W(300);
  ok('sem rolagem lateral no celular', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/34-dashboard-celular.png', fullPage: true });
  ok('sem erros de script', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} verificações passaram, ${fail} falharam.`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
