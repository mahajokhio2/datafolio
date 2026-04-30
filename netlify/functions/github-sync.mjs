// netlify/functions/github-sync.mjs
// POST /api/github-sync  { username, token }
// Returns: { repos, heatmap, langBytes }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function ghFetch(path, token) {
  const r = await fetch("https://api.github.com" + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${r.statusText}`);
  return r.json();
}

function guessDomain(repo) {
  const text = ((repo.name || "") + (repo.description || "") + (repo.topics || []).join(" ")).toLowerCase();
  if (/health|medical|hospital|clinical|covid|pharma/.test(text)) return "Health";
  if (/sport|football|soccer|nba|nfl|cricket|afl/.test(text)) return "Sport";
  if (/climate|environment|carbon|emission|weather|energy/.test(text)) return "Environment";
  if (/finance|stock|trading|market|bank|revenue|sales/.test(text)) return "Business";
  if (/social|census|demographic|population/.test(text)) return "Social";
  return "Technology";
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let username, token;
  try {
    ({ username, token } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: CORS });
  }

  if (!username || !token) {
    return new Response(JSON.stringify({ error: "username and token are required" }), { status: 400, headers: CORS });
  }

  try {
    // 1. Verify user
    const user = await ghFetch(`/users/${username}`, token);

    // 2. Repos
    const repos = await ghFetch(`/users/${username}/repos?sort=updated&per_page=50&type=owner`, token);

    // 3. Commit heatmap via events
    let heatmap = [];
    try {
      const events = await ghFetch(`/users/${username}/events?per_page=100`, token);
      const dayCounts = {};
      events
        .filter((e) => e.type === "PushEvent")
        .forEach((e) => {
          const day = e.created_at.slice(0, 10);
          dayCounts[day] = (dayCounts[day] || 0) + (e.payload?.commits?.length || 1);
        });
      for (let i = 363; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        heatmap.push(dayCounts[key] || 0);
      }
    } catch { heatmap = Array(364).fill(0); }

    // 4. Language bytes across top 8 repos
    const langBytes = {};
    for (const repo of repos.slice(0, 8)) {
      try {
        const langs = await ghFetch(`/repos/${username}/${repo.name}/languages`, token);
        Object.entries(langs).forEach(([l, b]) => {
          langBytes[l] = (langBytes[l] || 0) + b;
        });
      } catch {}
    }

    // 5. Shape repos for frontend
    const shaped = repos.map((r) => ({
      name: r.name,
      title: r.name.replace(/[-_]/g, " "),
      domain: guessDomain(r),
      tools: r.language || "",
      desc: r.description || "",
      githubUrl: r.html_url,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
      size: r.size,
    }));

    return new Response(
      JSON.stringify({ user, repos: shaped, heatmap, langBytes }),
      { status: 200, headers: CORS }
    );
  } catch (err) {
    console.error("github-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}

export const config = { path: "/api/github-sync" };
