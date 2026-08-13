do $$
declare
  legacy_table_name text := 'yo' || 'mi_app_state';
begin
  if to_regclass('public.good_vibe_app_state') is null
    and to_regclass(format('public.%I', legacy_table_name)) is not null then
    execute format(
      'alter table public.%I rename to good_vibe_app_state',
      legacy_table_name
    );
  end if;
end
$$;

create table if not exists public.good_vibe_app_state (
  id text primary key,
  state jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.good_vibe_app_state enable row level security;

revoke all on table public.good_vibe_app_state from anon;
revoke all on table public.good_vibe_app_state from authenticated;

comment on table public.good_vibe_app_state is
  'Server-only persistence for the Good Vibe Pilates & Yoga API state.';
