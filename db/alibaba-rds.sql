begin;

create table if not exists public.good_vibe_app_state (
  id text primary key,
  state jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.good_vibe_app_state is
  'Server-only application state for Good Vibe Pilates & Yoga.';

revoke all on table public.good_vibe_app_state from public;

commit;
