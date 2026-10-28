// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BASE = '/bogyo-es-baboca-wiki';

// Publishes the repo-root wiki/ (project/tech LLM wiki, OKF markdown) as-is
// under <base>/wiki/, with a plain directory listing (index.html) in every
// folder: folders first, then files, a–z, each with a short comment.
// The book data (site/src/content YAML) is mounted alongside as content/, and
// the technical pages are grouped into a virtual tech/ folder (display only:
// in the repo they stay flat in wiki/; their relative links are rewritten).
const TECH_PAGES = ['architecture.md', 'conventions.md', 'data-model.md', 'deploy.md', 'merge-script.md',
  'pipeline-extraction.md', 'repo-structure.md', 'runbook-add-volume.md', 'site-astro.md'];
const DATA_DIRS = {
  content: 'A könyvek adatai — Zod-sémával validált YAML (forrás: site/src/content)',
  tech: 'A projekt technikai működése — architektúra, pipeline, deploy, runbook',
  volumes: 'kötetek', stories: 'mesék', characters: 'szereplők', locations: 'helyszínek',
  objects: 'tárgyak', themes: 'témák', seasons: 'évszakok', holidays: 'ünnepek',
};

function publishLlmWiki() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const az = (a, b) => a.localeCompare(b, 'hu');
  const field = (t, k) => t.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1];
  // Comment: .md → description, title or first heading; .yaml → title, name or label.
  const comment = (file) => {
    if (!existsSync(file)) return '';
    const t = readFileSync(file, 'utf-8');
    if (file.endsWith('.md')) return field(t, 'description') ?? field(t, 'title') ?? t.match(/^#\s+(.*)/m)?.[1] ?? '';
    if (file.endsWith('.yaml')) return field(t, 'title') ?? field(t, 'name') ?? field(t, 'label') ?? '';
    return '';
  };
  const dirComment = (dir, name) => {
    if (DATA_DIRS[name]) {
      const n = readdirSync(dir).filter((f) => /\.(ya?ml|md)$/.test(f)).length;
      return n ? `${DATA_DIRS[name]} (${n})` : DATA_DIRS[name];
    }
    return comment(join(dir, 'index.md'));
  };
  // Copies wiki/ into stage/, moving TECH_PAGES into stage/tech/ and fixing
  // the relative .md links between the two levels.
  const stageWiki = (wiki, stage) => {
    mkdirSync(join(stage, 'tech'));
    const inTech = (f) => TECH_PAGES.includes(f);
    for (const f of readdirSync(wiki)) {
      if (!f.endsWith('.md')) { copyFileSync(join(wiki, f), join(stage, f)); continue; }
      const text = readFileSync(join(wiki, f), 'utf-8').replace(/\]\(([\w-]+\.md)(#[^)]*)?\)/g, (m, t, h = '') =>
        inTech(f) === inTech(t) ? m : `](${inTech(t) ? 'tech/' : '../'}${t}${h})`);
      writeFileSync(join(stage, inTech(f) ? 'tech' : '', f), text);
    }
  };
  const publish = (src, out, rel, mounts = {}) => {
    mkdirSync(out, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'));
    const dirSrc = Object.fromEntries(entries.filter((e) => e.isDirectory()).map((e) => [e.name, join(src, e.name)]));
    Object.assign(dirSrc, mounts);
    const dirs = Object.keys(dirSrc).sort(az);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort(az);
    for (const d of dirs) publish(dirSrc[d], join(out, d), `${rel}${d}/`);
    // GitHub Pages serves .yaml as text/yaml without a charset, so browsers fall
    // back to Latin-1 and mangle the accents; a UTF-8 BOM makes them read UTF-8.
    for (const f of files) {
      if (/\.ya?ml$/.test(f)) writeFileSync(join(out, f), '﻿' + readFileSync(join(src, f), 'utf-8'));
      else copyFileSync(join(src, f), join(out, f));
    }
    // Each folder is shown expanded as a tree beneath it: its subfolders, and
    // its own files, but not the files of the subfolders (e.g. content/*/).
    // Rows: [tree prefix, label, href, comment].
    const subtree = (dir, href, prefix, top = true) => {
      const list = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'));
      const subs = list.filter((e) => e.isDirectory()).map((e) => e.name).sort(az);
      const fs = list.filter((e) => e.isFile()).map((e) => e.name).sort(az);
      const items = [...subs.map((s) => [s, true]), ...(top ? fs.map((f) => [f, false]) : [])];
      return items.flatMap(([n, isDir], i) => {
        const last = i === items.length - 1;
        const branch = prefix + (last ? '└── ' : '├── ');
        if (!isDir) return [[branch, n, `${href}${n}`, comment(join(dir, n))]];
        return [[branch, `${n}/`, `${href}${n}/`, dirComment(join(dir, n), n)],
          ...subtree(join(dir, n), `${href}${n}/`, prefix + (last ? '    ' : '│   '), false)];
      });
    };
    const entryRows = [
      ...dirs.flatMap((d) => [['', `${d}/`, `${d}/`, dirComment(dirSrc[d], d)], ...subtree(dirSrc[d], `${d}/`, '')]),
      ...files.map((f) => ['', f, f, comment(join(src, f))]),
    ];
    const width = Math.max(28, ...entryRows.map(([p, l]) => p.length + l.length + 2));
    const rows = [
      ...(rel === 'wiki/' ? [] : ['<a href="../">../</a>']),
      ...entryRows.map(([p, l, h, c]) =>
        `${p}<a href="${esc(h)}">${esc(l)}</a>${' '.repeat(width - p.length - l.length)}${esc(c)}`),
    ];
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
        const wiki = fileURLToPath(new URL('../wiki/', import.meta.url));
        const stage = mkdtempSync(join(tmpdir(), 'llm-wiki-'));
        try {
          stageWiki(wiki, stage);
          publish(stage, fileURLToPath(new URL('wiki/', dir)), 'wiki/',
            { content: fileURLToPath(new URL('./src/content/', import.meta.url)) });
        } finally {
          rmSync(stage, { recursive: true, force: true });
        }
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
