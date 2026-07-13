// Thin client for the Phase backend. Every call fails soft — if the backend or a
// sponsor key is missing, it returns null and the UI shows built-in warm content.

export interface BriefingCtx { phase: string; day: number; name?: string; lastMood?: number; lastNote?: string }
export interface Evidence { summary: string; source: string; url: string }

export async function fetchBriefing(ctx: BriefingCtx): Promise<string | null> {
  try {
    const r = await fetch("/api/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    })
    if (!r.ok) return null
    const d = await r.json()
    return typeof d.text === "string" && d.text.length ? d.text : null
  } catch {
    return null
  }
}

export interface RemoteJournalEntry { id: number; date: string; mood: number; energy: number; note: string; phase: string }

// Load persisted journal (InsForge, or backend in-memory). null = use local seed.
export async function fetchJournal(): Promise<RemoteJournalEntry[] | null> {
  try {
    const r = await fetch("/api/journal")
    if (!r.ok) return null
    const d = await r.json()
    const list = Array.isArray(d?.entries) ? d.entries : []
    const valid = list.filter((e: any) => e && typeof e.mood === "number" && typeof e.note === "string")
    return valid.length ? valid : null
  } catch {
    return null
  }
}

// Persist a journal entry (fire-and-forget; local state stays source of truth).
export async function saveJournalRemote(entry: RemoteJournalEntry): Promise<void> {
  try {
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
  } catch {
    /* offline — local state already updated */
  }
}

export async function fetchEvidence(query: string): Promise<Evidence | null> {
  try {
    const r = await fetch("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    if (!r.ok) return null
    const d = await r.json()
    if (!d.summary && !d.source) return null
    return { summary: d.summary || "", source: d.source || "Source", url: d.url || "#" }
  } catch {
    return null
  }
}
