import type { Metadata } from 'next'
import { HomeClientShell } from '@/components/home/HomeClientShell'
import { contentByLocale } from '@/lib/home/content'

export const metadata: Metadata = {
  title: contentByLocale.es.seo.title,
  description: contentByLocale.es.seo.description,
}

export default function Home() {
  return <HomeClientShell />
}
