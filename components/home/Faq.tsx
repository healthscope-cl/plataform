'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { faq } from '@/lib/home/content'

export function Faq() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Preguntas frecuentes</h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion>
          {faq.map((entry, index) => (
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
