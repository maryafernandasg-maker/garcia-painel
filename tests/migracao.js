// Restaura o arquivo de migração no painel novo (Supabase simulado) e confere os dados.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..'), MIG = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/js/config.js') { res.setHeader('content-type', 'text/javascript'); return res.end('window.GARCIA_CONFIG={supabaseUrl:"https://teste.supabase.co",supabaseKey:"x",nome:"Marya"};'); }
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(8771);
const W = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8771/'); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(400);
  await p.click('nav >> text=Dados e backup'); await W(200);
  await p.setInputFiles('#restoreFile', MIG); await W(300);
  console.log('prévia:', await p.textContent('#restoreStatus'));
  await p.click('#restoreGo'); await p.click('.dialog .btn-danger'); await W(1500);
  console.log('após:', await p.textContent('#restoreStatus'));
  await p.click('nav >> text=Visão geral'); await p.selectOption('#compMes', '9'); await W(300);
  console.log('visão set:', (await p.textContent('.kpis')).replace(/\s+/g, ' ').slice(0, 220));
  await p.click('nav >> text=Calendário diário'); await W(300);
  console.log('instagram:', (await p.textContent('#instagram .kpis')).replace(/\s+/g, ' ').slice(0, 200));
  console.log('miniaturas:', await p.locator('img.thumb').count());
  await p.screenshot({ path: path.join(__dirname, 'out/05-migrado.png'), fullPage: true });
  console.log('erros:', errs);
  await b.close(); srv.close();
})();
