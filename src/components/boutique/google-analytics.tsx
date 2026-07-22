'use client'

import Script from 'next/script'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

/**
 * Injects Google Analytics 4 script if gaTagId is configured.
 * Renders nothing otherwise.
 */
export function GoogleAnalytics() {
  const settings = useBoutiqueSettings()
  const gaTagId = settings.gaTagId

  if (!gaTagId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaTagId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaTagId}');
        `}
      </Script>
    </>
  )
}
