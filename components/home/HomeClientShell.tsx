'use client'

import { useState } from 'react'
import { Header } from '@/components/home/Header'
import { Hero } from '@/components/home/Hero'
import { TrustStrip } from '@/components/home/TrustStrip'
import { ProblemSection } from '@/components/home/ProblemSection'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Features } from '@/components/home/Features'
import { BenefitsAccordion } from '@/components/home/BenefitsAccordion'
import { UseCases } from '@/components/home/UseCases'
import { PlatformShowcase } from '@/components/home/PlatformShowcase'
import { PrivacySection } from '@/components/home/PrivacySection'
import { ResultsSection } from '@/components/home/ResultsSection'
import { ImpactCalculator } from '@/components/home/ImpactCalculator'
import { Faq } from '@/components/home/Faq'
import { ClosingCta } from '@/components/home/ClosingCta'
import { Footer } from '@/components/home/Footer'
import { DemoRequestSheet } from '@/components/home/DemoRequestSheet'

export function HomeClientShell() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <>
      <Header onOpenDemo={() => setDemoOpen(true)} />
      <main>
        <Hero onOpenDemo={() => setDemoOpen(true)} />
        <TrustStrip />
        <ProblemSection />
        <HowItWorks />
        <Features />
        <BenefitsAccordion />
        <UseCases />
        <PlatformShowcase />
        <PrivacySection />
        <ResultsSection />
        <ImpactCalculator />
        <Faq />
        <ClosingCta onOpenDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoRequestSheet open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  )
}
