# Setup Supabase — Likes e Comentarios

Guia para habilitar likes e comentarios compartilhados entre usuarios nas oportunidades.
Usa Supabase (Postgres + API REST gerenciada). **Tier gratuito, sem cartao de credito.**

## 1. Criar conta e projeto

1. Acesse https://supabase.com/ e crie uma conta (pode ser com GitHub).
2. **New Project** → escolha um nome (ex: `realrisk-mvp`), uma senha de banco (guarde-a,
   nao e usada pelo app, mas e util pra acessar o banco direto se precisar) e a regiao
   mais proxima (ex: `us-east-1`).
3. Aguarde ~2 minutos enquanto o projeto e provisionado.

## 2. Criar as tabelas (SQL Editor)

No painel do projeto, vá em **SQL Editor > New query**, cole e rode:

```sql
create table property_likes (
  id bigint generated always as identity primary key,
  property_id integer not null,
  session_id text not null,
  created_at timestamptz default now(),
  unique (property_id, session_id)
);

create table property_comments (
  id bigint generated always as identity primary key,
  property_id integer not null,
  author_name text not null,
  comment_text text not null,
  created_at timestamptz default now()
);

alter table property_likes enable row level security;
alter table property_comments enable row level security;

create policy "Leitura publica de likes" on property_likes
  for select using (true);
create policy "Qualquer um pode curtir" on property_likes
  for insert with check (true);
create policy "Qualquer um pode descurtir" on property_likes
  for delete using (true);

create policy "Leitura publica de comentarios" on property_comments
  for select using (true);
create policy "Qualquer um pode comentar" on property_comments
  for insert with check (true);
```

> Nota sobre seguranca: como ainda nao existe sistema de login, as policies liberam
> insert/select/delete para qualquer requisicao (anon key). Isso é aceitável para um MVP/alpha
> fechado, mas **antes do beta pago** (ver `planejamento-semanal.md`, Semana 5) essas policies
> devem ser revisadas para exigir autenticacao (Supabase Auth) e vincular like/comentario ao
> usuario logado, nao a uma sessao anonima de navegador.

## 3. Pegar a URL e a chave publica (anon key)

1. Vá em **Project Settings > API**.
2. Copie **Project URL** (ex: `https://xxxxx.supabase.co`).
3. Copie a chave em **Project API keys > anon public** (NAO use a `service_role` —
   essa tem acesso total e nunca deve ir para o front-end).
4. Cole os dois valores em `supabase-config.js` (na raiz do projeto):

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "ey...";
```

A `anon key` é **segura para expor no front-end** — ela so tem o acesso que as RLS
policies do passo 2 permitirem, diferente de uma API key tradicional.

## Status atual

- [ ] Conta Supabase criada
- [ ] Projeto criado
- [ ] Tabelas `property_likes` e `property_comments` criadas com RLS
- [ ] URL e anon key coladas em `supabase-config.js`
