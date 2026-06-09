'use client'
import Script from 'next/script'

/**
 * Google Website Translator widget for the public, member-facing pages so
 * international members can read them in their own language.
 *
 * Renders the Google `#google_translate_element` mount point wrapped in a small
 * dark-theme container with a 🌐 globe + "Translate" label, and loads Google's
 * element.js (which calls back into `window.googleTranslateElementInit`). Dark-theme
 * styling for the injected dropdown lives in globals.css (`.goog-*` rules).
 */
export function GoogleTranslate({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 ${className}`}
      title="Translate this page"
    >
      <span aria-hidden className="text-sm leading-none">🌐</span>
      <span className="text-xs text-slate-400 select-none">Translate</span>
      <div id="google_translate_element" className="leading-none" />

      {/* Define the init callback before element.js loads and invokes it. */}
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          window.googleTranslateElementInit = function () {
            new window.google.translate.TranslateElement({
              pageLanguage: 'en',
              includedLanguages: 'zh-CN,zh-TW,ru,ar,es,pt,id,vi,th,ko,ja,fr,de,tr,pl,uk,hi',
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false
            }, 'google_translate_element');
          };
        `}
      </Script>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </div>
  )
}
