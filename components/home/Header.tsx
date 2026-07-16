'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { nav } from '@/lib/home/content'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onOpenDemo: () => void
}

export function Header({ onOpenDemo }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 24)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full transition-colors duration-300',
        scrolled ? 'bg-[#03142F]/95 backdrop-blur-sm shadow-lg' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="HealthScope" width={40} height={40} className="rounded" />
          <span className="font-heading text-lg font-semibold text-white">HealthScope</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.links.map((link) =>
            link.disabled ? (
              <span
                key={link.label}
                aria-disabled="true"
                title="Próximamente"
                className="cursor-not-allowed text-sm text-white/40"
              >
                {link.label}
              </span>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/80 transition-colors hover:text-[#00B8F5]"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={nav.ingresar.href}
            className="text-sm text-white/80 transition-colors hover:text-[#00B8F5]"
          >
            {nav.ingresar.label}
          </Link>
          <Button
            onClick={onOpenDemo}
            className="rounded-full bg-[#1455E6] px-5 text-white hover:bg-[#1455E6]/90"
          >
            {nav.demoLabel}
          </Button>
        </div>
      </div>
    </header>
  )
}
