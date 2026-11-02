// Otimizações: calendário geral e registro. Rodar: node tests/e2e-otm.js
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
}).listen(8773);
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const pad = n => String(n).padStart(2, '0');
const d0 = new Date(); const prevComp = (y, m) => m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
const C2 = prevComp(d0.getFullYear(), d0.getMonth() + 1); // mês padrão do painel
const C1 = prevComp(+C2.slice(0, 4), +C2.slice(5, 7));
const last = c => new Date(+c.slice(0, 4), +c.slice(5, 7), 0).getDate();

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const HOJE = dia(0);
const rows = [];
const doc = (collection, id, data) => rows.push({ owner: 'u1', collection, id, data, updated_at: '' });
doc('clientes', 'silvia', { nome: 'Silvia Salgados', status: 'ativo', servicos: ['trafego'] });
doc('clientes', 'clinica', { nome: 'Clínica Bella', status: 'ativo', servicos: ['trafego'] });
doc('clientes', 'novo', { nome: 'Studio Novo', status: 'ativo', servicos: ['trafego'] });
doc('clientes', 'garcia', { nome: 'Garcia Marketing', status: 'ativo', servicos: ['trafego'], interno: true });
doc('otimizacoes', 'o1', { clienteId: 'silvia', data: dia(-5), proxima: dia(-2), otimizado: true, campanhas: 'Subi orçamento para R$ 40/dia', anotacoes: 'Vídeo do preparo converte melhor', criadoEm: '1' });
doc('otimizacoes', 'o2', { clienteId: 'clinica', data: dia(-1), proxima: dia(2), otimizado: true, conjuntos: 'Pausei conjunto aberto', criadoEm: '2' });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ body: 'window.pdfMake={}', contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8773/'); await p.evaluate(r => { localStorage.clear(); localStorage.setItem('fakeSupaRows', JSON.stringify(r)); }, rows); await p.reload(); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(500);
  ok('contador no menu (1 atrasada)', (await p.textContent('nav a[href="#otimizacoes"] .nav-n.alerta')).trim() === '1');
  await p.click('nav >> text=Otimizações'); await W(400);
  const v = await p.textContent('#view');
  ok('abre a tela', v.includes('Registro de otimizações') && v.includes('Contas.'));
  ok('perfil interno fora', !(await p.textContent('table.otm-contas')).includes('Garcia Marketing'));
  ok('atrasada primeiro', (await p.locator('table.otm-contas tbody tr').first().textContent()).includes('Silvia Salgados') && (await p.locator('table.otm-contas tbody tr').first().textContent()).includes('Atrasada'));
  ok('conta sem otimização = sem próxima data', (await p.locator('table.otm-contas tr', { hasText: 'Studio Novo' }).textContent()).includes('Sem próxima data'));
  if (dia(-5).slice(0, 7) === HOJE.slice(0, 7)) ok('otimização feita no calendário', await p.locator('.ec-grid .ochip.feita').count() >= 1);
  if (dia(-2).slice(0, 7) === HOJE.slice(0, 7)) ok('próxima atrasada no calendário', await p.locator('.ec-grid .ochip.late').count() >= 1);
  ok('histórico com 2 registros', await p.locator('table.otm-hist tbody tr').count() === 2);
  await p.screenshot({ path: OUT + '/40-otimizacoes.png', fullPage: true });
  // registrar a otimização da Sílvia
  await p.locator('table.otm-contas tr', { hasText: 'Silvia Salgados' }).locator('button').click(); await W(200);
  ok('formulário vem com cliente e data de hoje', (await p.inputValue('#gf-clienteId')) === 'silvia' && (await p.inputValue('#gf-data')) === HOJE);
  ok('próxima sugerida pelo intervalo anterior (3 dias)', (await p.inputValue('#gf-proxima')) === dia(3));
  await p.fill('#gf-campanhas', 'Dupliquei a campanha de mensagens'); await p.fill('#gf-anuncios', 'Subi 2 vídeos novos');
  await p.fill('#gf-proxima', dia(-1)); await p.click('form.drawer button[type=submit]'); await W(200);
  ok('valida próxima antes da data', (await p.textContent('#gf-e-proxima')).includes('depois da data'));
  await p.fill('#gf-proxima', dia(3)); await p.click('form.drawer button[type=submit]'); await W(500);
  ok('Sílvia em dia após registrar', (await p.locator('table.otm-contas tr', { hasText: 'Silvia Salgados' }).textContent()).includes('Em dia'));
  ok('contador some do menu', await p.locator('nav a[href="#otimizacoes"] .nav-n').count() === 0);
  ok('histórico com 3 registros', await p.locator('table.otm-hist tbody tr').count() === 3);
  // planejar para o Studio
  await p.click('.page-head >> text=Registrar otimização'); await W(150);
  await p.selectOption('#gf-clienteId', 'novo'); await p.fill('#gf-data', dia(1)); await p.uncheck('#gf-otimizado'); await p.fill('#gf-proxima', '');
  await p.click('form.drawer button[type=submit]'); await W(500);
  ok('planejada define a próxima do Studio', (await p.locator('table.otm-contas tr', { hasText: 'Studio Novo' }).textContent()).includes(dia(1).split('-').reverse().join('/')));
  // marcar como otimizado direto no histórico
  const linha = p.locator('table.otm-hist tbody tr', { hasText: 'Studio Novo' });
  await linha.locator('input[type=checkbox]').check(); await W(400);
  ok('checkbox Otimizado grava (data futura vira hoje)', await p.evaluate(h => JSON.parse(localStorage.getItem('fakeSupaRows')).some(r => r.collection === 'otimizacoes' && r.data.clienteId === 'novo' && r.data.otimizado && r.data.data === h), HOJE));
  // busca
  await p.fill('#otmBusca', 'vídeos novos'); await W(250);
  ok('busca no histórico', await p.locator('table.otm-hist tbody tr').count() === 1);
  await p.fill('#otmBusca', ''); await W(200);
  ok('sem [object Object]', !(await p.textContent('#view')).includes('[object'));
  await p.screenshot({ path: OUT + '/41-otimizacoes-depois.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 }); await W(300);
  ok('sem rolagem lateral no celular', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/42-otimizacoes-celular.png', fullPage: true });
  ok('sem erros de script', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} verificações passaram, ${fail} falharam.`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
