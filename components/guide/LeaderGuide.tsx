// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { BookOpen, ArrowUp } from 'lucide-react'
import { SECTIONS } from '@/components/guide/guideSections'

export function LeaderGuide() {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="text-amber-500" size={26} />
        <h1 className="text-2xl font-bold">Leader Guide</h1>
      </div>

      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-8">
        {/* Table of contents */}
        <nav className="lg:sticky lg:top-16 lg:self-start mb-6 lg:mb-0">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2 px-1">Contents</p>
            <ul className="space-y-0.5">
              {SECTIONS.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition-colors"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-8 pb-16">
          {SECTIONS.map(s => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="text-xl font-bold text-amber-400 border-b border-slate-800 pb-2 mb-3">{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-1.5 bg-amber-500 text-slate-900 text-sm font-medium px-3 py-2 rounded-full shadow-lg hover:bg-amber-400 transition-colors"
        >
          <ArrowUp size={16} /> Top
        </button>
      )}
    </div>
  )
}
