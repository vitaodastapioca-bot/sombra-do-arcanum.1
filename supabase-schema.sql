-- Execute no SQL Editor do Supabase APENAS uma vez.
-- Nome e retrato serão públicos exclusivamente pela API da Vercel.
-- Senha, atributos e identidade NÃO são expostos via cliente anon.
create extension if not exists pgcrypto;

create table if not exists public.arcanum_sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  portrait text not null default '',
  data jsonb not null,
  pass_salt text not null,
  pass_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arcanum_sheets_recent on public.arcanum_sheets(created_at desc);

create table if not exists public.arcanum_rate_limits (
  bucket text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);
create index if not exists arcanum_rate_limits_old on public.arcanum_rate_limits(window_started_at);

alter table public.arcanum_sheets enable row level security;
alter table public.arcanum_rate_limits enable row level security;
revoke all on table public.arcanum_sheets from public, anon, authenticated;
revoke all on table public.arcanum_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.arcanum_sheets to service_role;
grant select, insert, update, delete on table public.arcanum_rate_limits to service_role;

-- Incremento atômico de tentativas no próprio Postgres (entre instâncias da Vercel).
create or replace function public.arcanum_count_attempt(p_bucket text)
returns integer language plpgsql security invoker set search_path = public
as $$
declare n integer;
begin
  insert into public.arcanum_rate_limits(bucket, attempts, window_started_at)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
  set attempts = case
       when public.arcanum_rate_limits.window_started_at < now() - interval '15 minutes' then 1
       else public.arcanum_rate_limits.attempts + 1 end,
      window_started_at = case
       when public.arcanum_rate_limits.window_started_at < now() - interval '15 minutes' then now()
       else public.arcanum_rate_limits.window_started_at end
  returning attempts into n;
  return n;
end;
$$;
revoke all on function public.arcanum_count_attempt(text) from public, anon, authenticated;
grant execute on function public.arcanum_count_attempt(text) to service_role;
