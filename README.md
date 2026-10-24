# Garcia Marketing · Painel

Painel interno da Garcia Marketing: clientes, tarefas, tráfego pago (Meta Ads), social media e financeiro.
Site estático (HTML, CSS e JavaScript, sem etapa de build) publicado no **Netlify**, com banco e login no **Supabase**. Tudo nos planos gratuitos.

## Como está organizado

| Pasta / arquivo | O que é |
|---|---|
| `index.html`, `css/app.css` | Estrutura e visual |
| `js/config.js` | Endereço do Supabase e chave pública (publishable/anon) |
| `js/core.js` | Cálculos, validações e importação dos arquivos do Meta (testado) |
| `js/store.js` | Conexão com o Supabase (login e banco) |
| `js/app.js`, `js/views.js`, `js/dias.js` | Telas de clientes e tráfego |
| `js/agencia.js` | Login, Início e tarefas |
| `js/pdf.js`, `js/charts.js`, `js/fonts.js` | Relatórios em PDF e gráficos |
| `supabase/schema.sql` | Estrutura do banco e regras de segurança |
| `tests/` | Testes automáticos (cálculos, importações e navegação) |

## Configuração (uma vez)

1. **Banco:** no Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
2. **Seu usuário:** em **Authentication → Users → Add user → Create new user**, informe seu e-mail e uma senha e marque **Auto Confirm User**.
3. **Fechar cadastros:** em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**. Assim só a sua conta existe.
4. **Chaves:** em `js/config.js`, preencha `supabaseUrl` e `supabaseKey` (publishable ou anon). Nunca use a service_role/secret key.
5. **Netlify:** **Add new site → Import an existing project → GitHub → garcia-painel**. Deixe *Build command* vazio e *Publish directory* como `.`. Clique em **Deploy**.
6. **Migração:** entre no painel, vá em **Dados e backup → Restaurar backup** e escolha o arquivo de migração.

## Segurança

- A tabela `docs` tem RLS ativo: cada registro pertence a um usuário e só ele lê e altera.
- Sem login, a chave pública não dá acesso a nenhum dado.
- Cadastros novos ficam desativados no Supabase.

## Testes

```
node tests/core.test.js && node tests/import.test.js && node tests/daily.test.js
node tests/e2e.js   # navegação completa com Supabase simulado (requer Playwright)
```
