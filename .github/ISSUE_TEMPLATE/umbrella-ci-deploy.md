---
name: Umbrella – CI grün & Deployment stabil
about: Aufgabe für den GitHub Copilot coding agent – bringe CI und Deployment auf grün
title: "Umbrella: CI grün & Deployment stabil"
labels: ["umbrella", "ci", "deployment", "copilot"]
---

## Kontext
- Ziel-Branch: `main`
- CI-Workflow: `.github/workflows/ci.yml`
- Hosting/Deploy: Vercel
- Runtime: Node **22.x**, Paketmanager: npm **10** (siehe `package.json` `engines`/`packageManager`)
- Relevante Secrets/Env: (eintragen)

## Aufgabe
Bringe das Repository in einen Zustand, in dem **CI** und **Deployment** fehlerfrei durchlaufen.

### Akzeptanzkriterien (DoD)
- [ ] GitHub Actions Workflow **CI** läuft auf **Node 22** ohne Fehler.
- [ ] `npm ci`, `npm run lint`, `npm run build`, `npm test` (falls vorhanden) sind grün.
- [ ] Vercel **Build + Deploy** ist grün.
- [ ] README enthält einen kurzen Abschnitt „Build/Deploy“ (Node 22, npm 10, ggf. `.nvmrc`).
- [ ] Änderungen kommen als **PR(s)**, keine Direkt-Pushes auf `main`.

### Leitplanken
- Minimal-invasive Änderungen (keine Massenformatierungen).
- **Keine** Secrets in Code/Logs.
- Bestehende Projektstruktur/Script-Namen respektieren.
- Wenn etwas unklar ist: im PR kommentieren und Rückfragen stellen.

### Hinweise (Startpunkte für dich, Copilot)
- Falls Node-Version falsch: `package.json` → `"engines": { "node": "22.x" }`, optional `"packageManager": "npm@10"`.
- TypeScript/Next: `tsconfig.json` – Optionen **nur** unter `compilerOptions`, kein Top-Level `compilerOptions.esModuleInterop` usw.
- CI: In `.github/workflows/ci.yml` vor `npm ci` Node 22 setzen (`actions/setup-node@v4`).

