import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Sword, Shield, Users, Timer, Crown, MessageSquare, Gift,
  Sparkles, ClipboardList, Wand2, ArrowRight, BookOpen,
} from 'lucide-react'
import { SECTIONS } from '@/components/guide/guideSections'
import { GoogleTranslate } from '@/components/ui/GoogleTranslate'

export const metadata: Metadata = {
  title: 'KS Command — Kingshot Alliance Coordination Platform',
  description:
    'Battle planning, member management, and rally coordination for Kingshot alliances. Free to use.',
}

const FEATURES = [
  {
    icon: Wand2,
    title: 'AI Battle Planning',
    desc: 'Generate optimized battle plans for Swordland, KVK, Castle Battle, and more. The system analyzes your members’ stats, heroes, and availability to assign the right players to the right roles.',
  },
  {
    icon: Users,
    title: 'Member Management',
    desc: 'Import your full alliance roster, send each member their unique profile link, and let them update their own stats and heroes. No account required for members.',
  },
  {
    icon: Timer,
    title: 'Rally Timer',
    desc: 'Coordinate simultaneous rally launches with a shareable timer. Members see a live countdown and get an audio alert when it’s time to launch. Supports staggered landing for multi-wave attacks.',
  },
  {
    icon: Crown,
    title: 'KVK Coordination',
    desc: 'Unite your kingdom’s alliances in the KVK hub. Share attending members, generate a kingdom-wide battle plan, and coordinate voice channels — all in one place.',
  },
  {
    icon: MessageSquare,
    title: 'Real-Time Chat',
    desc: 'Alliance chat with @ mentions, image sharing, auto-translation for multilingual alliances, and instant notifications when you’re mentioned.',
  },
  {
    icon: Gift,
    title: 'Gift Codes',
    desc: 'Never miss a gift code. Active codes are fetched automatically and displayed for your members to redeem with one click.',
  },
]

const STEPS = [
  {
    icon: Shield,
    title: 'Set up your alliance',
    desc: 'Create your kingdom and alliance in minutes. Import your members via CSV or add them one by one.',
  },
  {
    icon: ClipboardList,
    title: 'Collect member data',
    desc: 'Send each member their unique profile link. They update their own stats, heroes, and troop data — no account needed.',
  },
  {
    icon: Sparkles,
    title: 'Generate battle plans',
    desc: 'When an event comes up, collect attendance and hit Generate. The AI assigns every member their optimal role with plain-language instructions.',
  },
]

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword className="text-amber-500" size={22} />
            <span className="font-bold text-amber-500">KS Command</span>
          </div>
          <div className="flex items-center gap-3">
            <GoogleTranslate />
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 py-20 sm:py-28 text-center relative">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sword className="text-amber-500" size={34} />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">KS Command</h1>
          <p className="mt-4 text-xl sm:text-2xl font-semibold text-amber-400">
            The command center for serious Kingshot alliances
          </p>
          <p className="mt-4 text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Battle planning, member coordination, rally timers, and more — built specifically for Kingshot leaders.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Get Started — It&apos;s Free <ArrowRight size={18} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything your alliance needs</h2>
        <p className="text-slate-400 text-center mb-10 max-w-2xl mx-auto">
          One platform that replaces scattered chat, spreadsheets, and guesswork.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center mb-4">
                <Icon className="text-amber-500" size={22} />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="text-center">
                <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 mb-4">
                  <Icon className="text-amber-500" size={26} />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leader guide */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center gap-2 mb-2 justify-center">
          <BookOpen className="text-amber-500" size={24} />
          <h2 className="text-2xl sm:text-3xl font-bold text-center">The Leader Guide</h2>
        </div>
        <p className="text-slate-400 text-center mb-10 max-w-2xl mx-auto">
          Everything you need to run a top alliance — from first setup to KVK day. This is the same guide built into the app.
        </p>
        <div className="space-y-10">
          {SECTIONS.map(s => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h3 className="text-xl font-bold text-amber-400 border-b border-slate-800 pb-2 mb-3">{s.title}</h3>
              {s.body}
            </section>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-800 bg-gradient-to-b from-transparent to-amber-500/5">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold">Ready to take command?</h2>
          <p className="mt-4 text-slate-400 text-lg">
            Join hundreds of alliance leaders already using KS Command.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
          >
            Create Your Alliance — Free <ArrowRight size={20} />
          </Link>
          <p className="mt-4 text-xs text-slate-500">No credit card required. Free forever for small alliances.</p>
        </div>
      </section>

      <footer className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Sword className="text-amber-500/70" size={16} />
            <span>KS Command</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/report-impersonation" className="hover:text-amber-400">Report Impersonation</Link>
            <Link href="/login" className="hover:text-amber-400">Sign In</Link>
          </div>
        </div>
      </footer>

      {/* Sticky Get Started button that follows scroll */}
      <Link
        href="/login"
        className="fixed bottom-6 right-6 z-[60] inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg transition-colors"
      >
        <Sparkles size={16} /> Get Started Free
      </Link>
    </div>
  )
}
