import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_EMPRESA_ACTIVA } from '@/lib/platform/empresa-activa'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { empresaId } = (await request.json()) as { empresaId: string }

  const { data: empresaValida } = await supabase.from('empresas').select('id').eq('id', empresaId).maybeSingle()

  if (!empresaValida) {
    return NextResponse.json({ error: 'Empresa no encontrada para este tenant.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_EMPRESA_ACTIVA, empresaId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
