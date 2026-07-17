'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useHomeContent } from '@/lib/home/LocaleProvider'

export function Faq() {
  const { faq } = useHomeContent()

  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{faq.titulo}</h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion>
          {faq.items.map((entry, index) => (
            <AccordionItem key={entry.pregunta} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-[#101827]">{entry.pregunta}</AccordionTrigger>
              <AccordionContent className="text-[#48556A]">{entry.respuesta}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
