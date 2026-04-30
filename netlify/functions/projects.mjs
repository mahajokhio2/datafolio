// netlify/functions/projects.mjs
// GET    /api/projects        → list all projects
// POST   /api/projects        → create project
// PUT    /api/projects/:id    → update project
// DELETE /api/projects/:id    → delete project

import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

export default async function handler(req, context) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const store = getStore("projects");
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/projects\/?/, "").split("/").filter(Boolean);
  const id = parts[0];

  try {
    // GET all
    if (req.method === "GET" && !id) {
      const { blobs } = await store.list();
      const projects = await Promise.all(
        blobs.map(async (b) => {
          const raw = await store.get(b.key);
          return raw ? JSON.parse(raw) : null;
        })
      );
      const sorted = projects
        .filter(Boolean)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return new Response(JSON.stringify(sorted), { status: 200, headers: CORS });
    }

    // POST create
    if (req.method === "POST") {
      const body = await req.json();
      const project = {
        ...body,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await store.set(project.id, JSON.stringify(project));
      return new Response(JSON.stringify(project), { status: 201, headers: CORS });
    }

    // PUT update
    if (req.method === "PUT" && id) {
      const existing = await store.get(id);
      if (!existing) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
      const body = await req.json();
      const updated = { ...JSON.parse(existing), ...body, id, updatedAt: Date.now() };
      await store.set(id, JSON.stringify(updated));
      return new Response(JSON.stringify(updated), { status: 200, headers: CORS });
    }

    // DELETE
    if (req.method === "DELETE" && id) {
      await store.delete(id);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
  } catch (err) {
    console.error("projects fn error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}

export const config = { path: "/api/projects/*" };
