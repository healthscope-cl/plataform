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

-- ============================================================
-- PLATFORM: roles, usuarios, auditoría, RLS helpers
-- ============================================================

create table roles (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  descripcion text not null
);

alter table roles enable row level security;

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  email text not null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  rol_id uuid not null references roles(id)
);

alter table usuarios enable row level security;

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_id uuid not null references usuarios(id),
  entidad text not null,
  entidad_id uuid not null,
  accion text not null check (accion in ('crear', 'actualizar', 'eliminar')),
  datos_antes jsonb,
  datos_despues jsonb
);

alter table auditoria enable row level security;

-- Returns the tenant of the currently authenticated user. security definer so it can read
-- `usuarios` even though `usuarios` itself has RLS enabled (this function is the one
-- controlled bypass; it never returns data, only the caller's own tenant_id).
create function auth_tenant_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from usuarios where id = auth.uid()
$$;

-- Returns true if the current user's role matches one of the given role keys.
create function auth_has_role(claves text[]) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from usuarios u
    join roles r on r.id = u.rol_id
    where u.id = auth.uid() and r.clave = any(claves)
  )
$$;

-- roles: readable by any authenticated user (needed to render role names in the usuarios
-- table and the invite form's role picker), never writable from the client — role catalog
-- changes are a manual/seed operation, not a product feature in the MVP.
create policy "roles_select_authenticated" on roles
  for select to authenticated using (true);

-- usuarios: a user can see every usuario in their own tenant (needed for the Usuarios page),
-- but only admin roles can insert/update/delete — and insert is in practice never called
-- from the client (see Task 9's Route Handler), this policy exists so the constraint is
-- enforced at the database even if a future code path tries to bypass the Route Handler.
create policy "usuarios_select_same_tenant" on usuarios
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "usuarios_update_admin_same_tenant" on usuarios
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id());

-- auditoria: append-only. Any authenticated user in the tenant can insert a row for their
-- own actor_id (the app calls this right after every mutation); nobody can update or delete
-- (no policy for those actions = denied by default with RLS enabled); only superadmin and
-- auditor can read the full log.
create policy "auditoria_insert_own_actor" on auditoria
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and actor_id = auth.uid());

create policy "auditoria_select_admin_auditor" on auditoria
  for select to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente', 'auditor']));

-- tenants: a user can see only their own tenant row (used by EmpresaSwitcher/Topbar to show
-- the tenant name); no client-side insert/update — tenant provisioning is controller-only.
create policy "tenants_select_own" on tenants
  for select to authenticated using (id = auth_tenant_id());

-- empresas: readable by anyone in the tenant, writable only by admin roles.
create policy "empresas_select_same_tenant" on empresas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "empresas_write_admin" on empresas
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

-- sucursales / unidades / centros_costo / cargos / turnos: same shape — read by anyone in
-- the tenant, write only by admin roles.
create policy "sucursales_select_same_tenant" on sucursales
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "sucursales_write_admin" on sucursales
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "unidades_select_same_tenant" on unidades
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "unidades_write_admin" on unidades
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "centros_costo_select_same_tenant" on centros_costo
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "centros_costo_write_admin" on centros_costo
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "cargos_select_same_tenant" on cargos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "cargos_write_admin" on cargos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "turnos_select_same_tenant" on turnos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "turnos_write_admin" on turnos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

-- Seed the 13 roles from the master doc (section 18). Fixed catalog — clave is the stable
-- key the app code checks against, nombre is what's shown in the UI.
insert into roles (clave, nombre, descripcion) values
  ('superadmin', 'Superadministrador', 'Acceso total, incluye soporte HealthScope'),
  ('admin_cliente', 'Administrador cliente', 'Administra la cuenta de la empresa cliente'),
  ('rrhh_corporativo', 'RR.HH. corporativo', 'Ve y gestiona todas las sucursales'),
  ('rrhh_local', 'RR.HH. local', 'Ve y gestiona su sucursal'),
  ('gerencia', 'Gerencia', 'Ve información agregada, compara áreas y períodos'),
  ('jefatura', 'Jefatura', 'Ve información agregada de su área, recibe alertas'),
  ('prevencion', 'Prevención', 'Administra campañas e intervenciones preventivas'),
  ('salud_ocupacional', 'Salud ocupacional', 'Prioriza evaluaciones y coordina derivaciones'),
  ('prestador', 'Prestador', 'Acceso limitado a casos derivados'),
  ('profesional', 'Profesional', 'Acceso limitado a sus atenciones'),
  ('auditor', 'Auditor', 'Solo lectura, incluye el log de auditoría completo'),
  ('trabajador', 'Trabajador', 'Accede a campañas, encuestas y su propia información'),
  ('solo_lectura', 'Solo lectura', 'Ve el dashboard y reportes sin poder editar nada');

-- Base grants missing since these tables were created via raw SQL (not Supabase migrations),
-- same root cause Task 14 found for demo_requests/anon: RLS policies only apply after the
-- base SQL privilege exists. RLS above already gates rows/operations correctly per role;
-- these grants only unlock the base privilege it depends on. Discovered when the live
-- service_role couldn't write to usuarios and authenticated had zero grants on any platform
-- table (Task 11 manual verification never actually ran, so nothing had exercised these paths).
grant select on tenants, roles to authenticated;
grant select, insert, update, delete on empresas, sucursales, unidades, centros_costo, cargos, turnos to authenticated;
grant select, update on usuarios to authenticated;
grant select, insert on auditoria to authenticated;
grant all on tenants, empresas, sucursales, unidades, centros_costo, cargos, turnos, roles, usuarios, auditoria to service_role;

-- ============================================================
-- INGESTION: tipos administrativos, personas, contratos
-- ============================================================

create table tipos_administrativos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null
);

alter table tipos_administrativos enable row level security;

create policy "tipos_administrativos_select_authenticated" on tipos_administrativos
  for select to authenticated using (true);

grant select on tipos_administrativos to authenticated;
grant all on tipos_administrativos to service_role;

-- Fixed catalog from the master doc's legal leave-type taxonomy (section 12). Clave is the
-- stable key classification.ts and validate.ts check against.
insert into tipos_administrativos (clave, nombre) values
  ('enfermedad_comun', 'Enfermedad o accidente común'),
  ('prorroga_medicina_preventiva', 'Prórroga de medicina preventiva'),
  ('maternal', 'Maternal'),
  ('enfermedad_grave_hijo_menor', 'Enfermedad grave de hijo menor'),
  ('accidente_laboral', 'Accidente laboral'),
  ('accidente_trayecto', 'Accidente de trayecto'),
  ('enfermedad_profesional', 'Enfermedad profesional'),
  ('patologia_embarazo', 'Patología del embarazo'),
  ('permiso_administrativo', 'Permiso administrativo'),
  ('ausencia_injustificada', 'Ausencia injustificada'),
  ('vacaciones', 'Vacaciones'),
  ('otros', 'Otros');

create table personas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo text not null,
  rut_hash text not null,
  unidad_id uuid references unidades(id),
  cargo_id uuid references cargos(id),
  turno_id uuid references turnos(id),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  unique (tenant_id, rut_hash)
);

alter table personas enable row level security;

create policy "personas_select_same_tenant" on personas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "personas_write_admin" on personas
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on personas to authenticated;
grant all on personas to service_role;

create table contratos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  fecha_inicio date not null,
  fecha_fin date,
  tipo_contrato text not null default 'indefinido' check (tipo_contrato in ('indefinido', 'plazo_fijo', 'obra_o_faena')),
  jornada_horas_semanales numeric not null default 45
);

alter table contratos enable row level security;

create policy "contratos_select_same_tenant" on contratos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "contratos_write_admin" on contratos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on contratos to authenticated;
grant all on contratos to service_role;

-- ============================================================
-- INGESTION: importaciones, errores de calidad, episodios
-- ============================================================

create table importaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  responsable_id uuid not null references usuarios(id),
  archivo_nombre text not null,
  archivo_hash text not null,
  estado text not null default 'en_progreso'
    check (estado in ('en_progreso', 'completada', 'revertida', 'fallida')),
  filas_procesadas integer not null default 0,
  filas_rechazadas integer not null default 0,
  advertencias integer not null default 0
);

alter table importaciones enable row level security;

create policy "importaciones_select_same_tenant" on importaciones
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "importaciones_write_admin" on importaciones
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on importaciones to authenticated;
grant all on importaciones to service_role;

create table errores_calidad (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  importacion_id uuid not null references importaciones(id) on delete cascade,
  fila integer not null,
  severidad text not null check (severidad in ('critico', 'advertencia')),
  tipo text not null,
  mensaje text not null
);

alter table errores_calidad enable row level security;

create policy "errores_calidad_select_same_tenant" on errores_calidad
  for select to authenticated using (tenant_id = auth_tenant_id());

grant select on errores_calidad to authenticated;
grant all on errores_calidad to service_role;

create table episodios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  importacion_id uuid references importaciones(id),
  tipo_administrativo_id uuid not null references tipos_administrativos(id),
  fecha_inicio date not null,
  fecha_fin date,
  dias integer not null,
  clasificacion_analitica text not null default 'sin_clasificar' check (
    clasificacion_analitica in (
      'corto', 'mediano', 'prolongado', 'recurrente', 'continuacion',
      'accidente', 'enfermedad_profesional', 'maternal', 'cuidado_familiar',
      'sin_clasificar', 'calidad_insuficiente'
    )
  ),
  estado text not null default 'cerrado' check (estado in ('abierto', 'cerrado'))
);

alter table episodios enable row level security;

create policy "episodios_select_same_tenant" on episodios
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "episodios_write_admin" on episodios
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on episodios to authenticated;
grant all on episodios to service_role;

-- ============================================================
-- INDICATORS: lineas_base
-- ============================================================

create table lineas_base (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  periodo_inicio date not null,
  periodo_fin date not null,
  indicadores jsonb not null
);

alter table lineas_base enable row level security;

create policy "lineas_base_select_same_tenant" on lineas_base
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "lineas_base_insert_admin" on lineas_base
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert on lineas_base to authenticated;
grant all on lineas_base to service_role;

-- ============================================================
-- ALERTS: reglas_alerta
-- ============================================================

create table reglas_alerta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  nombre text not null,
  indicador text not null check (indicador in (
    'tasaAusentismo', 'frecuencia', 'severidad', 'duracionPromedio', 'reincidencia', 'costoEstimado'
  )),
  operador text not null check (operador in ('mayor_que', 'mayor_o_igual')),
  umbral numeric not null,
  sucursal_id uuid references sucursales(id) on delete set null,
  unidad_id uuid references unidades(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  turno_id uuid references turnos(id) on delete set null,
  activa boolean not null default true
);

alter table reglas_alerta enable row level security;

create policy "reglas_alerta_select_same_tenant" on reglas_alerta
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "reglas_alerta_insert_admin" on reglas_alerta
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "reglas_alerta_update_admin" on reglas_alerta
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on reglas_alerta to authenticated;
grant all on reglas_alerta to service_role;
