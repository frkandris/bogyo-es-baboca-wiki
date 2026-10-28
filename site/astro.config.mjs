// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = '/bogyo-es-baboca-wiki';

// Publishes the repo-root wiki/ (project/tech LLM wiki, OKF markdown) as-is
// under <base>/wiki/, with a plain directory listing (index.html) in every
// folder: folders first, then files, a–z, each with a short comment.
function publishLlmWiki() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const az = (a, b) => a.localeCompare(b, 'hu');
  // Comment: frontmatter description, else title, else the first heading.
  const comment = (file) => {
    if (!file.endsWith('.md') || !existsSync(file)) return '';
    const t = readFileSync(file, 'utf-8');
    return t.match(/^description:\s*"(.*)"/m)?.[1] ?? t.match(/^title:\s*"(.*)"/m)?.[1]
      ?? t.match(/^#\s+(.*)/m)?.[1] ?? '';
  };
  const publish = (src, out, rel) => {
    mkdirSync(out, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'));
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort(az);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort(az);
    for (const d of dirs) publish(join(src, d), join(out, d), `${rel}${d}/`);
    for (const f of files) copyFileSync(join(src, f), join(out, f));
    const rows = [
      ...(rel === 'wiki/' ? [] : ['<a href="../">../</a>']),
      ...dirs.map((d) => [`${d}/`, comment(join(src, d, 'index.md'))]),
      ...files.map((f) => [f, comment(join(src, f))]),
    ].map((r) => (typeof r === 'string' ? r
      : `<a href="${esc(r[0])}">${esc(r[0])}</a>${' '.repeat(Math.max(1, 28 - r[0].length))}${esc(r[1])}`));
    writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BASE}/${rel}</title></head><body>
<h1>${BASE}/${rel}</h1>
<pre>
${rows.join('\n')}
</pre>
</body></html>
`);
  };
  return {
    name: 'publish-llm-wiki',
    hooks: {
      'astro:build:done': ({ dir }) => {
        publish(fileURLToPath(new URL('../wiki/', import.meta.url)), fileURLToPath(new URL('wiki/', dir)), 'wiki/');
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
