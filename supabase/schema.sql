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

-- ============================================================
-- PLATFORM: tenants and organization structure
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido'))
);

alter table tenants enable row level security;

create table empresas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  rut text
);

alter table empresas enable row level security;

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  ciudad text
);

alter table sucursales enable row level security;

create table unidades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null
);

alter table unidades enable row level security;

create table centros_costo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo text not null,
  nombre text not null
);

alter table centros_costo enable row level security;

create table cargos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null
);

alter table cargos enable row level security;

create table turnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  hora_inicio time,
  hora_fin time
);

alter table turnos enable row level security;
