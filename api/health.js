export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    nebius: !!process.env.NEBIUS_API_KEY,
    tavily: !!process.env.TAVILY_API_KEY,
    insforge: !!(process.env.INSFORGE_API_URL && process.env.INSFORGE_API_KEY),
  })
}
