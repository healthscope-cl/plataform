'use client'

import { LOCALES, LOCALE_LABELS } from '@/lib/home/content'
import { useLocale } from '@/lib/home/LocaleProvider'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()

  return (
    <div className={cn('flex items-center gap-1 rounded-full border border-white/20 p-1', className)}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          aria-pressed={locale === value}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            locale === value ? 'bg-[#1455E6] text-white' : 'text-white/60 hover:text-white'
          )}
        >
          {LOCALE_LABELS[value]}
        </button>
      ))}
    </div>
  )
}
