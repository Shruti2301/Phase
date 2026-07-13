# Phase · Period Tracking + Exercise Recommendation

A warm, cycle-synced fitness companion for women. Phase tracks your period, computes your real cycle length from the dates you log, and adapts your daily **workout, nutrition, and recovery** to the hormonal phase you're actually in — so strength training becomes a lifelong habit and bone density is protected early.

Instead of demanding 100% every day, Phase scales expectations to your cycle: heavy lifting when estrogen is high, restorative movement when it's low — reframing a rest day as a win, not a broken streak.

## Why it matters
Women's bone density peaks around age 30, and load-bearing strength training is the single most powerful modifiable defense against osteoporosis. Phase makes that habit sustainable by syncing it to your body's rhythm.

## Features
- **Warm morning briefing** — an AI-written daily note across sleep, exercise, nutrition, feelings, and your current phase.
- **Cycle-aware daily plan** — Fuel / Move / Mind checklist that changes with your phase (Menstrual, Follicular, Ovulatory, Luteal).
- **Real period tracker** — log start & end dates; your cycle length and phases recompute automatically (no fixed 28-day assumption).
- **Journal** — mood + energy check-ins with a note, persisted and charted over time.
- **Cited "why"** — evidence-backed rationale behind each recommendation.
- **Bone-longevity focus** — load-bearing exercise flagged, supplement guidance, and a gentle DEXA-screening nudge.

## Sponsor stack
- **Nebius Token Factory** — LLM that writes the personalized daily briefing.
- **Tavily** — real-time, citation-backed research for the "why" cards.
- **InsForge** — database persistence for the journal.

The app runs fully offline with graceful fallbacks; it lights up with live AI, citations, and persistence when API keys are supplied.

## Tech
React + Vite + TypeScript + Tailwind, with a tiny zero-dependency Node backend proxy for the sponsor APIs.

## Run locally
```bash
npm install
cp .env.example .env      # paste your Nebius / Tavily / InsForge keys (optional)
npm run server            # terminal 1 — backend on :8787
npm run dev               # terminal 2 — app on :5173
```
Open http://localhost:5173.

> Phase is not a medical device. It supports habits and flags risk factors — it does not diagnose. Always consult a clinician for medical decisions.
