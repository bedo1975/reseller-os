'use client'

import Link from 'next/link'
import { Award } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

// Must mirror the GRADE_CONFIG used on the product page (src/app/boutique/produit/[sku]/page.tsx)
const GRADE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  A: { label: 'Grade A', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  B: { label: 'Grade B', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  C: { label: 'Grade C', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
}

const DEFAULT_CONTENT = `
<div class="space-y-6">
  <p class="text-gray-700">Pour vous aider à évaluer l'état de nos articles seconde main, nous utilisons un système de badges simples. Chaque article est inspecté avant sa mise en ligne et se voit attribuer un grade reflétant son état général.</p>

  <div class="space-y-3">
    <div class="flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50">
      <span class="inline-block w-3 h-3 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
      <div>
        <h3 class="font-semibold text-emerald-800">Grade A — État neuf / quasi neuf</h3>
        <p class="text-sm text-emerald-700 mt-1">Article jamais porté ou très peu porté. Aucun défaut visible, étiquettes éventuellement attachées. Couleur et matière d'origine parfaitement conservées.</p>
      </div>
    </div>

    <div class="flex items-start gap-3 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
      <span class="inline-block w-3 h-3 rounded-full bg-yellow-400 mt-1.5 shrink-0"></span>
      <div>
        <h3 class="font-semibold text-yellow-800">Grade B — Très bon état</h3>
        <p class="text-sm text-yellow-700 mt-1">Article porté mais en très bon état. Traces d'usage minimes (légère usure, micro-défaut discret non visible en port). Entièrement fonctionnel et présentable.</p>
      </div>
    </div>

    <div class="flex items-start gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50">
      <span class="inline-block w-3 h-3 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
      <div>
        <h3 class="font-semibold text-orange-800">Grade C — Bon état / état correct</h3>
        <p class="text-sm text-orange-700 mt-1">Article présentant des signes d'usage visibles (frottements, léger délavage, petit défaut esthétique). L'usure n'affecte pas l'usage du vêtement — idéal pour un port décontracté à prix très accessible.</p>
      </div>
    </div>
  </div>

  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <p class="text-sm text-blue-800"><strong>Bon à savoir :</strong> le grade reflète l'état cosmétique de l'article. Tous nos articles, quel que soit leur grade, sont lavés, désinfectés et contrôlés avant expédition. Pour toute question sur l'état d'un article spécifique, contactez-nous via la messagerie de votre compte client.</p>
  </div>
</div>
`

export default function GradePage() {
  const settings = useBoutiqueSettings()

  const title = settings.gradePageTitle || 'Nos grades de qualité'
  const content = settings.gradePageContent || DEFAULT_CONTENT

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/boutique" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <Award className="h-6 w-6 text-[#007bff]" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Quick legend (always visible above the editable content) */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(GRADE_CONFIG).map(([key, cfg]) => (
          <span
            key={key}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      <div
        className="prose prose-sm max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <div className="mt-8 text-center">
        <Link href="/boutique" className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted">
          Retour à la boutique
        </Link>
      </div>
    </div>
  )
}
