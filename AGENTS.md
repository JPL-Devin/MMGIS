# AGENTS.md

This repository includes an AI agent developer guide. See [AI-Getting-Started.md](./AI-Getting-Started.md) for:

- Quick start setup instructions (non-Docker development)
- Port map and key commands
- Architecture overview
- Mission creation guide
- Environment variable reference
- Common pitfalls and troubleshooting

## Key Files

| File | Purpose |
|------|---------|
| `AI-Getting-Started.md` | Comprehensive AI agent setup and navigation guide |
| `sample.env` | Environment variable template — copy to `.env` |
| `scripts/server.js` | Main Express server entrypoint |
| `scripts/init-db.js` | Database table initialization |
| `configure/` | Separate React admin app (requires own `npm install && npm run build`) |
| `src/essence/` | Main front-end application source |
