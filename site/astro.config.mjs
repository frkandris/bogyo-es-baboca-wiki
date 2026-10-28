// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = '/bogyo-es-baboca-wiki';

// Publishes the repo-root wiki/ (project/tech LLM wiki, OKF markdown) as-is
// under <base>/wiki/, plus a small index.html listing the pages.
function publishLlmWiki() {
  return {
    name: 'publish-llm-wiki',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const src = fileURLToPath(new URL('../wiki/', import.meta.url));
        const out = fileURLToPath(new URL('wiki/', dir));
        mkdirSync(out, { recursive: true });
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const rows = [];
        for (const f of readdirSync(src).filter((f) => f.endsWith('.md')).sort()) {
          copyFileSync(src + f, out + f);
          const text = readFileSync(src + f, 'utf-8');
          const title = text.match(/^title:\s*"(.*)"/m)?.[1] ?? text.match(/^#\s+(.*)/m)?.[1] ?? f;
          const desc = text.match(/^description:\s*"(.*)"/m)?.[1] ?? '';
          rows.push(`<li><a href="${f}">${esc(title)}</a> <code>${f}</code>${desc ? ` — ${esc(desc)}` : ''}</li>`);
        }
        writeFileSync(out + 'index.html', `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LLM wiki — projekt/tech tudáskatalógus</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}code{color:#666}</style>
</head><body>
<h1>Projekt/tech LLM wiki</h1>
<p>A repó <code>wiki/</code> mappája nyers markdownként (OKF, YAML frontmatterrel). Belépő: <a href="index.md">index.md</a>.
Vissza a <a href="${BASE}/">weboldalra</a>.</p>
<ul>
${rows.join('\n')}
</ul>
</body></html>
`);
      },
    },
  };
}

// Project pages: https://frkandris.github.io/bogyo-es-baboca-wiki
export default defineConfig({
  site: 'https://frkandris.github.io',
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [sitemap(), publishLlmWiki()],
});
