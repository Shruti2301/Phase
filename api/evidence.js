import { evidence } from "./_lib.js"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" })
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
  res.status(200).json(await evidence(body))
}
