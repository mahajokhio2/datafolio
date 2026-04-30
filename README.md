# Datafolio — Live Data Portfolio Dashboard

A fully live data analyst portfolio dashboard deployed on Netlify with:
- **Persistent project storage** via Netlify Blobs (survives deploys, no database needed)
- **GitHub sync** — pulls your repos, commit heatmap, and language data every 6 hours automatically
- **AI Coach** via Claude API (server-side proxy, key never exposed to browser)
- **Serverless functions** for all API calls

---

## Deploy in 5 steps

### 1. Fork / clone this repo
```bash
git clone <your-repo-url>
cd datafolio
```

### 2. Install dependencies (for local dev only)
```bash
npm install
```

### 3. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/datafolio.git
git push -u origin main
```

### 4. Connect to Netlify
1. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing project"
2. Connect your GitHub account and select the `datafolio` repo
3. Build settings are auto-detected from `netlify.toml` — no changes needed
4. Click **Deploy site**

### 5. Add environment variables
In Netlify → Site settings → Environment variables, add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com) |

Then **trigger a redeploy** (Deploys → Trigger deploy → Deploy site).

---

## Connect GitHub (after deploying)

1. Open your live Netlify URL
2. Click **Connect GitHub** in the sidebar
3. Enter your GitHub username and a personal access token
   - Generate at: GitHub → Settings → Developer settings → Personal access tokens (classic)
   - Scope needed: `public_repo` (or `repo` for private repos)
4. Click **Connect & sync**

Your repos import as projects, commit history populates the heatmap, and languages auto-fill skill scores.

GitHub data auto-refreshes every 6 hours via a scheduled Netlify function.

---

## Local development

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

The dashboard runs at `http://localhost:8888`. Netlify Dev proxies the serverless functions so everything works locally including the API.

For local dev, create a `.env` file:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Project structure

```
datafolio/
├── public/
│   └── index.html          # Full dashboard frontend
├── netlify/
│   └── functions/
│       ├── projects.mjs    # CRUD API for projects (Netlify Blobs)
│       ├── github-sync.mjs # GitHub repo/commit/language sync
│       ├── claude-proxy.mjs# Anthropic API proxy (key server-side)
│       ├── settings.mjs    # GitHub credentials storage
│       └── scheduled-sync.mjs # Auto-sync every 6 hours
├── netlify.toml            # Netlify config + redirects
└── package.json
```

---

## Notes

- **No database needed** — Netlify Blobs provides key-value storage included in all Netlify plans
- **Free tier** — Netlify's free plan includes 125k function invocations/month and 1GB Blobs storage, more than enough for a personal portfolio
- **Token security** — GitHub token is stored in Netlify Blobs server-side, never sent to the browser
- **API key security** — Anthropic key lives in Netlify environment variables, proxied server-side
