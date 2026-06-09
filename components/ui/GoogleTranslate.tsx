'use client'
import Script from 'next/script'

/**
 * Google Website Translator widget so international members can read the app in
 * their own language. Rendered INLINE (no fixed/floating positioning) so it never
 * overlaps navigation — embedded in the sidebar (above Sign out) on logged-in pages
 * and in the self-service page header. Renders a 🌐 globe + "Translate" label with
 * Google's language dropdown below it, and loads element.js (which calls back into
 * `window.googleTranslateElementInit`). Dark-theme styling for the injected dropdown
 * lives in globals.css (`.goog-*` rules); the banner suppression keeps it from
 * shifting the page layout.
 */
export function GoogleTranslate({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
        <span aria-hidden className="text-base leading-none">🌐</span>
        <span className="select-none">Translate</span>
      </div>
      <div id="google_translate_element" className="mt-1.5 leading-none" />

      {/* Define the init callback before element.js loads and invokes it. */}
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          window.googleTranslateElementInit = function () {
            new window.google.translate.TranslateElement({
              pageLanguage: 'en',
              includedLanguages: 'zh-CN,zh-TW,ru,ar,es,pt,id,vi,th,ko,ja,fr,de,tr,pl,uk,hi,ms,tl',
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
