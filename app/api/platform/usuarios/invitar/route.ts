import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/platform/roles'
import { mapUsuarioRow } from '@/lib/platform/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('usuarios')
    .select('*, roles(clave)')
    .eq('id', user.id)
    .single()

  if (!caller || !isAdminRole(caller.roles.clave)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { email, nombre, rolClave } = body as {
    email: string
    nombre: string
    rolClave: string
  }

  if (!email || !nombre || !rolClave) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: rolRow, error: rolError } = await supabase
    .from('roles')
    .select('id')
    .eq('clave', rolClave)
    .single()

  if (rolError || !rolRow) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email)

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'No se pudo invitar al usuario' },
      { status: 400 }
    )
  }

  const { data: usuarioRow, error: usuarioError } = await admin
    .from('usuarios')
    .insert({
      id: created.user.id,
      tenant_id: caller.tenant_id,
      nombre,
      email,
      rol_id: rolRow.id,
    })
    .select()
    .single()

  if (usuarioError || !usuarioRow) {
    return NextResponse.json(
      { error: usuarioError?.message ?? 'No se pudo crear el perfil del usuario' },
      { status: 400 }
    )
  }

  await admin.from('auditoria').insert({
    tenant_id: caller.tenant_id,
    actor_id: user.id,
    entidad: 'usuarios',
    entidad_id: usuarioRow.id,
    accion: 'crear',
    datos_antes: null,
    datos_despues: { email, nombre, rolClave },
  })

  return NextResponse.json(mapUsuarioRow(usuarioRow), { status: 201 })
}
