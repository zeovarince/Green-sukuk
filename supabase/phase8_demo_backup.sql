-- Apply once to an existing project before enabling DEMO_MODE.
create table if not exists public.demo_pemulihan (
    seq bigint primary key references public.ledger_entri(seq) on delete cascade,
    payload_kanonik text not null,
    dibuat_pada timestamptz not null default now()
);

alter table public.demo_pemulihan enable row level security;
revoke all on public.demo_pemulihan from anon, authenticated;
grant all on public.demo_pemulihan to service_role;
