import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#03142F] px-6 text-center">
      <Image src="/logo.png" alt="HealthScope" width={64} height={64} className="rounded" />
      <h1 className="font-heading text-2xl font-semibold text-white">Plataforma en construcción</h1>
      <p className="max-w-sm text-sm text-white/70">
        La plataforma privada de HealthScope todavía no está disponible. Vuelve pronto.
      </p>
      <Link href="/" className="text-sm text-[#00B8F5] hover:underline">
        Volver al inicio
      </Link>
    </main>
  )
}
