'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError('Correo o contraseña incorrectos.')
      return
    }

    router.push('/plataforma/resumen')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#03142F] px-6 text-center">
      <Image src="/logo.png" alt="HealthScope" width={64} height={64} className="rounded" />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
        <h1 className="text-center font-heading text-2xl font-semibold text-white">
          Ingresar a la plataforma
        </h1>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white">Correo</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="bg-white text-[#03142F]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="bg-white pr-9 text-[#03142F]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </main>
  )
}
