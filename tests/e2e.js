// Teste de ponta a ponta do painel com Supabase simulado. Rodar: node tests/e2e.js
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const PDFMAKE = '/tmp/claude-0/-home-claude/4df1c94e-940a-5836-aa39-6f6831511b00/scratchpad/npm/x/pdfmake-0.2.10/package/build/pdfmake.min.js';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/js/config.js') { res.setHeader('content-type', 'text/javascript'); return res.end('window.GARCIA_CONFIG={supabaseUrl:"https://teste.supabase.co",supabaseKey:"x",nome:"Marya"};'); }
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(8770);
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ path: PDFMAKE, contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8770/'); await W(300);
  ok('mostra login', await p.isVisible('#lgEmail'));
  await p.screenshot({ path: OUT + '/01-login.png' });
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'errada'); await p.click('.auth-form button'); await W(150);
  ok('senha errada recusada', (await p.textContent('.auth-form .err-text')).includes('incorretos'));
  await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(400);
  ok('entra no Início', (await p.textContent('h1.hello')).includes('Marya'));
  // cliente
  await p.click('nav >> text=Clientes'); await W(150);
  await p.click('text=Novo cliente'); await p.fill('#cf-nome', 'Silvia Salgados'); await p.selectOption('#cf-objetivo', 'mensagens');
  await p.check('input[name=servicos][value=trafego]'); await p.check('input[name=servicos][value=social]');
  await p.fill('#cf-mensalidade', '1.200,00'); await p.fill('#cf-diaVencimento', '40'); await p.click('form.drawer button[type=submit]'); await W(150);
  ok('valida dia de vencimento', (await p.textContent('#e-diaVencimento')).includes('entre 1 e 31'));
  await p.fill('#cf-diaVencimento', String(new Date().getDate())); await p.fill('#cf-instagram', '@silviasalgadosbnu'); await p.fill('#cf-email', 'x@'); await p.click('form.drawer button[type=submit]'); await W(150);
  ok('valida e-mail', (await p.textContent('#e-email')).includes('inválido'));
  await p.fill('#cf-email', ''); await p.click('form.drawer button[type=submit]'); await W(400);
  ok('cliente na lista com serviços', (await p.textContent('table')).includes('Social media'));
  // tarefa
  await p.click('nav >> text=Início'); await W(200);
  await p.click('.home-head >> text=Nova tarefa'); await p.fill('#tfTitulo', 'Enviar relatório da Silvia'); await p.click('form.dialog button[type=submit]'); await W(300);
  ok('tarefa aparece para hoje', (await p.textContent('.tasks')).includes('Enviar relatório'));
  ok('receita recorrente', (await p.textContent('.hcard.dark')).includes('1.200,00'));
  ok('vencimento hoje listado', (await p.textContent('.hcard.dark')).includes('hoje'));
  await p.screenshot({ path: OUT + '/02-inicio.png', fullPage: true });
  await p.click('.task input[type=checkbox]'); await W(300);
  ok('tarefa concluída sai da lista', (await p.textContent('.home-main')).includes('Tudo em dia'));
  // tráfego: importar mensal e diário
  await p.click('nav >> text=Lançar dados do mês'); await W(150);
  await p.selectOption('#compMes', '9'); await p.selectOption('#compAno', '2026'); await W(150);
  await p.click('text=Criar relatório de setembro de 2026'); await W(300);
  await p.setInputFiles('#metaCsv', path.join(__dirname, 'fixtures/meta-campanhas-set2026.csv')); await W(300);
  await p.click('.drawer .btn-primary'); await W(500);
  ok('campanhas importadas', (await p.textContent('tfoot')).includes('661,64'));
  await p.click('nav >> text=Calendário diário'); await W(200);
  await p.setInputFiles('#metaCsvDia2', path.join(__dirname, 'fixtures/meta-diario-anuncios-set-out2026.csv')); await W(300);
  await p.click('.drawer .btn-primary'); await W(1200);
  await p.click('.dialog .btn-primary').catch(() => {}); await W(200);
  ok('calendário com dados', (await p.textContent('.period-note')).includes('05/09/2026'));
  ok('cartões do calendário sem [object Object]', !(await p.textContent('#view')).includes('[object'));
  // imagem do criativo
  const row = p.locator('tr', { hasText: '02 - [COMBO 02]' }).first();
  await row.locator('input[type=file]').setInputFiles('/tmp/claude-0/-home-claude/4df1c94e-940a-5836-aa39-6f6831511b00/scratchpad/t/criativo.png'); await W(800);
  ok('imagem do criativo salva', await p.locator('img.thumb').count() > 0);
  // PDF do período
  const dl = p.waitForEvent('download');
  await p.click('text=Gerar PDF do período'); await W(100); await p.click('.dialog .btn-primary');
  const d = await dl; await d.saveAs(OUT + '/periodo.pdf');
  ok('PDF baixado', fs.statSync(OUT + '/periodo.pdf').size > 20000);
  // persistência
  await p.reload(); await W(500);
  ok('continua logada após recarregar', !(await p.isVisible('#lgEmail')) && await p.isVisible('#side'));
  await p.click('nav >> text=Visão geral'); await W(300);
  ok('visão geral sem [object Object]', !(await p.textContent('#view')).includes('[object'));
  await p.selectOption('#clientSelect', '__nenhum'); await W(200);
  ok('visão geral com Nenhum mostra todos os clientes', (await p.textContent('#view')).includes('Todos os clientes') && (await p.textContent('#view')).includes('Silvia Salgados'));
  for (const v of ['Visão geral', 'Calendário diário', 'Campanhas', 'Conjuntos de anúncios', 'Anúncios e criativos', 'Análise estratégica', 'Lançar dados do mês', 'Relatórios mensais', 'Histórico']) { await p.click(`nav >> text=${v}`); await W(150); }
  ok('todas as telas de tráfego abrem sem cliente', (await p.textContent('#view')).includes('Nenhum cliente selecionado') && errs.length === 0);
  await p.selectOption('#clientSelect', { label: 'Silvia Salgados' }); await W(300);
  await p.click('nav >> text=Conjuntos de anúncios'); await W(300);
  ok('dados persistem após recarregar', (await p.textContent('#view')).includes('[ADV]'));
  await p.click('nav >> text=Anúncios e criativos'); await W(300);
  await p.screenshot({ path: OUT + '/03-anuncios.png', fullPage: true });
  // backup
  await p.click('nav >> text=Dados e backup'); await W(200);
  const dl2 = p.waitForEvent('download'); await p.click('text=Exportar backup completo (JSON)'); const bk = await dl2; await bk.saveAs(OUT + '/backup.json');
  const B = JSON.parse(fs.readFileSync(OUT + '/backup.json', 'utf8'));
  ok('backup inclui tarefas e diários', B.colecoes.tarefas.length === 1 && B.colecoes.diarios.length === 2);
  // mobile
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('#menuBtn'); await p.click('nav >> text=Início'); await W(250);
  ok('sem rolagem lateral no celular', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.screenshot({ path: OUT + '/04-inicio-celular.png', fullPage: true });
  await p.setViewportSize({ width: 1366, height: 900 });
  // sair
  await p.click('text=Sair'); await W(300);
  ok('sair volta ao login', await p.isVisible('#lgEmail'));
  ok('sem erros de script', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} verificações passaram, ${fail} falharam.`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
