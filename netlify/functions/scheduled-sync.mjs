// netlify/functions/scheduled-sync.mjs
// Runs every 6 hours via Netlify scheduled functions
// Reads stored GitHub credentials from Blobs and re-syncs

import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  const store = getStore("settings");

  try {
    const raw = await store.get("github-config");
    if (!raw) {
      console.log("No GitHub config stored — skipping scheduled sync");
      return new Response("no config", { status: 200 });
    }

    const { username, token } = JSON.parse(raw);
    if (!username || !token) return new Response("incomplete config", { status: 200 });

    // Trigger the github-sync function internally
    const base = process.env.URL || "http://localhost:8888";
    const r = await fetch(`${base}/api/github-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, token }),
    });

    if (!r.ok) throw new Error(`Sync failed: ${r.status}`);
    console.log("Scheduled GitHub sync completed successfully");
    return new Response("synced", { status: 200 });
  } catch (err) {
    console.error("Scheduled sync error:", err);
    return new Response(err.message, { status: 500 });
  }
}

export const config = {
  schedule: "0 */6 * * *",
  path: "/api/scheduled-sync",
};
