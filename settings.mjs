import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const store = getStore({ name: "settings", consistency: "strong" });

  try {
    if (req.method === "GET") {
      const raw = await store.get("github-config").catch(() => null);
      const config = raw ? JSON.parse(raw) : {};
      return new Response(
        JSON.stringify({ githubUsername: config.username || null, hasToken: !!config.token }),
        { status: 200, headers: CORS }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const existing = await store.get("github-config").catch(() => null);
      const prev = existing ? JSON.parse(existing) : {};
      await store.set("github-config", JSON.stringify({
        username: body.githubUsername ?? prev.username ?? "",
        token: body.githubToken ?? prev.token ?? "",
      }));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
