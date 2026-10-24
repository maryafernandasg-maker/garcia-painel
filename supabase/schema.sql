-- =====================================================================
-- Garcia Marketing · Painel — estrutura do banco (rodar uma vez no SQL Editor do Supabase)
-- Tabela única de documentos: cada registro pertence a um usuário (owner) e
-- as regras de segurança (RLS) só deixam cada usuário ver e alterar os próprios registros.
-- =====================================================================

create table if not exists public.docs (
  owner      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null check (char_length(collection) between 1 and 60),
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, collection, id)
);

-- índices para as buscas mais comuns (por coleção, por cliente e por relatório)
create index if not exists docs_colecao   on public.docs (owner, collection);
create index if not exists docs_cliente   on public.docs (owner, collection, (data->>'clienteId'));
create index if not exists docs_relatorio on public.docs (owner, collection, (data->>'relatorioId'));

-- segurança: ninguém acessa sem login, e cada conta só vê os próprios dados
alter table public.docs enable row level security;
alter table public.docs force row level security;

drop policy if exists "docs: ler os próprios"      on public.docs;
drop policy if exists "docs: criar os próprios"    on public.docs;
drop policy if exists "docs: alterar os próprios"  on public.docs;
drop policy if exists "docs: excluir os próprios"  on public.docs;

create policy "docs: ler os próprios"     on public.docs for select to authenticated using (owner = (select auth.uid()));
create policy "docs: criar os próprios"   on public.docs for insert to authenticated with check (owner = (select auth.uid()));
create policy "docs: alterar os próprios" on public.docs for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "docs: excluir os próprios" on public.docs for delete to authenticated using (owner = (select auth.uid()));

-- visitantes sem login não têm nenhuma permissão na tabela
revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;
