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

async function ghGraphQL(query, token) {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`GitHub GraphQL ${r.status}`);
  const json = await r.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function guessDomain(repo) {
  const text = ((repo.name || "") + (repo.description || "")).toLowerCase();
  if (/health|medical|hospital|clinical|covid/.test(text)) return "Health";
  if (/sport|football|soccer|nba|nfl|cricket|afl/.test(text)) return "Sport";
  if (/climate|environment|carbon|emission|weather/.test(text)) return "Environment";
  if (/finance|stock|trading|market|bank|revenue|sales/.test(text)) return "Business";
  if (/social|census|demographic|population/.test(text)) return "Social";
  return "Technology";
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME;

  if (!token || !username) return new Response(
    JSON.stringify({ error: `Missing env vars — GITHUB_TOKEN: ${token ? "SET" : "MISSING"}, GITHUB_USERNAME: ${username ? "SET" : "MISSING"}. Add them in Netlify → Site configuration → Environment variables, then redeploy.` }),
    { status: 500, headers: CORS }
  );

  try {
    // 1. User + repos via REST
    const user = await ghFetch(`/users/${username}`, token);
    const repos = await ghFetch(`/users/${username}/repos?sort=updated&per_page=50&type=owner`, token);

    // 2. Full year contribution heatmap via GraphQL
    let heatmap = Array(364).fill(0);
    try {
      const from = new Date(Date.now() - 364 * 86400000).toISOString();
      const to = new Date().toISOString();
      const gql = `{
        user(login: "${username}") {
          contributionsCollection(from: "${from}", to: "${to}") {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }`;
      const data = await ghGraphQL(gql, token);
      const days = data.user.contributionsCollection.contributionCalendar.weeks
        .flatMap(w => w.contributionDays)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-364);
      heatmap = days.map(d => d.contributionCount);
    } catch (e) {
      // fallback to events API if GraphQL fails
      try {
        const events = await ghFetch(`/users/${username}/events?per_page=100`, token);
        const dayCounts = {};
        events.filter(e => e.type === "PushEvent").forEach(e => {
          const day = e.created_at.slice(0, 10);
          dayCounts[day] = (dayCounts[day] || 0) + (e.payload?.commits?.length || 1);
        });
        for (let i = 363; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          heatmap[363 - i] = dayCounts[d.toISOString().slice(0, 10)] || 0;
        }
      } catch {}
    }

    // 3. Language bytes across top repos
    const langBytes = {};
    for (const repo of repos.slice(0, 10)) {
      try {
        const langs = await ghFetch(`/repos/${username}/${repo.name}/languages`, token);
        Object.entries(langs).forEach(([l, b]) => { langBytes[l] = (langBytes[l] || 0) + b; });
      } catch {}
    }

    // 4. Weekly commit counts from heatmap for progress chart
    const weeklyCommits = [];
    for (let i = 7; i >= 0; i--) {
      const slice = heatmap.slice(364 - (i + 1) * 7, 364 - i * 7);
      weeklyCommits.push(slice.reduce((a, b) => a + b, 0));
    }

    const shaped = repos.map(r => ({
      name: r.name,
      title: r.name.replace(/[-_]/g, " "),
      domain: guessDomain(r),
      tools: r.language || "",
      desc: r.description || "",
      githubUrl: r.html_url,
      stars: r.stargazers_count,
      size: r.size,
    }));

    return new Response(JSON.stringify({ user, repos: shaped, heatmap, langBytes, weeklyCommits }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
