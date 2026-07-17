'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useHomeContent } from '@/lib/home/LocaleProvider'

export function BenefitsAccordion() {
  const { benefits } = useHomeContent()

  return (
    <section id="beneficios" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{benefits.titulo}</h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion defaultValue={[benefits.grupos[0].rol]}>
          {benefits.grupos.map((grupo) => (
            <AccordionItem key={grupo.rol} value={grupo.rol}>
              <AccordionTrigger className="font-heading text-lg text-[#101827]">{grupo.rol}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-[#48556A]">
                  {grupo.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
