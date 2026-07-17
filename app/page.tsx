import type { Metadata } from 'next'
import { HomeClientShell } from '@/components/home/HomeClientShell'
import { seo } from '@/lib/home/content'

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
}

export default function Home() {
  return <HomeClientShell />
}
