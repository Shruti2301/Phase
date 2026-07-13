import React, { useState, useEffect } from "react"
import { Check, ChevronRight, X, Plus, Minus, BarChart2, Calendar, User, Home, Info, ArrowRight, Moon, Leaf, Dumbbell, Brain, BookHeart, Sparkles, PenLine, Flame, Heart } from "lucide-react"
import { fetchBriefing, fetchEvidence, fetchJournal, saveJournalRemote } from "./api"
import { differenceInDays, parseISO, format } from "date-fns"

// ─── Cycle engine — computes phase from YOUR logged dates (not a fixed 28) ──────
const TODAY = new Date(2026, 6, 13) // fixed "today" for a stable demo (Jul 13 2026)
interface Period { start: string; end?: string }
const SEED_PERIODS: Period[] = [
  { start: "2026-05-10", end: "2026-05-14" },
  { start: "2026-06-07", end: "2026-06-11" },
  { start: "2026-07-04", end: "2026-07-08" },
]

function computeCycle(periods: Period[], fallbackLen = 28) {
  const sorted = [...periods].filter(p => p.start).sort((a, b) => a.start.localeCompare(b.start))
  const last = sorted[sorted.length - 1]
  // average gap between consecutive period starts = your real cycle length
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) gaps.push(differenceInDays(parseISO(sorted[i].start), parseISO(sorted[i - 1].start)))
  const cycleLength = gaps.length ? Math.max(21, Math.min(40, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length))) : fallbackLen
  const bleedLen = last?.end ? Math.max(1, differenceInDays(parseISO(last.end), parseISO(last.start)) + 1) : 5
  const day = last ? differenceInDays(TODAY, parseISO(last.start)) + 1 : 1
  const ovu = Math.round(cycleLength / 2)
  const bounds: [PK, number, number][] = [
    ["menstrual", 1, bleedLen],
    ["follicular", bleedLen + 1, ovu - 2],
    ["ovulatory", ovu - 1, ovu + 1],
    ["luteal", ovu + 2, cycleLength],
  ]
  const phaseKey = (bounds.find(([, s, e]) => day >= s && day <= e)?.[0]) || "luteal"
  const ovStart = ovu - 1
  const nextOvu = day < ovStart ? ovStart - day : null
  return { sorted, cycleLength, bleedLen, day, ovu, bounds, phaseKey, gaps, nextOvu }
}

// ─── Shared journal model ──────────────────────────────────────────────────────
interface JournalEntry { id: number; date: string; mood: number; energy: number; note: string; phase: string }
const SEED_JOURNAL: JournalEntry[] = [
  { id: 1, date: "Jul 12", mood: 4, energy: 3, note: "Felt calm after my morning walk. Cramps easing.", phase: "Follicular" },
  { id: 2, date: "Jul 11", mood: 3, energy: 2, note: "Low energy but showed up for mobility. Proud of that.", phase: "Follicular" },
  { id: 3, date: "Jul 9",  mood: 5, energy: 5, note: "Hit a squat PR! Estrogen rising and I feel unstoppable.", phase: "Follicular" },
  { id: 4, date: "Jul 6",  mood: 2, energy: 2, note: "Heavy day emotionally. Chose rest and warmth.", phase: "Menstrual" },
]
const MOOD_EMOJI = ["", "😔", "😕", "😐", "🙂", "😄"]

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#FBF3ED",              // warm blush cream
  bgDeep: "#F3E3D9",          // deeper layer behind cards
  card: "#FFFDFB",            // warm white
  aubergine: "#7A4E58",       // wine-mauve — romantic primary
  sage: "#A7A17B",            // warm olive (used in gradients)
  coral: "#DC8A76",           // warm rose-coral
  rose: "#C86B6B",            // romantic rose accent
  text: "#3E2C30",            // warm cocoa
  muted: "#A08A8F",           // soft mauve-taupe
  divider: "rgba(122,78,88,0.09)",
  shadow: "0 4px 24px rgba(122,78,88,0.10)",
  shadowMd: "0 12px 44px rgba(122,78,88,0.15)",
}

const PH = {
  menstrual: { c: "#C57064", bg: "#FBEEEA", t: "#F1D6CE", n: "Menstrual", d: "1–5", emoji: "🌹" },
  follicular: { c: "#93A177", bg: "#F0F1E7", t: "#DEE2CC", n: "Follicular", d: "6–13", emoji: "🌱" },
  ovulatory:  { c: "#D4A24E", bg: "#FBF3E1", t: "#EFDDAF", n: "Ovulatory",  d: "14–16", emoji: "🌼" },
  luteal:     { c: "#A585A6", bg: "#F5EEF3", t: "#E5D6E3", n: "Luteal",     d: "17–28", emoji: "🌙" },
} as const
type PK = keyof typeof PH

const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" }
const serifItalic: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic" }
const sans: React.CSSProperties  = { fontFamily: "'Inter', system-ui, sans-serif" }

// ─── Navigation model (used by the interactive prototype) ──────────────────────
type ScreenId = "welcome" | "obA" | "obB" | "obC" | "home" | "workout" | "nutrition" | "cycle" | "insights" | "profile" | "journal"
type OverlayId = "why" | "quicklog" | "phaseAlert"
interface NavProps {
  go?: (id: ScreenId) => void
  back?: () => void
  overlay?: (id: OverlayId | null) => void
}

// ─── Shared Micro Components ───────────────────────────────────────────────────

function StatusBar({ light = false }: { light?: boolean }) {
  const col = light ? "rgba(255,255,255,0.92)" : C.text
  return (
    <div className="flex items-center justify-between px-6" style={{ height: 54, paddingTop: 16 }}>
      <span className="text-[13px] font-semibold tracking-tight" style={{ color: col, ...sans }}>9:41</span>
      <div className="flex items-center gap-[5px]">
        <svg width="16" height="12" viewBox="0 0 16 12" fill={col} opacity={0.9}>
          <rect x="0" y="4" width="3" height="8" rx="1" opacity={0.4}/>
          <rect x="4.5" y="2" width="3" height="10" rx="1" opacity={0.6}/>
          <rect x="9" y="0" width="3" height="12" rx="1" opacity={0.85}/>
          <rect x="13.5" y="0" width="2.5" height="12" rx="1"/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill={col} opacity={0.9}>
          <path d="M7.5 2C5.2 2 3.1 2.9 1.5 4.5L0 3C2 1.1 4.6 0 7.5 0s5.5 1.1 7.5 3L13.5 4.5C11.9 2.9 9.8 2 7.5 2z"/>
          <path d="M7.5 5c-1.5 0-2.8.6-3.8 1.5L2.3 5.1C3.7 3.8 5.5 3 7.5 3s3.8.8 5.2 2.1L11.3 6.5C10.3 5.6 9 5 7.5 5z"/>
          <circle cx="7.5" cy="9" r="2"/>
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="rounded-[2px]" style={{ width: 23, height: 11, background: col, opacity: 0.9 }}/>
          <div className="rounded-r-[2px]" style={{ width: 1.5, height: 7, background: col, opacity: 0.5 }}/>
        </div>
      </div>
    </div>
  )
}

function PhasePill({ phase, day, size = "sm" }: { phase: PK; day?: number; size?: "sm"|"md" }) {
  const p = PH[phase]
  const textSz = size === "md" ? "text-sm" : "text-[11px]"
  const pad = size === "md" ? "px-4 py-1.5" : "px-2.5 py-1"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${textSz}`}
      style={{ ...sans, background: p.bg, color: p.c, border: `1.5px solid ${p.t}` }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: p.c, display: "inline-block" }}/>
      {p.n}{day ? ` · Day ${day}` : ""}
    </span>
  )
}

function ProgressDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="rounded-full transition-all duration-300" style={{
          width: i + 1 === step ? 22 : 6, height: 6,
          background: i + 1 === step ? C.aubergine : "rgba(59,42,74,0.18)"
        }}/>
      ))}
    </div>
  )
}

function Checkbox({ checked = false, color = C.aubergine }: { checked?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: 24, height: 24, border: checked ? "none" : `2px solid rgba(59,42,74,0.2)`, background: checked ? color : "transparent" }}>
      {checked && <Check size={13} color="#fff" strokeWidth={2.5}/>}
    </div>
  )
}

function SectionLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 mb-2">
      {icon && <span style={{ color: C.muted }}>{icon}</span>}
      <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ ...sans, color: C.muted }}>{label}</span>
    </div>
  )
}

function SourceCard({ study }: { study: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: C.bg, border: `1px solid ${C.divider}` }}>
      <Info size={14} style={{ color: C.muted, flexShrink: 0 }}/>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ ...sans, color: C.muted }}>Source</p>
        <p className="text-[12px] font-medium truncate" style={{ ...sans, color: C.aubergine }}>{study}</p>
      </div>
      <ArrowRight size={13} style={{ color: C.coral, flexShrink: 0 }}/>
    </div>
  )
}

function BottomNav({ active = "today", phase, onNav }: { active?: string; phase?: PK; onNav?: (id: ScreenId) => void }) {
  const accent = phase ? PH[phase].c : C.aubergine
  const items = [
    { id: "today", target: "home" as ScreenId, Icon: Home, label: "Today" },
    { id: "cycle", target: "cycle" as ScreenId, Icon: Calendar, label: "Cycle" },
    { id: "journal", target: "journal" as ScreenId, Icon: BookHeart, label: "Journal" },
    { id: "insights", target: "insights" as ScreenId, Icon: BarChart2, label: "Insights" },
    { id: "profile", target: "profile" as ScreenId, Icon: User, label: "Profile" },
  ]
  return (
    <div className="flex border-t" style={{ background: "rgba(247,244,239,0.97)", borderColor: C.divider, paddingBottom: 22, backdropFilter: "blur(12px)" }}>
      {items.map(({ id, target, Icon, label }) => {
        const isActive = id === active
        return (
          <button key={id} className="flex-1 flex flex-col items-center pt-3 pb-1 gap-1"
            onClick={() => target && onNav?.(target)}>
            <Icon size={22} strokeWidth={isActive ? 2 : 1.5} style={{ color: isActive ? accent : C.muted }}/>
            <span className="text-[10px] font-medium" style={{ ...sans, color: isActive ? accent : C.muted }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Phone Frame Wrapper ───────────────────────────────────────────────────────

function PhoneFrame({ children, scale = 0.58, label, onClick }: {
  children: React.ReactNode; scale?: number; label?: string; onClick?: () => void
}) {
  const W = Math.round(390 * scale)
  const H = Math.round(844 * scale)
  const r = Math.round(40 * scale)
  const diW = Math.round(88 * scale), diH = Math.round(28 * scale), diTop = Math.round(11 * scale)
  const indW = Math.round(118 * scale), indH = Math.round(4 * scale), indBot = Math.round(7 * scale)
  return (
    <div className="flex flex-col items-center" style={{ gap: 14 }}>
      <div className="relative cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
        style={{ width: W, height: H, borderRadius: r, overflow: "hidden",
          boxShadow: "0 30px 70px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        onClick={onClick}>
        <div style={{ width: 390, height: 844, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
        <div className="absolute rounded-full pointer-events-none" style={{ width: diW, height: diH, top: diTop, left: "50%", transform: "translateX(-50%)", background: "#000", zIndex: 60 }}/>
        <div className="absolute rounded-full pointer-events-none" style={{ width: indW, height: indH, bottom: indBot, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.22)", zIndex: 60 }}/>
      </div>
      {label && <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-center" style={{ ...sans, color: "rgba(247,244,239,0.32)" }}>{label}</p>}
    </div>
  )
}

// ─── SCREEN 0 · Welcome / Daily Briefing (warm app open) ───────────────────────

function WelcomeScreen({ go, phase = "follicular", day = 10 }: NavProps & { phase?: PK; day?: number }) {
  const p = PH[phase]
  const copy = PHASE_COPY[phase]
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    fetchBriefing({ phase: p.n, day, name: "Shruti", lastMood: SEED_JOURNAL[0].mood, lastNote: SEED_JOURNAL[0].note })
      .then(t => { if (!alive) return; if (t) { setNote(t); setLive(true) } setLoading(false) })
    return () => { alive = false }
  }, [])

  const fallback = `Good morning, Shruti. You slept deeply last night — your body quietly used that rest to rebuild. You're in your ${p.n.toLowerCase()} phase: ${copy.blurb.toLowerCase()} Fuel yourself with ${copy.fuel.toLowerCase()}, and let your feelings settle at their own pace. Whatever today holds, showing up is already more than enough. 🤍`

  const energyWord = phase === "menstrual" ? "resting" : phase === "luteal" ? "winding down" : phase === "ovulatory" ? "at its peak" : "climbing"
  const cards = [
    { icon: "🌙", label: "Sleep", value: "7h 20m", sub: "Restful · 92% quality", c: PH.luteal },
    { icon: "🏋️", label: "Exercise", value: copy.training.split(",")[0], sub: p.n + " phase focus", c: p },
    { icon: "🥗", label: "Nutrition", value: copy.fuel.split(",")[0], sub: "Phase-matched fuel", c: PH.menstrual },
    { icon: MOOD_EMOJI[SEED_JOURNAL[0].mood], label: "Feelings", value: "Checked in", sub: `Last mood: ${SEED_JOURNAL[0].mood}/5`, c: PH.ovulatory },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      {/* Hero */}
      <div className="px-6 pt-2 pb-4" style={{ background: `linear-gradient(175deg, ${p.bg} 0%, ${PH.menstrual.bg} 45%, ${C.bg} 100%)` }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.rose})` }}>
              <span className="text-[13px]">🌀</span>
            </div>
            <span className="text-[15px] font-medium" style={{ ...serif, color: C.text }}>Phase</span>
          </div>
          <span className="text-[12px] font-medium" style={{ ...sans, color: C.muted }}>Sun · Jul 13</span>
        </div>
        <p className="text-[12px] font-semibold tracking-[0.16em] uppercase mb-1" style={{ ...sans, color: C.coral }}>Your morning</p>
        <h1 className="text-[30px] leading-[1.1] font-normal" style={{ ...serifItalic, color: C.text }}>Good morning,<br/>Shruti</h1>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: C.card, border: `1px solid ${p.t}`, boxShadow: C.shadow }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: p.c }}/>
          <span className="text-[12px] font-semibold" style={{ ...sans, color: p.c }}>{p.n} · Day {day} · energy {energyWord}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-1" style={{ scrollbarWidth: "none" }}>
        {/* AI morning note */}
        <div className="rounded-3xl p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(140deg, ${C.card} 0%, ${p.bg} 160%)`, boxShadow: C.shadowMd }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles size={13} style={{ color: C.coral }}/>
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ ...sans, color: C.muted }}>
              {live ? "Your note today" : "A note for you"}
            </span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[100, 96, 88, 70].map(w => <div key={w} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: C.bgDeep }}/>)}
            </div>
          ) : (
            <p className="text-[14.5px] leading-relaxed" style={{ ...serifItalic, color: C.text }}>{note || fallback}</p>
          )}
        </div>

        {/* Briefing cards */}
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase block mb-2.5" style={{ ...sans, color: C.muted }}>Where you are today</span>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {cards.map(c => (
            <div key={c.label} className="rounded-2xl p-3.5" style={{ background: C.card, boxShadow: C.shadow }}>
              <div className="flex items-center justify-center rounded-xl mb-2.5" style={{ width: 38, height: 38, background: c.c.bg }}>
                <span className="text-[18px]">{c.icon}</span>
              </div>
              <p className="text-[10px] font-bold tracking-wide uppercase mb-1" style={{ ...sans, color: C.muted }}>{c.label}</p>
              <p className="text-[15px] font-semibold leading-none mb-1" style={{ ...sans, color: C.text }}>{c.value}</p>
              <p className="text-[11px] leading-snug" style={{ ...sans, color: c.c.c }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 pt-2" style={{ background: `linear-gradient(0deg, ${C.bg} 60%, transparent)` }}>
        <button onClick={() => go?.("home")} className="w-full py-4 rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2 mb-2.5" style={{ ...sans, background: C.aubergine, color: C.bg, boxShadow: C.shadowMd }}>
          Begin my day <ArrowRight size={18}/>
        </button>
        <button onClick={() => go?.("obA")} className="w-full text-[12px] font-semibold" style={{ ...sans, color: C.muted }}>
          First time here? Set up your cycle →
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 1 · Onboarding A: Period Date ─────────────────────────────────────

function OnboardingA({ go }: NavProps) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [cycleLen, setCycleLen] = useState(28)
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="flex-1 flex flex-col px-6 pt-2">
        <div className="flex items-center justify-between mb-8">
          <ProgressDots step={1}/>
          <span className="text-[11px] font-medium" style={{ ...sans, color: C.muted }}>1 of 3</span>
        </div>
        <div className="mb-8">
          <p className="text-[12px] font-semibold tracking-widest uppercase mb-3" style={{ ...sans, color: C.coral }}>Getting started</p>
          <h1 className="text-[28px] leading-tight font-medium mb-3" style={{ ...serif, color: C.text }}>When did your last period start?</h1>
          <p className="text-[14px] leading-relaxed" style={{ ...sans, color: C.muted }}>This helps us sync your recommendations to where you actually are in your cycle.</p>
        </div>

        {/* Date Picker Wheel */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="flex divide-x divide-[rgba(59,42,74,0.07)]">
            {/* Month */}
            <div className="flex-1 relative" style={{ height: 180, overflow: "hidden" }}>
              <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)", height: 44, background: "rgba(59,42,74,0.05)", borderRadius: 8, margin: "0 8px" }}/>
              <div className="flex flex-col items-center justify-center h-full gap-1">
                {[-2,-1,0,1,2].map(offset => {
                  const idx = (6 + offset + 12) % 12
                  const isCenter = offset === 0
                  return (
                    <div key={offset} className="py-1" style={{ opacity: Math.abs(offset) === 2 ? 0.2 : Math.abs(offset) === 1 ? 0.5 : 1 }}>
                      <span style={{ ...sans, fontSize: isCenter ? 18 : 15, fontWeight: isCenter ? 600 : 400, color: C.text }}>{months[idx]}</span>
                    </div>
                  )
                })}
              </div>
              <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to bottom, ${C.card}, transparent)` }}/>
              <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to top, ${C.card}, transparent)` }}/>
            </div>
            {/* Day */}
            <div className="flex-1 relative" style={{ height: 180, overflow: "hidden" }}>
              <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)", height: 44, background: "rgba(59,42,74,0.05)", borderRadius: 8, margin: "0 8px" }}/>
              <div className="flex flex-col items-center justify-center h-full gap-1">
                {[10,11,12,13,14].map((d, i) => {
                  const isCenter = i === 2
                  return (
                    <div key={d} className="py-1" style={{ opacity: Math.abs(i-2) === 2 ? 0.2 : Math.abs(i-2) === 1 ? 0.5 : 1 }}>
                      <span style={{ ...sans, fontSize: isCenter ? 18 : 15, fontWeight: isCenter ? 600 : 400, color: C.text }}>{d}</span>
                    </div>
                  )
                })}
              </div>
              <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to bottom, ${C.card}, transparent)` }}/>
              <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to top, ${C.card}, transparent)` }}/>
            </div>
            {/* Year */}
            <div className="flex-1 relative" style={{ height: 180, overflow: "hidden" }}>
              <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)", height: 44, background: "rgba(59,42,74,0.05)", borderRadius: 8, margin: "0 8px" }}/>
              <div className="flex flex-col items-center justify-center h-full gap-1">
                {[2024,2025,2026,2027,2028].map((y, i) => {
                  const isCenter = i === 2
                  return (
                    <div key={y} className="py-1" style={{ opacity: Math.abs(i-2) === 2 ? 0.2 : Math.abs(i-2) === 1 ? 0.5 : 1 }}>
                      <span style={{ ...sans, fontSize: isCenter ? 18 : 15, fontWeight: isCenter ? 600 : 400, color: C.text }}>{y}</span>
                    </div>
                  )
                })}
              </div>
              <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to bottom, ${C.card}, transparent)` }}/>
              <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 50, background: `linear-gradient(to top, ${C.card}, transparent)` }}/>
            </div>
          </div>
        </div>

        {/* Cycle Length Stepper */}
        <div className="rounded-2xl px-5 py-4 mb-8" style={{ background: C.card, boxShadow: C.shadow }}>
          <p className="text-[12px] font-semibold mb-1" style={{ ...sans, color: C.muted }}>Average cycle length</p>
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ ...sans, color: C.text }}>Most cycles are 24–38 days</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setCycleLen(v => Math.max(21, v - 1))} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: C.bg }}>
                <Minus size={14} style={{ color: C.aubergine }}/>
              </button>
              <span className="text-[18px] font-semibold w-8 text-center" style={{ ...sans, color: C.text }}>{cycleLen}</span>
              <button onClick={() => setCycleLen(v => Math.min(38, v + 1))} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: C.bg }}>
                <Plus size={14} style={{ color: C.aubergine }}/>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 mb-6" style={{ background: "rgba(138,168,145,0.12)", border: `1px solid rgba(138,168,145,0.25)` }}>
          <p className="text-[12px] leading-relaxed" style={{ ...sans, color: "#4A7A55" }}>🔒 Your data stays private and is only used to personalize your recommendations.</p>
        </div>
      </div>

      <div className="px-6 pb-8">
        <button onClick={() => go?.("obB")} className="w-full py-4 rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2" style={{ ...sans, background: C.aubergine, color: C.bg }}>
          Continue <ChevronRight size={18}/>
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 2 · Onboarding B: Fitness Level + Goals ───────────────────────────

function OnboardingB({ go }: NavProps) {
  const levels = ["New to lifting", "Returning", "Consistent lifter"]
  const goals = [
    { id: "bone", icon: "🦴", title: "Bone Density & Longevity", desc: "Build strength that lasts decades" },
    { id: "strength", icon: "💪", title: "Strength", desc: "Get stronger every week" },
    { id: "energy", icon: "⚡", title: "Energy", desc: "Feel better all cycle long" },
  ]
  const [level, setLevel] = useState(1)
  const [picked, setPicked] = useState<string[]>(["bone"])
  const toggleGoal = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="flex-1 overflow-y-auto px-6 pt-2">
        <div className="flex items-center justify-between mb-8">
          <ProgressDots step={2}/>
          <span className="text-[11px] font-medium" style={{ ...sans, color: C.muted }}>2 of 3</span>
        </div>
        <h1 className="text-[26px] font-medium leading-tight mb-2" style={{ ...serif, color: C.text }}>What's your fitness background?</h1>
        <p className="text-[14px] mb-7" style={{ ...sans, color: C.muted }}>We'll match workouts to where you are right now.</p>

        {/* Segmented control */}
        <div className="rounded-2xl p-1 mb-8 flex gap-1" style={{ background: C.card, boxShadow: C.shadow }}>
          {levels.map((l, i) => (
            <button key={l} onClick={() => setLevel(i)} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
              style={{ ...sans, background: i === level ? C.aubergine : "transparent", color: i === level ? C.bg : C.muted }}>
              {l}
            </button>
          ))}
        </div>

        <p className="text-[12px] font-bold tracking-widest uppercase mb-1" style={{ ...sans, color: C.muted }}>Your goals</p>
        <p className="text-[12px] mb-4" style={{ ...sans, color: C.muted }}>Choose any that resonate — you can pick more than one.</p>
        <div className="flex flex-col gap-3 mb-8">
          {goals.map(g => {
            const sel = picked.includes(g.id)
            return (
              <button key={g.id} onClick={() => toggleGoal(g.id)} className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left active:scale-[0.99] transition-all"
                style={{ background: sel ? C.card : "rgba(255,253,251,0.55)", boxShadow: sel ? `0 0 0 2px ${C.aubergine}, ${C.shadow}` : C.shadow }}>
                <span className="text-[28px]">{g.icon}</span>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold mb-0.5" style={{ ...sans, color: C.text }}>{g.title}</p>
                  <p className="text-[12px]" style={{ ...sans, color: C.muted }}>{g.desc}</p>
                </div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: sel ? C.aubergine : "transparent", border: sel ? "none" : `2px solid ${C.divider}` }}>
                  {sel && <Check size={12} color="#fff" strokeWidth={2.5}/>}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl px-4 py-3 mb-6" style={{ background: "rgba(220,138,118,0.1)", border: "1px solid rgba(220,138,118,0.2)" }}>
          <p className="text-[12px] leading-relaxed" style={{ ...sans, color: "#B0684A" }}>💡 We nudge <strong>Bone Density &amp; Longevity</strong> because load-bearing exercise is one of the most powerful tools women have for lifelong health — but this is your plan. Choose what matters to you.</p>
        </div>
      </div>

      <div className="px-6 pb-8">
        <button onClick={() => go?.("obC")} className="w-full py-4 rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2" style={{ ...sans, background: C.aubergine, color: C.bg }}>
          Continue <ChevronRight size={18}/>
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 3 · Onboarding C: Bone Health Screener ────────────────────────────

function OnboardingC({ go }: NavProps) {
  const chips = [
    { id: "age40", label: "Age 40+", desc: "Bone density starts declining around 40" },
    { id: "family", label: "Family history of osteoporosis", desc: "Parent or sibling diagnosed" },
    { id: "nosrt", label: "Not currently strength training", desc: "Less than 2x/week right now" },
  ]
  const [active, setActive] = useState<string[]>(["family"])
  const toggle = (id: string) => setActive(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="flex-1 px-6 pt-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <ProgressDots step={3}/>
          <span className="text-[11px] font-medium" style={{ ...sans, color: C.muted }}>3 of 3</span>
        </div>
        <div className="mb-6">
          <p className="text-[12px] font-semibold tracking-widest uppercase mb-3" style={{ ...sans, color: C.coral }}>Bone health profile</p>
          <h1 className="text-[26px] font-medium leading-tight mb-3" style={{ ...serif, color: C.text }}>A few quick questions</h1>
          <p className="text-[14px] leading-relaxed" style={{ ...sans, color: C.muted }}>Select anything that applies. This helps Phase flag bone-health priorities — not to alarm you, but to make your plan more precise.</p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          {chips.map(chip => {
            const on = active.includes(chip.id)
            return (
              <button key={chip.id} onClick={() => toggle(chip.id)} className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left active:scale-[0.99] transition-all" style={{ background: on ? C.card : "rgba(255,253,251,0.55)", boxShadow: on ? `0 0 0 2px ${C.coral}, ${C.shadow}` : C.shadow }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: on ? C.coral : "transparent", border: on ? "none" : `2px solid rgba(122,78,88,0.18)` }}>
                  {on && <Check size={13} color="#fff" strokeWidth={2.5}/>}
                </div>
                <div>
                  <p className="text-[14px] font-semibold mb-0.5" style={{ ...sans, color: C.text }}>{chip.label}</p>
                  <p className="text-[12px]" style={{ ...sans, color: C.muted }}>{chip.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl px-5 py-5 mb-6" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="flex gap-3 mb-3">
            <span className="text-[22px]">🦴</span>
            <div>
              <p className="text-[14px] font-semibold mb-1" style={{ ...sans, color: C.text }}>Why bone health matters now</p>
              <p className="text-[12px] leading-relaxed" style={{ ...sans, color: C.muted }}>Women lose up to 20% of bone density in the 5–7 years after menopause. The strength you build in your 30s and 40s is your best defense — Phase prioritizes load-bearing exercise every cycle.</p>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-center mb-6" style={{ ...sans, color: C.muted }}>Phase is not a medical tool. Always consult your doctor for clinical decisions.</p>
      </div>

      <div className="px-6 pb-8">
        <button onClick={() => go?.("home")} className="w-full py-4 rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2" style={{ ...sans, background: C.aubergine, color: C.bg }}>
          Build my plan <ArrowRight size={18}/>
        </button>
      </div>
    </div>
  )
}

// ─── HOME SCREEN (Follicular & Luteal variants) ────────────────────────────────

interface ChecklistItem {
  id: string; label: string; sub?: string; checked: boolean; img?: string; tag?: string; why?: string
}

interface HomeContent { plan: string; gentle?: string; mindEmoji: string; fuel: ChecklistItem[]; move: ChecklistItem[]; mind: ChecklistItem }

const HOME_CONTENT: Record<PK, HomeContent> = {
  menstrual: {
    plan: "Low energy is normal. Gentle movement and warmth count fully.",
    gentle: "Rest is training. Honor what your body needs today.",
    mindEmoji: "🌬️",
    fuel: [
      { id: "f1", label: "Iron-rich breakfast", sub: "Spinach + eggs to replenish iron", checked: true, img: "/img/spinach.jpg", why: "Iron replenishes what's lost during menstruation" },
      { id: "f2", label: "Warm magnesium-rich meal", sub: "Pumpkin seeds, dark leafy greens", checked: false, img: "/img/pumpkin-seeds.jpg", why: "Magnesium eases cramps and tension" },
    ],
    move: [
      { id: "m1", label: "Gentle Walk — 20 min", sub: "Easy pace, fresh air", checked: false, img: "/img/walk.jpg" },
      { id: "m2", label: "Restorative mobility flow", sub: "15 min — hips & lower back", checked: false, img: "/img/mobility.jpg" },
    ],
    mind: { id: "mi1", label: "10-min wind-down breathwork", sub: "Slow box breathing", checked: false },
  },
  follicular: {
    plan: "Peak energy — a great day for heavy compound lifts.",
    mindEmoji: "🧊",
    fuel: [
      { id: "f1", label: "High-protein breakfast", sub: "30g protein within 1hr of waking", checked: true, img: "/img/eggs.jpg", why: "Protein synthesis peaks in the follicular phase" },
      { id: "f2", label: "Pre-workout complex carbs", sub: "Oats or banana 45min before lifting", checked: false, img: "/img/oats.jpg", why: "Carbs fuel high-intensity output" },
    ],
    move: [
      { id: "m1", label: "Barbell Back Squat", sub: "4 × 8 reps — load-bearing 🦴", checked: true, img: "/img/squat.jpg", tag: "Bone-building" },
      { id: "m2", label: "Romanian Deadlift", sub: "3 × 10 reps — load-bearing 🦴", checked: false, img: "/img/deadlift.jpg", tag: "Bone-building" },
    ],
    mind: { id: "mi1", label: "5-min cold exposure", sub: "Cold shower or cold plunge", checked: false },
  },
  ovulatory: {
    plan: "Estrogen peaks — your strongest, most confident day.",
    mindEmoji: "🌟",
    fuel: [
      { id: "f1", label: "High-protein breakfast", sub: "Greek yogurt + eggs", checked: true, img: "/img/yogurt.jpg", why: "Supports peak-phase muscle building" },
      { id: "f2", label: "Cruciferous veg at lunch", sub: "Broccoli, kale, leafy greens", checked: false, img: "/img/spinach.jpg", why: "Cruciferous veg aid estrogen metabolism" },
    ],
    move: [
      { id: "m1", label: "Hip Thrust — heavy", sub: "4 × 8 reps — load-bearing 🦴", checked: true, img: "/img/hip-thrust.jpg", tag: "Bone-building" },
      { id: "m2", label: "Bent-over Row", sub: "3 × 10 reps — pulling strength", checked: false, img: "/img/row.jpg", tag: "Bone-building" },
    ],
    mind: { id: "mi1", label: "Channel your peak confidence", sub: "Tackle your hardest task today", checked: false },
  },
  luteal: {
    plan: "Energy dips are normal. Steady movement still counts.",
    gentle: "Recovery still counts. A rest day is a training day.",
    mindEmoji: "🌙",
    fuel: [
      { id: "f1", label: "Magnesium-rich snack", sub: "Pumpkin seeds or dark chocolate", checked: true, img: "/img/pumpkin-seeds.jpg", why: "Magnesium eases PMS and improves sleep" },
      { id: "f2", label: "Anti-inflammatory dinner", sub: "Salmon + leafy greens tonight", checked: false, img: "/img/salmon.jpg", why: "Omega-3s reduce luteal-phase inflammation" },
    ],
    move: [
      { id: "m1", label: "Zone 2 Walk — 30 min", sub: "Conversational pace, steady state", checked: false, img: "/img/walk.jpg" },
      { id: "m2", label: "Full-body mobility flow", sub: "20 min — hip & shoulder focus", checked: false, img: "/img/mobility.jpg" },
    ],
    mind: { id: "mi1", label: "10-min wind-down breathwork", sub: "Box breathing before bed", checked: false },
  },
}

function HomeScreen({ phase, dayNum, go, overlay }: { phase: PK; dayNum: number } & NavProps) {
  const p = PH[phase]
  const content = HOME_CONTENT[phase]
  const fuelItems = content.fuel
  const moveItems = content.move
  const mindItem = content.mind

  const allItems = [...fuelItems, ...moveItems, mindItem]
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    allItems.forEach(i => { if (i.checked) init[i.id] = true })
    return init
  })
  const toggle = (id: string) => setDone(d => ({ ...d, [id]: !d[id] }))
  const isDone = (i: ChecklistItem) => !!done[i.id]

  const completed = allItems.filter(isDone).length
  const total = allItems.length

  const circumference = 2 * Math.PI * 46
  const filled = (completed / total) * circumference

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      {/* Header — layered warm gradient */}
      <div className="px-5 pt-1 pb-4" style={{ background: `linear-gradient(180deg, ${p.bg} 0%, ${C.bg} 100%)` }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[12px] font-medium" style={{ ...sans, color: C.muted }}>Sunday, July 13</p>
          <button onClick={() => overlay?.("quicklog")} className="active:opacity-70"><PhasePill phase={phase} day={dayNum}/></button>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-[26px] font-normal leading-tight" style={{ ...serifItalic, color: C.text }}>Good morning,<br/></h1>
          <button onClick={() => overlay?.("quicklog")} className="text-[11px] font-semibold px-3.5 py-2 rounded-full flex-shrink-0" style={{ ...sans, background: C.card, color: p.c, border: `1px solid ${p.t}`, boxShadow: C.shadow }}>＋ Check-in</button>
        </div>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center gap-5 px-5 py-3 mx-5 rounded-2xl mb-4" style={{ background: C.card, boxShadow: C.shadow }}>
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke={p.t} strokeWidth="8"/>
            <circle cx="50" cy="50" r="46" fill="none" stroke={p.c} strokeWidth="8"
              strokeDasharray={`${filled} ${circumference - filled}`} strokeLinecap="round"/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-bold leading-none" style={{ ...sans, color: C.text }}>{completed}</span>
            <span className="text-[10px]" style={{ ...sans, color: C.muted }}>of {total}</span>
          </div>
        </div>
        <div>
          <p className="text-[16px] font-semibold mb-0.5" style={{ ...sans, color: C.text }}>Today&apos;s Plan</p>
          <p className="text-[13px] leading-snug" style={{ ...sans, color: C.muted }}>
            {content.plan}
          </p>
        </div>
      </div>

      {/* Gentle banner for lower-energy phases */}
      {content.gentle && (
        <div className="mx-5 mb-3 px-4 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: p.bg, border: `1px solid ${p.t}` }}>
          <Moon size={14} style={{ color: p.c, flexShrink: 0 }}/>
          <p className="text-[12px] font-medium" style={{ ...sans, color: p.c }}>{content.gentle}</p>
        </div>
      )}

      {/* Scrollable checklist */}
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* FUEL */}
        <SectionLabel label="Fuel" icon={<Leaf size={12}/>}/>
        <div className="flex flex-col gap-2 mb-4">
          {fuelItems.map(item => (
            <div key={item.id} onClick={() => go?.("nutrition")} className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-transform" style={{ background: C.card, boxShadow: C.shadow }}>
              <img src={item.img} alt={item.label} className="rounded-xl object-cover flex-shrink-0" style={{ width: 52, height: 52, background: C.bg }}/>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ ...sans, color: C.text }}>{item.label}</p>
                <p className="text-[11px] truncate" style={{ ...sans, color: C.muted }}>{item.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); overlay?.("why") }} className="text-[10px] font-semibold mt-0.5 flex items-center gap-0.5" style={{ ...sans, color: C.coral }}>
                  why →
                </button>
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggle(item.id) }} className="active:scale-90 transition-transform"><Checkbox checked={isDone(item)} color={p.c}/></button>
            </div>
          ))}
        </div>

        {/* MOVE */}
        <SectionLabel label="Move" icon={<Dumbbell size={12}/>}/>
        <div className="flex flex-col gap-2 mb-4">
          {moveItems.map(item => (
            <div key={item.id} onClick={() => go?.("workout")} className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-transform" style={{ background: C.card, boxShadow: C.shadow }}>
              <img src={item.img} alt={item.label} className="rounded-xl object-cover flex-shrink-0" style={{ width: 52, height: 52, background: C.bg }}/>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ ...sans, color: C.text }}>{item.label}</p>
                {item.tag && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-0.5"
                    style={{ background: `${p.bg}`, color: p.c, border: `1px solid ${p.t}` }}>
                    🦴 {item.tag}
                  </span>
                )}
                <p className="text-[11px] truncate" style={{ ...sans, color: C.muted }}>{item.sub}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggle(item.id) }} className="active:scale-90 transition-transform"><Checkbox checked={isDone(item)} color={p.c}/></button>
            </div>
          ))}
        </div>

        {/* MIND */}
        <SectionLabel label="Mind" icon={<Brain size={12}/>}/>
        <div className="mb-6">
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: C.card, boxShadow: C.shadow }}>
            <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 52, height: 52, background: p.bg }}>
              <span className="text-[24px]">{content.mindEmoji}</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>{mindItem.label}</p>
              <p className="text-[11px]" style={{ ...sans, color: C.muted }}>{mindItem.sub}</p>
            </div>
            <button onClick={() => toggle(mindItem.id)} className="active:scale-90 transition-transform"><Checkbox checked={isDone(mindItem)} color={p.c}/></button>
          </div>
        </div>

        {/* Encouragement + journal entry */}
        <button onClick={() => go?.("journal")} className="w-full flex items-center gap-3 p-4 rounded-2xl mb-6 text-left active:scale-[0.99] transition-transform" style={{ background: `linear-gradient(135deg, ${C.card} 0%, ${p.bg} 130%)`, boxShadow: C.shadow }}>
          <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 42, height: 42, background: p.bg }}>
            <Heart size={18} style={{ color: p.c }} fill={p.c}/>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>
              {completed === total ? "You did everything today 🤍" : completed > 0 ? "You're doing well today" : "However you feel today is okay"}
            </p>
            <p className="text-[11px]" style={{ ...serifItalic, color: C.muted }}>How are you feeling? Open your journal →</p>
          </div>
        </button>
      </div>

      <BottomNav active="today" phase={phase} onNav={go}/>
    </div>
  )
}

// ─── SCREEN 6 · Workout Detail ─────────────────────────────────────────────────

function WorkoutDetail({ back, overlay }: NavProps) {
  const p = PH.follicular
  const exercises = [
    { name: "Barbell Back Squat", sets: "4 × 8", img: "/img/squat.jpg", bone: true, load: "75–80% 1RM" },
    { name: "Romanian Deadlift", sets: "3 × 10", img: "/img/deadlift.jpg", bone: true, load: "70% 1RM" },
    { name: "Dumbbell Bent-over Row", sets: "3 × 12 each", img: "/img/row.jpg", bone: false, load: "Moderate" },
    { name: "Hip Thrust", sets: "3 × 15", img: "/img/hip-thrust.jpg", bone: true, load: "Heavy" },
  ]
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="flex items-center gap-3 px-5 pb-3">
        <button onClick={() => back?.()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card, boxShadow: C.shadow }}>
          <ChevronRight size={18} style={{ color: C.text, transform: "rotate(180deg)" }}/>
        </button>
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ ...sans, color: C.muted }}>Today&apos;s Movement</p>
          <h1 className="text-[22px] font-medium leading-tight" style={{ ...serif, color: C.text }}>Strength Day</h1>
        </div>
        <div className="ml-auto"><PhasePill phase="follicular"/></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4" style={{ background: p.bg, border: `1px solid ${p.t}` }}>
          <span className="text-[20px]">💪</span>
          <p className="text-[12px] leading-snug flex-1" style={{ ...sans, color: p.c }}>
            <strong>Follicular phase</strong> — estrogen is rising, making this your strongest week. Push for progressive overload today.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          {exercises.map((ex, i) => (
            <div key={i} onClick={() => overlay?.("why")} className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform" style={{ background: C.card, boxShadow: C.shadow }}>
              <div className="relative" style={{ height: 140 }}>
                <img src={ex.img} alt={ex.name} className="w-full h-full object-cover" style={{ background: p.bg }}/>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(42,30,54,0.7) 0%, transparent 60%)" }}/>
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                  {ex.bone && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(8px)" }}>
                      🦴 Bone-building
                    </span>
                  )}
                  <p className="text-[16px] font-semibold text-white">{ex.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ ...sans, color: C.text }}>{ex.sets}</span>
                    <span className="text-[12px]" style={{ ...sans, color: C.muted }}>· {ex.load}</span>
                  </div>
                </div>
                <button className="text-[12px] font-semibold flex items-center gap-1" style={{ ...sans, color: p.c }}>
                  Form tips <ChevronRight size={12}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-8 pt-2">
        <button className="w-full py-4 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2" style={{ ...sans, background: p.c, color: "#fff" }}>
          <Check size={18} strokeWidth={2.5}/> Mark Session Complete
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 7 · Nutrition Detail ──────────────────────────────────────────────

function NutritionDetail({ back }: NavProps) {
  const p = PH.follicular
  const macros = [
    { label: "Protein", target: "130g", checked: true },
    { label: "Calcium", target: "1000mg", checked: false },
    { label: "Vitamin D", target: "600 IU", checked: true },
    { label: "Magnesium", target: "320mg", checked: false },
  ]
  const foods = [
    { name: "Wild Salmon", micro: "Vitamin D", img: "/img/salmon.jpg" },
    { name: "Spinach", micro: "Calcium", img: "/img/spinach.jpg" },
    { name: "Pumpkin Seeds", micro: "Magnesium", img: "/img/pumpkin-seeds.jpg" },
    { name: "Greek Yogurt", micro: "Calcium · Protein", img: "/img/yogurt.jpg" },
    { name: "Eggs", micro: "Vitamin D · Protein", img: "/img/eggs.jpg" },
    { name: "Edamame", micro: "Protein · Magnesium", img: "/img/edamame.jpg" },
  ]
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="flex items-center gap-3 px-5 pb-3">
        <button onClick={() => back?.()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card, boxShadow: C.shadow }}>
          <ChevronRight size={18} style={{ color: C.text, transform: "rotate(180deg)" }}/>
        </button>
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ ...sans, color: C.muted }}>Today&apos;s Fuel</p>
          <h1 className="text-[22px] font-medium leading-tight" style={{ ...serif, color: C.text }}>Nutrition Guide</h1>
        </div>
        <div className="ml-auto"><PhasePill phase="follicular"/></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* Macro target chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {macros.map(m => (
            <div key={m.label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: m.checked ? p.bg : C.card, border: `1.5px solid ${m.checked ? p.t : C.divider}` }}>
              <Checkbox checked={m.checked} color={p.c}/>
              <div>
                <p className="text-[12px] font-semibold leading-none" style={{ ...sans, color: m.checked ? p.c : C.text }}>{m.label}</p>
                <p className="text-[10px]" style={{ ...sans, color: C.muted }}>{m.target}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12px] font-bold tracking-widest uppercase mb-3" style={{ ...sans, color: C.muted }}>Recommended foods today</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {foods.map(f => (
            <div key={f.name} className="rounded-2xl overflow-hidden" style={{ background: C.card, boxShadow: C.shadow }}>
              <img src={f.img} alt={f.name} className="w-full object-cover" style={{ height: 100, background: p.bg }}/>
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-semibold mb-0.5" style={{ ...sans, color: C.text }}>{f.name}</p>
                <p className="text-[10px] font-medium" style={{ ...sans, color: p.c }}>{f.micro}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl px-5 py-4 mb-6" style={{ background: C.card, boxShadow: C.shadow }}>
          <p className="text-[13px] font-semibold mb-2" style={{ ...sans, color: C.text }}>🌱 Follicular phase nutrition</p>
          <p className="text-[12px] leading-relaxed" style={{ ...sans, color: C.muted }}>Rising estrogen enhances insulin sensitivity — complex carbs alongside protein support strength gains and sustained energy throughout your strongest phase.</p>
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN 8 · Why Sheet ──────────────────────────────────────────────────────

function WhySheet({ overlay }: NavProps) {
  const p = PH.follicular
  const [ev, setEv] = useState<{ summary: string; source: string; url: string } | null>(null)
  const [searching, setSearching] = useState(true)
  useEffect(() => {
    let alive = true
    fetchEvidence("follicular phase load-bearing barbell squat bone mineral density in women evidence")
      .then(r => { if (!alive) return; setEv(r); setSearching(false) })
    return () => { alive = false }
  }, [])
  return (
    <div className="flex flex-col h-full animate-[fadeIn_0.2s_ease]" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="flex-1" onClick={() => overlay?.(null)}/>
      <div className="rounded-t-[28px] flex flex-col animate-[sheetUp_0.28s_cubic-bezier(0.16,1,0.3,1)]" style={{ background: C.card, height: "80%" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="rounded-full" style={{ width: 40, height: 4, background: "rgba(59,42,74,0.15)" }}/>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-2" style={{ scrollbarWidth: "none" }}>
          <PhasePill phase="follicular" size="sm"/>
          <h2 className="text-[24px] font-medium leading-tight mt-3 mb-1" style={{ ...serif, color: C.text }}>Barbell Back Squat</h2>
          <p className="text-[12px] font-medium mb-5" style={{ ...sans, color: C.muted }}>4 sets · 8 reps · Load-bearing</p>

          <div className="rounded-2xl overflow-hidden mb-5" style={{ height: 180 }}>
            <img src="/img/squat.jpg"
              alt="Barbell squat" className="w-full h-full object-cover" style={{ background: p.bg }}/>
          </div>

          <div className="mb-5">
            <p className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ ...sans, color: C.muted }}>Why this exercise now</p>
            <p className="text-[14px] leading-relaxed mb-3" style={{ ...sans, color: C.text }}>
              Compound, load-bearing movements like the barbell squat place compressive stress on the femur and lumbar spine — the two sites most vulnerable to osteoporotic fracture in women.
            </p>
            <p className="text-[14px] leading-relaxed" style={{ ...sans, color: C.text }}>
              In your follicular phase, elevated estrogen maximizes bone mineral density response to loading. This is the ideal time to push progressive overload.
            </p>
          </div>

          <div className="mb-5">
            <p className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ ...sans, color: C.muted }}>Form cues</p>
            {["Bar sits on upper traps — brace core before unracking", "Feet shoulder-width, toes slightly out. Knees track over toes throughout", "Break at hips and knees simultaneously. Reach depth — crease of hip below knee"].map((cue, i) => (
              <div key={i} className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: p.bg, color: p.c }}>{i + 1}</div>
                <p className="text-[13px] leading-snug flex-1" style={{ ...sans, color: C.text }}>{cue}</p>
              </div>
            ))}
          </div>

          {/* Live, citation-backed evidence (Tavily) */}
          {ev?.summary && (
            <div className="mb-4 rounded-2xl px-4 py-3.5" style={{ background: p.bg, border: `1px solid ${p.t}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={12} style={{ color: p.c }}/>
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ ...sans, color: p.c }}>Latest evidence</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ ...sans, color: C.text }}>{ev.summary}</p>
            </div>
          )}

          <div className="mb-6">
            {searching ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: C.bg, border: `1px solid ${C.divider}` }}>
                <Sparkles size={14} style={{ color: C.muted }} className="animate-pulse"/>
                <span className="text-[12px]" style={{ ...sans, color: C.muted }}>Searching the latest research…</span>
              </div>
            ) : (
              <SourceCard study={ev?.source
                ? `${ev.source} →`
                : "Sinaki et al. — Osteoporosis Int. (2004): Load-bearing exercise and bone mineral density in women →"}/>
            )}
          </div>
        </div>

        <div className="px-6 pb-8 pt-2">
          <button onClick={() => overlay?.(null)} className="w-full py-4 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2" style={{ ...sans, background: p.c, color: "#fff" }}>
            <Check size={18} strokeWidth={2.5}/> Mark Complete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN 9 · Cycle View ────────────────────────────────────────────────────

const PHASE_COPY: Record<PK, { training: string; fuel: string; blurb: string }> = {
  menstrual: { training: "Restorative — walking, yoga, mobility", fuel: "Iron + magnesium, warm nourishing meals", blurb: "Energy is lowest as hormones dip. Rest is training too — gentle movement and warmth serve you now." },
  follicular: { training: "Heavy compound lifts, maximal strength", fuel: "High protein + complex carbs pre-workout", blurb: "Estrogen is rising — your peak window for strength, PRs, and learning new movements." },
  ovulatory: { training: "Peak power — max muscle recruitment", fuel: "Cruciferous veg + structural protein", blurb: "Estrogen peaks. Highest energy and confidence — go for your strongest sessions (mind your form as laxity rises)." },
  luteal: { training: "Strength-endurance, Zone 2, deload", fuel: "Healthy fats, calcium + magnesium", blurb: "Progesterone rises and recovery slows. Shift to higher reps and steady cardio — consistency over intensity." },
}

function CycleView({ go, overlay, periods = SEED_PERIODS, onLogPeriod }: NavProps & { periods?: Period[]; onLogPeriod?: (p: Period) => void }) {
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const c = computeCycle(periods)
  const cur = PH[c.phaseKey]
  const copy = PHASE_COPY[c.phaseKey]

  const save = () => { if (!start) return; onLogPeriod?.({ start, end: end || undefined }); setStart(""); setEnd("") }
  const fmt = (iso: string) => { try { return format(parseISO(iso), "MMM d") } catch { return iso } }

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="px-5 pb-3" style={{ background: `linear-gradient(180deg, ${cur.bg} 0%, ${C.bg} 100%)` }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ ...sans, color: C.muted }}>Your cycle</p>
        <h1 className="text-[26px] font-normal" style={{ ...serifItalic, color: C.text }}>{c.cycleLength}-day rhythm</h1>
        <p className="text-[12px] mt-0.5" style={{ ...sans, color: C.muted }}>Calculated from your logged periods — not a fixed 28.</p>
      </div>

      {/* Dynamic ribbon (scaled to YOUR cycle length) */}
      <div className="mx-5 mt-3 mb-5 rounded-2xl overflow-hidden" style={{ background: C.card, boxShadow: C.shadow }}>
        <div className="flex" style={{ height: 52 }}>
          {c.bounds.map(([phase, s, e]) => {
            const days = Math.max(0, e - s + 1)
            if (days <= 0) return null
            const p = PH[phase]
            const pct = (days / c.cycleLength) * 100
            return (
              <div key={phase} className="relative flex items-center justify-center" style={{ width: `${pct}%`, background: p.bg }}>
                <span className="text-[10px] font-bold" style={{ ...sans, color: p.c }}>{p.n.slice(0, 3).toUpperCase()}</span>
                {c.day >= s && c.day <= e && (
                  <div className="absolute rounded-full" style={{ width: 8, height: 8, top: 6, background: p.c, border: "2px solid #fff", right: `${((e - c.day) / days) * 100}%` }}/>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${C.divider}` }}>
          <div className="w-2 h-2 rounded-full" style={{ background: cur.c }}/>
          <span className="text-[12px] font-semibold" style={{ ...sans, color: C.text }}>Day {c.day} · {cur.n}</span>
          {c.nextOvu != null && <span className="text-[11px] ml-auto" style={{ ...sans, color: C.muted }}>Ovulatory in {c.nextOvu} {c.nextOvu === 1 ? "day" : "days"}</span>}
        </div>
      </div>

      {/* Current phase card (dynamic) */}
      <div className="mx-5 mb-4 p-5 rounded-2xl" style={{ background: cur.bg, border: `1.5px solid ${cur.t}`, boxShadow: C.shadow }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[20px]">{cur.emoji}</span>
          <h2 className="text-[18px] font-medium" style={{ ...serif, color: cur.c }}>{cur.n} Phase</h2>
        </div>
        <p className="text-[13px] leading-relaxed mb-3" style={{ ...sans, color: C.text }}>{copy.blurb}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl" style={{ background: "#fff" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ ...sans, color: C.muted }}>Training</p>
            <p className="text-[12px]" style={{ ...sans, color: C.text }}>{copy.training}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "#fff" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ ...sans, color: C.muted }}>Fuel focus</p>
            <p className="text-[12px]" style={{ ...sans, color: C.text }}>{copy.fuel}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* Log a period — start + end dates */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} style={{ color: C.coral }}/>
            <p className="text-[14px] font-semibold" style={{ ...sans, color: C.text }}>Log a period</p>
          </div>
          <div className="flex gap-2.5 mb-3">
            <label className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ ...sans, color: C.muted }}>Start date</span>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none" style={{ ...sans, background: C.bg, color: C.text, border: `1px solid ${C.divider}` }}/>
            </label>
            <label className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ ...sans, color: C.muted }}>End date <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></span>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none" style={{ ...sans, background: C.bg, color: C.text, border: `1px solid ${C.divider}` }}/>
            </label>
          </div>
          <button onClick={save} disabled={!start} className="w-full py-3 rounded-xl font-semibold text-[13px]" style={{ ...sans, background: start ? C.aubergine : C.bgDeep, color: start ? C.bg : C.muted }}>
            Save period
          </button>
          <p className="text-[11px] mt-2.5 text-center" style={{ ...serifItalic, color: C.muted }}>Your cycle length updates automatically from what you log.</p>
        </div>

        {/* Period history + computed lengths */}
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ ...sans, color: C.muted }}>Logged periods · avg {c.cycleLength} days</p>
        <div className="flex flex-col gap-2 mb-4">
          {c.sorted.slice().reverse().map((pd, i, arr) => {
            const idxInSorted = c.sorted.length - 1 - i
            const prev = c.sorted[idxInSorted - 1]
            const len = prev ? differenceInDays(parseISO(pd.start), parseISO(prev.start)) : null
            return (
              <div key={pd.start} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: C.card, boxShadow: C.shadow }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PH.menstrual.c }}/>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>{fmt(pd.start)}{pd.end ? ` – ${fmt(pd.end)}` : ""}</p>
                  <p className="text-[11px]" style={{ ...sans, color: C.muted }}>{i === 0 ? "Most recent" : len ? `${len}-day cycle` : "First logged"}</p>
                </div>
                {len && <span className="text-[11px] font-semibold" style={{ ...sans, color: C.muted }}>{len}d</span>}
              </div>
            )
          })}
        </div>

        <button onClick={() => overlay?.("phaseAlert")} className="w-full py-3 rounded-2xl font-semibold text-[13px] mb-6 flex items-center justify-center gap-2" style={{ ...sans, background: PH.luteal.bg, color: PH.luteal.c, border: `1.5px solid ${PH.luteal.t}` }}>
          🌙 Preview next phase transition
        </button>
      </div>
      <BottomNav active="cycle" phase="follicular" onNav={go}/>
    </div>
  )
}

// ─── SCREEN 10 · Quick Log ────────────────────────────────────────────────────

function PhaseSlider({ value, onChange, gradient, thumb }: { value: number; onChange: (v: number) => void; gradient: string; thumb: string }) {
  const pct = ((value - 1) / 4) * 100
  return (
    <div className="relative" style={{ height: 44 }}>
      <div className="absolute top-1/2 -translate-y-1/2 w-full rounded-full pointer-events-none" style={{ height: 6, background: C.bgDeep }}/>
      <div className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{ height: 6, width: `${pct}%`, background: gradient }}/>
      <div className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white pointer-events-none" style={{ left: `calc(${pct}% - 14px)`, background: thumb, boxShadow: "0 2px 8px rgba(122,78,88,0.28)" }}/>
      <input type="range" min={1} max={5} step={1} value={value} onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer" style={{ height: 44 }}/>
    </div>
  )
}

function QuickLog({ overlay, onSave, phaseName = "Follicular" }: NavProps & { onSave?: (e: Omit<JournalEntry, "id" | "date">) => void; phaseName?: string }) {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(4)
  const [note, setNote] = useState("")
  const save = () => { onSave?.({ mood, energy, note: note.trim() || "Checked in.", phase: phaseName }); overlay?.(null) }
  return (
    <div className="flex flex-col h-full animate-[fadeIn_0.2s_ease]" style={{ background: "rgba(42,30,34,0.5)" }}>
      <div className="flex-1" onClick={() => overlay?.(null)}/>
      <div className="rounded-t-[28px] px-6 pt-3 pb-8 animate-[sheetUp_0.28s_cubic-bezier(0.16,1,0.3,1)]" style={{ background: C.card }}>
        <div className="flex justify-center mb-4">
          <div className="rounded-full" style={{ width: 40, height: 4, background: "rgba(122,78,88,0.15)" }}/>
        </div>
        <div className="text-center mb-1"><span className="text-[40px]">{MOOD_EMOJI[mood]}</span></div>
        <h2 className="text-[24px] font-normal mb-1 text-center" style={{ ...serifItalic, color: C.text }}>How are you feeling?</h2>
        <p className="text-[13px] mb-6 text-center" style={{ ...sans, color: C.muted }}>A gentle check-in — no wrong answers.</p>

        {/* Mood */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>Mood</p>
            <span className="text-[18px]">{MOOD_EMOJI[mood]}</span>
          </div>
          <PhaseSlider value={mood} onChange={setMood} gradient={`linear-gradient(to right, ${C.sage}, ${C.coral})`} thumb={C.coral}/>
          <div className="flex justify-between mt-1">
            <span className="text-[11px]" style={{ ...sans, color: C.muted }}>Low</span>
            <span className="text-[11px]" style={{ ...sans, color: C.muted }}>Great</span>
          </div>
        </div>

        {/* Energy */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>Energy</p>
            <span className="text-[18px]">{["", "🪫", "🔋", "🔋", "⚡", "⚡"][energy]}</span>
          </div>
          <PhaseSlider value={energy} onChange={setEnergy} gradient={`linear-gradient(to right, ${PH.menstrual.c}, ${PH.ovulatory.c})`} thumb={PH.ovulatory.c}/>
          <div className="flex justify-between mt-1">
            <span className="text-[11px]" style={{ ...sans, color: C.muted }}>Drained</span>
            <span className="text-[11px]" style={{ ...sans, color: C.muted }}>Energised</span>
          </div>
        </div>

        {/* Journal note */}
        <div className="mb-6">
          <p className="text-[13px] font-semibold mb-2" style={{ ...sans, color: C.text }}>A note to yourself <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What's on your mind today?"
            className="w-full rounded-2xl px-4 py-3 text-[13px] resize-none outline-none" style={{ ...sans, background: C.bg, color: C.text, border: `1px solid ${C.divider}` }}/>
        </div>

        <button onClick={save} className="w-full py-4 rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2" style={{ ...sans, background: C.aubergine, color: C.bg }}>
          <PenLine size={16}/> Save to journal
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 11 · Insights / Bone Health ──────────────────────────────────────

function Insights({ go }: NavProps) {
  const weeks = [
    { label: "W1", sessions: 3, target: 3 },
    { label: "W2", sessions: 2, target: 3 },
    { label: "W3", sessions: 3, target: 3 },
    { label: "W4", sessions: 3, target: 3 },
    { label: "W5", sessions: 1, target: 3 },
    { label: "W6", sessions: 3, target: 3 },
    { label: "W7", sessions: 2, target: 3 },
  ]
  const maxH = 72

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      <div className="px-5 pb-3">
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ ...sans, color: C.muted }}>Insights</p>
        <h1 className="text-[26px] font-medium" style={{ ...serif, color: C.text }}>Bone longevity</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* Risk card */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[16px]">🦴</span>
              <p className="text-[15px] font-semibold" style={{ ...sans, color: C.text }}>Bone Health Profile</p>
            </div>
            <p className="text-[12px]" style={{ ...sans, color: C.muted }}>Based on your onboarding responses</p>
          </div>

          {[
            { icon: "✓", label: "No age-related risk", note: "Under 40", ok: true },
            { icon: "⚠", label: "Family history of osteoporosis", note: "Consider mentioning to your GP", ok: false },
            { icon: "✓", label: "Strength training regularly", note: "8 sessions this month", ok: true },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < 2 ? `1px solid ${C.divider}` : "none" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                style={{ background: r.ok ? "#EFF5ED" : "#FBF4E6", color: r.ok ? PH.follicular.c : PH.ovulatory.c }}>
                {r.icon}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>{r.label}</p>
                <p className="text-[11px]" style={{ ...sans, color: C.muted }}>{r.note}</p>
              </div>
            </div>
          ))}

          <div className="mx-4 mb-4 mt-2 px-4 py-3 rounded-xl" style={{ background: "rgba(217,164,65,0.1)", border: "1px solid rgba(217,164,65,0.25)" }}>
            <p className="text-[12px] leading-snug" style={{ ...sans, color: "#A07820" }}>
              💬 Your profile suggests asking your doctor about a <strong>DEXA scan</strong> at your next check-up. This is preventive — not urgent.
            </p>
          </div>
        </div>

        {/* Consistency chart */}
        <div className="rounded-2xl px-5 pt-4 pb-5 mb-4" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[15px] font-semibold" style={{ ...sans, color: C.text }}>Strength sessions</p>
            <span className="text-[12px] font-medium" style={{ ...sans, color: C.sage }}>17 this month 🎉</span>
          </div>
          <p className="text-[12px] mb-5" style={{ ...sans, color: C.muted }}>Every session builds bone — no streak required.</p>
          <div className="flex items-end gap-2" style={{ height: maxH + 24 }}>
            {weeks.map((w, i) => {
              const h = Math.round((w.sessions / w.target) * maxH)
              const isLow = w.sessions < w.target
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-lg" style={{ height: h, background: isLow ? PH.luteal.t : PH.follicular.bg, border: `1.5px solid ${isLow ? PH.luteal.c : PH.follicular.c}`, transition: "height 0.3s" }}/>
                  <span className="text-[9px] font-medium" style={{ ...sans, color: C.muted }}>{w.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Phase breakdown */}
        <div className="rounded-2xl px-5 py-4 mb-6" style={{ background: C.card, boxShadow: C.shadow }}>
          <p className="text-[13px] font-semibold mb-3" style={{ ...sans, color: C.text }}>Monthly training breakdown</p>
          {(["follicular","ovulatory","luteal","menstrual"] as PK[]).map(phase => {
            const p = PH[phase]
            const pct = phase === "follicular" ? 70 : phase === "ovulatory" ? 85 : phase === "luteal" ? 60 : 40
            return (
              <div key={phase} className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.c }}/>
                <span className="text-[12px] font-medium w-20" style={{ ...sans, color: C.text }}>{p.n}</span>
                <div className="flex-1 rounded-full" style={{ height: 6, background: C.bg }}>
                  <div className="rounded-full" style={{ height: 6, width: `${pct}%`, background: p.c, opacity: 0.7 }}/>
                </div>
                <span className="text-[11px] w-8 text-right" style={{ ...sans, color: C.muted }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav active="insights" phase="follicular" onNav={go}/>
    </div>
  )
}

// ─── SCREEN 12 · Phase Transition Alert ──────────────────────────────────────

function PhaseTransitionAlert({ overlay }: NavProps) {
  const p = PH.luteal
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 animate-[fadeIn_0.2s_ease]" style={{ background: "rgba(30,15,45,0.65)", backdropFilter: "blur(16px)" }}>
      <div className="w-full rounded-3xl overflow-hidden animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)]" style={{ background: C.card, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        {/* Gradient header */}
        <div className="px-6 pt-6 pb-5" style={{ background: `linear-gradient(135deg, ${p.bg} 0%, ${p.t} 100%)` }}>
          <div className="text-[48px] mb-3 text-center">🌙</div>
          <h2 className="text-[22px] font-medium text-center leading-tight" style={{ ...serif, color: p.c }}>
            You&apos;ve entered your<br/>Luteal phase
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-[14px] leading-relaxed mb-5 text-center" style={{ ...sans, color: C.text }}>
            Energy naturally dips during this phase — and that&apos;s completely normal. We&apos;ve shifted today&apos;s plan to Zone 2 cardio and mobility work.
          </p>
          <p className="text-[13px] leading-relaxed text-center mb-5" style={{ ...sans, color: C.muted }}>
            This isn&apos;t falling behind. This is training smart — honoring your body&apos;s rhythm is exactly what longevity looks like.
          </p>

          <div className="flex flex-col gap-2 mb-6">
            {[
              { label: "Movement", from: "Heavy compound lifts", to: "Zone 2 + mobility" },
              { label: "Nutrition", from: "High carb", to: "Magnesium-rich focus" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: p.bg }}>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ ...sans, color: p.c }}>{item.label}</p>
                  <p className="text-[12px]" style={{ ...sans, color: C.muted }}><span className="line-through">{item.from}</span> → {item.to}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => overlay?.(null)} className="w-full py-4 rounded-2xl font-semibold text-[16px]" style={{ ...sans, background: p.c, color: "#fff" }}>
            Got it, thank you 🤍
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Gallery Sections ─────────────────────────────────────────────────────────

function GallerySection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <div className="mb-8 text-center">
        <h2 className="text-[13px] font-bold tracking-[0.2em] uppercase mb-1" style={{ ...sans, color: "rgba(247,244,239,0.35)" }}>{title}</h2>
        {sub && <p className="text-[15px]" style={{ ...sans, color: "rgba(247,244,239,0.55)" }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Expanded Modal ────────────────────────────────────────────────────────────

function ExpandedView({ screen, onClose }: { screen: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(10,4,20,0.85)", backdropFilter: "blur(20px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>
        <PhoneFrame scale={0.88} label="">
          {screen}
        </PhoneFrame>
      </div>
      <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(247,244,239,0.12)" }}>
        <X size={18} color="rgba(247,244,239,0.7)"/>
      </button>
    </div>
  )
}

// ─── SCREEN · Journal (mood log over time) ─────────────────────────────────────

function JournalScreen({ go, overlay, journal = [] }: NavProps & { journal?: JournalEntry[] }) {
  const avgMood = journal.length ? journal.reduce((s, e) => s + e.mood, 0) / journal.length : 0
  const trend = [...journal].slice(0, 7).reverse()
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      {/* Warm header */}
      <div className="px-5 pt-1 pb-5" style={{ background: `linear-gradient(180deg, ${PH.luteal.bg} 0%, ${C.bg} 100%)` }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} style={{ color: C.coral }}/>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ ...sans, color: C.muted }}>Your journal</p>
        </div>
        <h1 className="text-[26px] font-normal leading-tight mb-1" style={{ ...serifItalic, color: C.text }}>You&apos;re doing well, Shruti</h1>
        <p className="text-[13px] leading-relaxed" style={{ ...sans, color: C.muted }}>
          {journal.length} check-ins logged. Noticing how you feel is its own kind of strength.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* Mood trend */}
        <div className="rounded-2xl px-5 pt-4 pb-5 mb-4" style={{ background: C.card, boxShadow: C.shadow }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-semibold" style={{ ...sans, color: C.text }}>Mood this week</p>
            <span className="text-[12px] font-medium" style={{ ...sans, color: C.coral }}>avg {avgMood.toFixed(1)} {MOOD_EMOJI[Math.round(avgMood)] || ""}</span>
          </div>
          <div className="flex items-end justify-between gap-2" style={{ height: 92 }}>
            {trend.map(e => (
              <div key={e.id} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[15px]">{MOOD_EMOJI[e.mood]}</span>
                <div className="w-full rounded-lg" style={{ height: (e.mood / 5) * 60, background: `linear-gradient(to top, ${C.coral}, ${PH.ovulatory.t})` }}/>
                <span className="text-[9px] font-medium" style={{ ...sans, color: C.muted }}>{e.date.split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How are you feeling CTA */}
        <button onClick={() => overlay?.("quicklog")} className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 text-left active:scale-[0.99] transition-transform" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.rose})`, boxShadow: C.shadowMd }}>
          <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 44, height: 44, background: "rgba(255,255,255,0.22)" }}>
            <PenLine size={19} color="#fff"/>
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-white" style={{ ...sans }}>How are you feeling right now?</p>
            <p className="text-[12px]" style={{ ...sans, color: "rgba(255,255,255,0.85)" }}>Add today&apos;s check-in →</p>
          </div>
        </button>

        {/* Entries */}
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase block mb-2" style={{ ...sans, color: C.muted }}>Past entries</span>
        <div className="flex flex-col gap-2.5 mb-6">
          {journal.map(e => {
            const p = PH[(e.phase.toLowerCase() as PK)] ?? PH.follicular
            return (
              <div key={e.id} className="rounded-2xl p-4" style={{ background: C.card, boxShadow: C.shadow }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[20px]">{MOOD_EMOJI[e.mood]}</span>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold" style={{ ...sans, color: C.text }}>{e.date}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ ...sans, background: p.bg, color: p.c }}>{e.phase}</span>
                      <span className="text-[10px]" style={{ ...sans, color: C.muted }}>Energy {e.energy}/5</span>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ ...serifItalic, color: C.text }}>&ldquo;{e.note}&rdquo;</p>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav active="journal" phase="follicular" onNav={go}/>
    </div>
  )
}

// ─── SCREEN 13 · Profile / You (options + extra recommendations) ───────────────

function ProfileScreen({ go }: NavProps) {
  const supplements = [
    { name: "Vitamin D3 + K2", note: "Bone mineralization — pairs with calcium", tag: "Daily", c: PH.ovulatory.c, bg: PH.ovulatory.bg },
    { name: "Magnesium Glycinate", note: "Eases luteal cramps + supports sleep", tag: "PM", c: PH.luteal.c, bg: PH.luteal.bg },
    { name: "Omega-3", note: "Lowers inflammation, joint comfort", tag: "Daily", c: PH.menstrual.c, bg: PH.menstrual.bg },
    { name: "Creatine 5g", note: "Strength + bone loading response", tag: "Daily", c: PH.follicular.c, bg: PH.follicular.bg },
  ]
  const options = [
    { icon: "🌙", label: "Cycle length", value: "28 days" },
    { icon: "🎯", label: "Primary goal", value: "Bone longevity" },
    { icon: "⌚", label: "Connect wearable", value: "Apple Health" },
    { icon: "🔔", label: "Daily reminders", value: "8:00 AM" },
    { icon: "📏", label: "Units", value: "Metric" },
    { icon: "🔒", label: "Privacy & data", value: "" },
  ]
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar/>
      {/* Layered warm header */}
      <div className="relative px-5 pt-1 pb-6 mb-2" style={{ background: `linear-gradient(165deg, ${PH.menstrual.bg} 0%, ${PH.luteal.bg} 55%, ${C.bg} 100%)` }}>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-4" style={{ ...sans, color: C.muted }}>You</p>
        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-shrink-0" style={{ width: 66, height: 66 }}>
            <div className="flex items-center justify-center rounded-full w-full h-full" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.rose})`, boxShadow: C.shadowMd }}>
              <span className="text-[26px] font-medium text-white" style={{ ...serifItalic }}>M</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full" style={{ width: 24, height: 24, background: C.card, boxShadow: C.shadow }}>
              <span className="text-[12px]">🌱</span>
            </div>
          </div>
          <div>
            <h1 className="text-[26px] font-normal leading-tight" style={{ ...serifItalic, color: C.text }}>Shruti</h1>
            <p className="text-[12px]" style={{ ...sans, color: C.muted }}>Day 10 · Follicular phase</p>
          </div>
        </div>
        {/* Stats hero */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: <Flame size={15} style={{ color: C.coral }}/>, val: "17", label: "sessions" },
            { icon: <Sparkles size={15} style={{ color: PH.luteal.c }}/>, val: "4 mo", label: "streak" },
            { icon: <Heart size={15} style={{ color: PH.menstrual.c }} fill={PH.menstrual.c}/>, val: "82", label: "bone score" },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 py-3 rounded-2xl" style={{ background: "rgba(255,253,251,0.7)", boxShadow: C.shadow, backdropFilter: "blur(6px)" }}>
              {s.icon}
              <span className="text-[17px] font-bold leading-none mt-0.5" style={{ ...sans, color: C.text }}>{s.val}</span>
              <span className="text-[10px]" style={{ ...sans, color: C.muted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "none" }}>
        {/* Personalized supplement recommendations */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ ...sans, color: C.muted }}>Recommended for your bones</span>
        </div>
        <div className="flex flex-col gap-2 mb-6">
          {supplements.map(s => (
            <div key={s.name} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: C.card, boxShadow: C.shadow }}>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, background: s.bg }}>
                <span className="text-[18px]">💊</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ ...sans, color: C.text }}>{s.name}</p>
                <p className="text-[11px]" style={{ ...sans, color: C.muted }}>{s.note}</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ ...sans, background: s.bg, color: s.c }}>{s.tag}</span>
            </div>
          ))}
        </div>

        {/* Quick jump */}
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase block mb-2" style={{ ...sans, color: C.muted }}>Explore</span>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: "Journal", id: "journal" as ScreenId, emoji: "📖" },
            { label: "Cycle", id: "cycle" as ScreenId, emoji: "🌙" },
            { label: "Bones", id: "insights" as ScreenId, emoji: "🦴" },
            { label: "Today", id: "home" as ScreenId, emoji: "✨" },
          ].map(q => (
            <button key={q.label} onClick={() => go?.(q.id)} className="flex flex-col items-center gap-1.5 py-4 rounded-2xl active:scale-[0.97] transition-transform" style={{ background: C.card, boxShadow: C.shadow }}>
              <span className="text-[20px]">{q.emoji}</span>
              <span className="text-[10px] font-semibold" style={{ ...sans, color: C.text }}>{q.label}</span>
            </button>
          ))}
        </div>

        {/* Options list */}
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase block mb-2" style={{ ...sans, color: C.muted }}>Settings & options</span>
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: C.card, boxShadow: C.shadow }}>
          {options.map((o, i) => (
            <div key={o.label} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < options.length - 1 ? `1px solid ${C.divider}` : "none" }}>
              <span className="text-[16px]">{o.icon}</span>
              <span className="text-[13px] font-medium flex-1" style={{ ...sans, color: C.text }}>{o.label}</span>
              <span className="text-[12px]" style={{ ...sans, color: C.muted }}>{o.value}</span>
              <ChevronRight size={15} style={{ color: C.muted }}/>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-center leading-relaxed mb-6" style={{ ...serifItalic, color: C.muted }}>
          Phase is not a medical device. Your body knows more than any app — we&apos;re just here to listen with you. 🤍
        </p>
      </div>

      <BottomNav active="profile" phase="follicular" onNav={go}/>
    </div>
  )
}

// ─── Interactive Prototype (screens flow one after another) ────────────────────

function Prototype() {
  const [stack, setStack] = useState<ScreenId[]>(["welcome"])
  const [ov, setOv] = useState<OverlayId | null>(null)
  const [journal, setJournal] = useState<JournalEntry[]>(SEED_JOURNAL)
  const [nextId, setNextId] = useState(100)
  const [periods, setPeriods] = useState<Period[]>(SEED_PERIODS)
  const addPeriod = (p: Period) => setPeriods(prev => [...prev, p])
  const cyc = computeCycle(periods)   // whole app follows YOUR logged cycle

  // Load persisted journal from InsForge (falls back to the local seed offline)
  useEffect(() => {
    let alive = true
    fetchJournal().then(remote => {
      if (alive && remote && remote.length) setJournal(remote as JournalEntry[])
    })
    return () => { alive = false }
  }, [])

  const go = (id: ScreenId) => { setOv(null); setStack(s => [...s, id]) }
  const back = () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  const reset = () => { setOv(null); setStack(["welcome"]) }
  const nav: NavProps = { go, back, overlay: setOv }
  const cur = stack[stack.length - 1]

  const addJournal = (e: Omit<JournalEntry, "id" | "date">) => {
    const entry: JournalEntry = { id: nextId, date: "Jul 13", ...e }
    setJournal(j => [entry, ...j])
    setNextId(n => n + 1)
    saveJournalRemote(entry)   // persist to InsForge (no-op offline)
    setStack(s => (s[s.length - 1] === "journal" ? s : [...s, "journal"]))
  }

  const renderScreen = () => {
    switch (cur) {
      case "welcome": return <WelcomeScreen {...nav} phase={cyc.phaseKey} day={cyc.day}/>
      case "obA": return <OnboardingA {...nav}/>
      case "obB": return <OnboardingB {...nav}/>
      case "obC": return <OnboardingC {...nav}/>
      case "home": return <HomeScreen phase={cyc.phaseKey} dayNum={cyc.day} {...nav}/>
      case "workout": return <WorkoutDetail {...nav}/>
      case "nutrition": return <NutritionDetail {...nav}/>
      case "cycle": return <CycleView {...nav} periods={periods} onLogPeriod={addPeriod}/>
      case "insights": return <Insights {...nav}/>
      case "journal": return <JournalScreen {...nav} journal={journal}/>
      case "profile": return <ProfileScreen {...nav}/>
      default: return <OnboardingA {...nav}/>
    }
  }

  const scale = 0.92
  return (
    <div className="fixed inset-0 flex flex-col items-center overflow-auto" style={{ background: "linear-gradient(165deg, #3A2A2E 0%, #2A1E22 60%, #24191D 100%)", ...sans, paddingTop: 28, paddingBottom: 40 }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes screenIn { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>

      {/* Minimal demo controls */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={back} disabled={stack.length <= 1} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(247,244,239,0.1)", opacity: stack.length <= 1 ? 0.35 : 1 }}>
          <ChevronRight size={16} color="#F7F4EF" style={{ transform: "rotate(180deg)" }}/>
        </button>
        <button onClick={reset} className="text-[11px] font-semibold px-3 py-2 rounded-full" style={{ background: "rgba(247,244,239,0.1)", color: "rgba(247,244,239,0.7)" }}>Restart</button>
      </div>

      {/* Device frame */}
      <div className="relative" style={{ width: 390 * scale, height: 844 * scale }}>
        <div className="relative" style={{
          width: 390, height: 844, transform: `scale(${scale})`, transformOrigin: "top left",
          borderRadius: 44, overflow: "hidden",
          boxShadow: "0 30px 70px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}>
          <div key={cur} className="w-full h-full animate-[screenIn_0.28s_ease]">
            {renderScreen()}
          </div>
          {/* Overlays render above the current screen */}
          {ov === "why" && <div className="absolute inset-0 z-50"><WhySheet {...nav}/></div>}
          {ov === "quicklog" && <div className="absolute inset-0 z-50"><QuickLog {...nav} onSave={addJournal}/></div>}
          {ov === "phaseAlert" && <div className="absolute inset-0 z-50"><PhaseTransitionAlert {...nav}/></div>}
          {/* Notch + home indicator */}
          <div className="absolute rounded-full pointer-events-none" style={{ width: 88, height: 28, top: 11, left: "50%", transform: "translateX(-50%)", background: "#000", zIndex: 60 }}/>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 118, height: 4, bottom: 7, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.22)", zIndex: 60 }}/>
        </div>
      </div>

      <p className="text-[11px] mt-5 text-center max-w-xs" style={{ color: "rgba(247,244,239,0.4)" }}>
        Opens on your warm <strong>morning briefing</strong> (AI-written when your Nebius key is set). Tap <strong>Begin my day</strong>, then explore the tabs, tick the checklist, add a <strong>Journal</strong> check-in, and open <strong>why →</strong> for live Tavily-cited research.
      </p>
    </div>
  )
}

// ─── App (standalone — boots straight into the product) ────────────────────────

export default function App() {
  return <Prototype/>
}
