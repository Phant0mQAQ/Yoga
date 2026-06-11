create table if not exists public.yomi_app_state (
  id text primary key,
  state jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.yomi_app_state enable row level security;

revoke all on table public.yomi_app_state from anon;
revoke all on table public.yomi_app_state from authenticated;

comment on table public.yomi_app_state is
  'Server-only persistence for the Yomi Yoga API compatibility migration.';
