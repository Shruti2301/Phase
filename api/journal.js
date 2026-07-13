import { journalList, journalInsert } from "./_lib.js"

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json(await journalList())
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
    return res.status(200).json(await journalInsert(body))
  }
  res.status(405).json({ error: "method not allowed" })
}
