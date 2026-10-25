// Teste de ponta a ponta das áreas da agência (social media, financeiro, comercial, processos). Rodar: node tests/e2e-agencia.js
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
}).listen(8771);
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const pad = n => String(n).padStart(2, '0');
const d0 = new Date(); const HOJE = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
const BR = iso => iso.split('-').reverse().join('/');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ path: path.join(__dirname, 'fake-supabase.js'), contentType: 'text/javascript' }));
  await p.route('**/pdfmake@*/**', r => r.fulfill({ path: PDFMAKE, contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8771/'); await W(300);
  await p.fill('#lgEmail', 'marya@teste.com'); await p.fill('#lgSenha', 'senha123'); await p.click('.auth-form button'); await W(400);
  // clientes
  const novoCliente = async (nome, extra) => {
    await p.click('nav >> text=Clientes'); await W(150); await p.click('text=Novo cliente'); await p.fill('#cf-nome', nome);
    await extra(); await p.click('form.drawer button[type=submit]'); await W(300);
  };
  await novoCliente('Silvia Salgados', async () => { await p.check('input[name=servicos][value=social]'); await p.fill('#cf-mensalidade', '1.200,00'); await p.fill('#cf-diaVencimento', '5'); });
  await novoCliente('Garcia Marketing', async () => { await p.check('input[name=interno]'); await p.check('input[name=servicos][value=social]'); });
  ok('perfil próprio não conta como cliente', (await p.textContent('.seg')).includes('Ativos (2)'));
  await p.click('nav >> text=Início'); await W(200);
  ok('Início conta só clientes pagantes', (await p.textContent('.hcard.accent .hcard-v')).trim() === '1');

  // social: novo post no dia de hoje
  await p.click('nav >> text=Calendário editorial'); await W(200);
  await p.click('.page-head >> text=Novo post'); await W(100);
  await p.selectOption('#gf-clienteId', { label: 'Silvia Salgados' });
  await p.fill('#gf-titulo', 'Combo 1 ou Combo 2'); await p.selectOption('#gf-tipoFeed', 'carrossel'); await p.fill('#gf-numero', '1');
  await p.fill('#gf-data', HOJE); await p.selectOption('#gf-pilar', 'conversao');
  await p.click('form.drawer button[type=submit]'); await W(300);
  ok('post aparece no calendário', (await p.textContent('.ec-grid')).includes('Combo 1 ou Combo 2'));
  await p.click('.ec-grid .pchip'); await W(200);
  ok('post abre com o modelo de conteúdo', (await p.textContent('.drawer')).includes('Ideia definida'));
  await p.locator('.drawer .md-checks input').first().check(); await W(300);
  await p.click('.drawer >> text=Fechar'); await W(150);
  // reels sem tipo de feed
  await p.click('.page-head >> text=Novo post'); await p.selectOption('#gf-clienteId', { label: 'Garcia Marketing' }); await p.fill('#gf-titulo', 'Bastidores');
  await p.selectOption('#gf-formato', 'reels'); await p.selectOption('#gf-tipoFeed', 'estatico'); await p.click('form.drawer button[type=submit]'); await W(150);
  ok('valida tipo de feed em reels', (await p.textContent('#gf-e-tipoFeed')).includes('Só posts de feed'));
  await p.selectOption('#gf-tipoFeed', ''); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('post sem data listado à parte', (await p.textContent('#view')).includes('Sem data definida (1)'));
  await p.screenshot({ path: OUT + '/10-calendario-editorial.png', fullPage: true });
  // produção
  await p.click('nav >> text=Produção'); await W(250);
  ok('quadro mostra progresso do checklist', await p.locator('.bcard .bar').count() >= 1);
  const colIdeias = p.locator('.board-col[data-st=ideia]');
  ok('posts novos começam em Ideias', (await colIdeias.textContent()).includes('Combo 1'));
  await colIdeias.locator('.bcard', { hasText: 'Combo 1' }).locator('button[aria-label^="Avançar"]').click(); await W(300);
  ok('seta move para Conteúdo', (await p.locator('.board-col[data-st=conteudo]').textContent()).includes('Combo 1'));
  await p.dragAndDrop('.board-col[data-st=conteudo] .bcard', '.board-col[data-st=revisao]'); await W(300);
  ok('arrastar move para Revisão', (await p.locator('.board-col[data-st=revisao]').textContent()).includes('Combo 1'));
  await p.screenshot({ path: OUT + '/11-producao.png', fullPage: true });
  // planejamento
  await p.click('nav >> text=Planejamento do mês'); await W(200);
  await p.click('text=Criar planejamento'); await p.fill('#gf-objetivo', 'Ser mais conhecida em Blumenau'); await p.fill('#gf-qtdFeed', '13'); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('planejamento salvo', (await p.textContent('#view')).includes('Ser mais conhecida') && (await p.textContent('#view')).includes('Planejado: 13'));

  // financeiro
  await p.click('nav >> text=Financeiro'); await W(250);
  ok('avisa mensalidade não lançada', (await p.textContent('.banner.warn')).includes('Falta 1 lançamento') && (await p.textContent('.banner.warn')).includes('1 mensalidade de cliente ativo'));
  await p.click('.banner.warn >> text=Gerar agora'); await W(400);
  ok('mensalidade gerada sem o perfil próprio', (await p.textContent('.kpis-row')).includes('1.200,00'));
  await p.click('.tabs >> text=Cobranças'); await W(150);
  ok('cobrança da Silvia na lista', (await p.textContent('table.data')).includes('Mensalidade Silvia Salgados'));
  await p.click('text=Marcar recebido'); await W(300);
  ok('marcada como recebida', (await p.textContent('table.data')).includes('Pago'));
  await p.click('.page-head >> text=Nova despesa'); await p.fill('#gf-descricao', 'Canva'); await p.fill('#gf-valorCentavos', '0'); await p.click('form.drawer button[type=submit]'); await W(150);
  ok('valida valor da despesa', (await p.textContent('#gf-e-valorCentavos')).includes('maior que zero'));
  await p.fill('#gf-valorCentavos', '34,90'); await p.selectOption('#gf-categoria', 'ferramentas'); await p.click('form.drawer button[type=submit]'); await W(300);
  await p.click('.tabs >> text=Resumo'); await W(150);
  ok('resultado previsto calculado', (await p.textContent('.kpis-row')).includes('1.165,10'));
  await p.click('.tabs >> text=Despesas fixas'); await p.click('text=Nova despesa fixa'); await p.fill('#gf-descricao', 'Contador'); await p.fill('#gf-valorCentavos', '150,00'); await p.fill('#gf-dia', '15'); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('despesa fixa entra no aviso do mês', (await p.textContent('.banner.warn')).includes('1 despesa fixa'));
  await p.click('.tabs >> text=Reserva'); await p.click('text=Nova finalidade'); await p.fill('#gf-finalidade', 'Reserva operacional'); await p.fill('#gf-atualCentavos', '500,00'); await p.fill('#gf-metaCentavos', '2.000,00'); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('reserva com progresso', /25% de R\$\s2\.000,00/.test(await p.textContent('.res-grid')));
  await p.click('.tabs >> text=Fluxo de caixa'); await W(150);
  ok('fluxo de caixa mostra entradas do mês', (await p.textContent('table.data')).includes('1.200,00'));
  await p.screenshot({ path: OUT + '/12-financeiro.png', fullPage: true });

  // comercial
  await p.click('nav >> text=Comercial'); await W(200);
  await p.click('.empty >> text=Nova oportunidade'); await p.fill('#gf-empresa', 'Clínica Bela'); await p.fill('#gf-responsavel', 'Ana'); await p.fill('#gf-whatsapp', '(47) 99999-0000');
  await p.selectOption('#gf-servico', 'trafego'); await p.fill('#gf-valorPropostaCentavos', '1.500,00'); await p.fill('#gf-valorMensalCentavos', '1.500,00'); await p.fill('#gf-proximoFollowup', HOJE);
  await p.click('form.drawer button[type=submit]'); await W(300);
  ok('oportunidade no quadro', (await p.locator('.board-col[data-st=prospeccao]').textContent()).includes('Clínica Bela'));
  ok('follow-up de hoje contado', (await p.textContent('.kpis-row')).includes('Follow-ups para hoje1'));
  await p.click('nav >> text=Início'); await W(200);
  ok('follow-up aparece no Início', (await p.textContent('.home-side')).includes('Clínica Bela'));
  await p.click('nav >> text=Comercial'); await W(200);
  await p.click('text=Com fechados e perdidos'); await W(150);
  await p.click('.board-col[data-st=prospeccao] .bcard-open'); await W(200);
  await p.click('.drawer >> text=Editar'); await p.selectOption('#gf-status', 'fechado'); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('lead fechado vai para a coluna Fechado', (await p.locator('.board-col[data-st=fechado]').textContent()).includes('Clínica Bela'));
  await p.click('.board-col[data-st=fechado] .bcard-open'); await W(200);
  await p.click('text=Cadastrar como cliente'); await W(500);
  await p.click('nav >> text=Clientes'); await W(200);
  ok('lead fechado virou cliente', (await p.textContent('table')).includes('Clínica Bela'));

  // processos
  await p.click('nav >> text=Processos'); await W(200);
  await p.click('.empty >> text=Novo documento'); await p.fill('#gf-titulo', 'Checklist de onboarding'); await p.selectOption('#gf-categoria', 'checklist');
  await p.fill('#gf-conteudo', '## Fechamento\n\n- [ ] Contrato enviado\n- [ ] Contrato assinado\n\n| Item | Regra |\n| --- | --- |\n| Prazo | 1 dia útil |\n\nVer **política** em https://exemplo.com.br/politica');
  await p.click('form.drawer button[type=submit]'); await W(300);
  ok('documento renderiza tabela e link', await p.locator('.doc .md table').count() === 1 && await p.locator('.doc .md a[href="https://exemplo.com.br/politica"]').count() === 1);
  await p.locator('.doc .md-checks input').first().check(); await W(300);
  ok('caixinha marcada fica salva', (await p.textContent('.doc-progress')).includes('1 de 2'));
  await p.click('text=Usar com um cliente'); await p.selectOption('#ucCli', { label: 'Silvia Salgados' }); await p.click('.dialog >> text=Criar cópia'); await W(400);
  ok('cópia por cliente criada desmarcada', (await p.textContent('.doc-nav')).includes('Em andamento por cliente') && (await p.textContent('.doc-progress')).includes('0 de 2'));
  await p.screenshot({ path: OUT + '/13-processos.png', fullPage: true });
  // segurança do texto: HTML não é interpretado
  await p.click('.doc-head >> text=Editar'); await p.fill('#gf-conteudo', '<img src=x onerror="window.__xss=1"> [link](javascript:alert(1))'); await p.click('form.drawer button[type=submit]'); await W(300);
  ok('HTML e javascript: não são executados', !(await p.evaluate(() => window.__xss)) && await p.locator('.doc .md a').count() === 0);

  // Início completo e celular
  await p.click('nav >> text=Início'); await W(250);
  ok('Início com 4 cartões', await p.locator('.hcard').count() === 4);
  ok('cartão financeiro mostra recebido', (await p.textContent('.hcards')).includes('1.200,00'));
  await p.screenshot({ path: OUT + '/14-inicio-completo.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 });
  for (const sec of ['Início', 'Comercial', 'Financeiro', 'Processos', 'Calendário editorial', 'Produção', 'Planejamento do mês']) {
    await p.click('#menuBtn'); await p.click(`nav >> text=${sec}`); await W(250);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(`celular sem rolagem lateral: ${sec}`, sw <= 390);
    if (sec === 'Calendário editorial' || sec === 'Financeiro') await p.screenshot({ path: OUT + `/15-celular-${sec.split(' ')[0]}.png`, fullPage: true });
  }
  ok('sem erros de script', errs.length === 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} verificações passaram, ${fail} falharam.`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
