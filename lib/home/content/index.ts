import { content as es } from './es'
import { content as en } from './en'
import { content as pt } from './pt'

export type { HomeContent, Locale } from './types'

export const contentByLocale = { es, en, pt }

export const LOCALES = ['es', 'en', 'pt'] as const
export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  es: 'ES',
  en: 'EN',
  pt: 'PT',
}
