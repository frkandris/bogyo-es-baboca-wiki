---
type: "Overview"
title: "Bogyó és Babóca wiki — áttekintés"
description: "Statikus, kereshető katalógus Bartos Erika Bogyó és Babóca meséiről."
tags: ["projekt", "cel", "jog"]
timestamp: "2026-07-05"
---

# Bogyó és Babóca wiki — áttekintés

Statikus, kereshető **rajongói referencia-katalógus** Bartos Erika *Bogyó és Babóca*
könyveiről. Fő cél: a szülők gyorsan megtalálják, **melyik mese melyik kötetben**
van, és böngészhessenek szereplő, helyszín, tárgy, téma, évszak és ünnep szerint.

Jelenlegi méret: **22 kötet · 62 mese · 49
szereplő · 30 helyszín · 105 tárgy · 32 téma**.

## Alapelvek
- **Csak metaadat + saját szavas összefoglaló.** Bartos Erika a szerző és a
  jogtulajdonos; a mesék szövege és képei **nem** kerülnek a repóba vagy a
  weboldalra. A forrás-PDF-ek gitignore-oltak. Lásd [conventions](conventions.md).
- **Statikus.** Nincs backend, nincs adatbázis — Astro build → GitHub Pages.
- **Adathalmaz, nem dokumentumok.** A forrás-igazság strukturált YAML; minden
  oldal generált. Lásd [architecture](architecture.md).

Élő oldal: https://frkandris.github.io/bogyo-es-baboca-wiki/
