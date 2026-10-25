// Restaura o arquivo de importação do Notion no Supabase simulado e confere as telas. Rodar: node tests/notion-import.js
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
const S = '/tmp/claude-0/-home-claude/4df1c94e-940a-5836-aa39-6f6831511b00/scratchpad/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/js/config.js') { res.setHeader('content-type', 'text/javascript'); return res.end('window.GARCIA_CONFIG={supabaseUrl:"https://t.supabase.co",supabaseKey:"x",nome:"Marya"};'); }
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(8772);
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8772/'); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(400);
  for (const f of ['garcia-migracao-2026-10-24.json', 'garcia-notion-2026-10-24.json']) {
    await p.click('nav >> text=Dados e backup'); await W(200);
    await p.setInputFiles('#restoreFile', S + f); await W(300);
    await p.click('#restoreGo'); await p.click('.dialog .btn-danger'); await W(2500); if (await p.isVisible('.dialog')) { console.log('DIALOG:', await p.textContent('.dialog')); await p.click('.dialog >> text=Cancelar'); }
  }
  await p.click('nav >> text=Clientes'); await W(200);
  ok('dois clientes', (await p.textContent('.seg')).includes('Ativos (2)'));
  await p.click('nav >> text=Calendário editorial'); await W(300);
  ok('outubro com posts da Garcia', (await p.textContent('.ec-grid')).includes('Antes de colocar dinheiro'));
  await p.screenshot({ path: OUT + '/20-notion-calendario.png', fullPage: true });
  await p.click('.ec-grid .pchip >> text=Antes de colocar dinheiro'); await W(200);
  ok('conteúdo do post', (await p.textContent('.drawer')).includes('Slide 7'));
  await p.screenshot({ path: OUT + '/21-notion-post.png' });
  await p.click('.drawer >> text=Fechar');
  await p.click('nav >> text=Produção'); await W(300);
  ok('59 posts no quadro', await p.locator('.bcard').count() === 59);
  await p.click('nav >> text=Planejamento do mês'); await W(200);
  await p.selectOption('#planCli', { label: 'Silvia Salgados' }); await W(150);
  await p.click('.mes-nav button[aria-label="Mês anterior"]'); await W(200);
  ok('planejamento de setembro da Silvia', (await p.textContent('#view')).includes('Combos (salgados + docinhos)'));
  await p.click('nav >> text=Processos'); await W(300);
  ok('jornada abre primeiro', (await p.textContent('.doc h2')).includes('Jornada'));
  await p.screenshot({ path: OUT + '/22-notion-jornada.png', fullPage: true });
  await p.click('.doc-link >> text=SOP 06'); await W(200);
  await p.screenshot({ path: OUT + '/23-notion-sop.png', fullPage: true });
  ok('SOP com tabela e caixinhas', await p.locator('.doc .md table').count() >= 1 && await p.locator('.doc .md-checks input').count() > 10);
  await p.click('.doc-link >> text=Script de abordagem'); await W(200);
  ok('mensagens em bloco', await p.locator('.doc .md-pre').count() >= 5);
  await p.click('nav >> text=Financeiro'); await p.click('.tabs >> text=Reserva'); await W(200);
  ok('reservas do Notion', (await p.textContent('.res-grid')).includes('Reinvestimento'));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} ok, ${fail} falharam`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
