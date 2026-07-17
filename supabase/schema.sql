create table demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  empresa text not null,
  email text not null,
  telefono text,
  cargo text
);

alter table demo_requests enable row level security;

create policy "Cualquiera puede solicitar demo"
  on demo_requests for insert
  to anon
  with check (true);

-- RLS policies only apply after the base SQL privilege exists; without this
-- grant, anon inserts fail with "permission denied for table demo_requests"
-- even though the policy above allows it.
grant insert on public.demo_requests to anon;
