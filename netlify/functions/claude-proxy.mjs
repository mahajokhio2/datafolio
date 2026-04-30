// netlify/functions/claude-proxy.mjs
// POST /api/claude  { prompt }
// Proxies to Anthropic API — key stays server-side in env vars

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not set. Add it in Netlify Site settings -> Environment variables." }),
      { status: 500, headers: CORS }
    );
  }

  let prompt;
  try {
    ({ prompt } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  if (!prompt) return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400, headers: CORS });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || "Anthropic API " + r.status);

    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return new Response(JSON.stringify({ text }), { status: 200, headers: CORS });
  } catch (err) {
    console.error("claude-proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}

