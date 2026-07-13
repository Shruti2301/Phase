// Shared logic for the Vercel serverless API routes (mirrors server/index.mjs).
const NEBIUS_KEY = process.env.NEBIUS_API_KEY
const NEBIUS_BASE = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1"
const NEBIUS_MODEL = process.env.NEBIUS_MODEL || "meta-llama/Llama-3.3-70B-Instruct"
const TAVILY_KEY = process.env.TAVILY_API_KEY
const INSFORGE_URL = (process.env.INSFORGE_API_URL || "").replace(/\/$/, "")
const INSFORGE_KEY = process.env.INSFORGE_API_KEY
const INSFORGE_TABLE = process.env.INSFORGE_TABLE || "journal_entries"

export async function briefing(ctx) {
  const { phase = "Follicular", day = 10, name = "there", lastMood = 4, lastNote = "" } = ctx || {}
  if (!NEBIUS_KEY) return { text: null, source: "fallback" }
  const sys =
    "You are Phase, a warm, encouraging women's strength-and-longevity coach. " +
    "Write a short morning check-in (max 90 words, second person, gentle, never clinical). " +
    "Touch on: sleep, movement/exercise, nutrition, feelings, and where she is in her cycle. " +
    "Reassuring, compassionate, no medical claims, no lists — flowing prose. End on one kind line."
  const user =
    `Her name is ${name}. Cycle: ${phase} phase, day ${day}. ` +
    `Her last logged mood was ${lastMood}/5${lastNote ? ` and she wrote: "${lastNote}"` : ""}. Write her morning note.`
  try {
    const r = await fetch(`${NEBIUS_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NEBIUS_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: NEBIUS_MODEL, messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 220, temperature: 0.75 }),
    })
    if (!r.ok) return { text: null, source: `nebius ${r.status}` }
    const j = await r.json()
    return { text: j.choices?.[0]?.message?.content?.trim() || null, source: "nebius" }
  } catch (e) {
    return { text: null, source: `error ${e.message}` }
  }
}

export async function evidence(ctx) {
  const { query = "" } = ctx || {}
  if (!TAVILY_KEY) return { summary: null, source: null, url: null, provider: "fallback" }
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: "basic", include_answer: true, max_results: 3 }),
    })
    if (!r.ok) return { summary: null, source: null, url: null, provider: `tavily ${r.status}` }
    const j = await r.json()
    const top = j.results?.[0]
    return { summary: j.answer || null, source: top?.title || null, url: top?.url || null, provider: "tavily" }
  } catch (e) {
    return { summary: null, source: null, url: null, provider: `error ${e.message}` }
  }
}

const toRecord = (e) => ({ entry_id: e.id, date: e.date, mood: e.mood, energy: e.energy, note: e.note, phase: e.phase })
const fromRecord = (r) => ({ id: r.entry_id ?? r.id, date: r.date, mood: r.mood, energy: r.energy, note: r.note, phase: r.phase })

export async function journalList() {
  if (!INSFORGE_URL || !INSFORGE_KEY) return { entries: [], store: "memory" }
  try {
    const r = await fetch(`${INSFORGE_URL}/api/database/records/${INSFORGE_TABLE}?order=entry_id.desc`, { headers: { Authorization: `Bearer ${INSFORGE_KEY}` } })
    if (!r.ok) return { entries: [], store: `insforge ${r.status}` }
    const j = await r.json()
    const rows = Array.isArray(j) ? j : j.records || j.data || []
    return { entries: rows.map(fromRecord), store: "insforge" }
  } catch (e) {
    return { entries: [], store: `error ${e.message}` }
  }
}

export async function journalInsert(entry) {
  if (!INSFORGE_URL || !INSFORGE_KEY) return { ok: true, store: "memory" }
  try {
    const r = await fetch(`${INSFORGE_URL}/api/database/records/${INSFORGE_TABLE}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${INSFORGE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify([toRecord(entry)]),
    })
    const body = r.ok ? "" : (await r.text()).slice(0, 160)
    return { ok: r.ok, store: r.ok ? "insforge" : `insforge ${r.status} ${body}` }
  } catch (e) {
    return { ok: false, store: `error ${e.message}` }
  }
}
