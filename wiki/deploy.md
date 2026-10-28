---
type: "Runbook"
title: "Deploy — GitHub Actions → Pages"
description: "Hogyan épül és publikálódik az oldal."
tags: ["deploy", "github-actions", "pages"]
timestamp: "2026-10-28"
---

# Deploy

- **Trigger:** push a `main`-re (`.github/workflows/deploy.yml`), vagy manuális
  `workflow_dispatch`.
- **Lépések:** Node telepítés → `npm ci` a `site/`-ban → `npm run build` →
  a `site/dist` feltöltése GitHub Pages-artifactként → deploy.
- **URL:** https://frkandris.github.io/bogyo-es-baboca-wiki/ (project pages, base = a repó neve).
- **Ez a wiki is kimegy:** az `astro.config.mjs` `publish-llm-wiki` integrációja a
  build végén a `wiki/` tartalmát változatlanul a `dist/wiki/`-be másolja, mellé
  `content/` néven a könyvek adatait (`site/src/content` YAML), és minden mappába
  egyszerű könyvtárlistát (`index.html`: mappák, majd fájlok a–z, megjegyzéssel)
  generál → https://frkandris.github.io/bogyo-es-baboca-wiki/wiki/ (nyers markdown: pl. https://frkandris.github.io/bogyo-es-baboca-wiki/wiki/index.md).
  A technikai oldalak (`TECH_PAGES` az `astro.config.mjs`-ben) a megjelenítésben
  egy virtuális `tech/` mappába kerülnek, a relatív linkjeik átíródnak; a repóban
  a `wiki/` lapos marad. Új wiki-oldal a gyökérbe kerül; ha technikai, vedd fel a
  `TECH_PAGES`-be.
- **Ellenőrzés:** a build lógó hivatkozáson elbukik → a hibás content nem megy ki.
- **Analytics:** Cloudflare Web Analytics beacon (süti nélkül).

Kézi build lokálisan: `cd site && npm install && npm run build && npm run preview`.
