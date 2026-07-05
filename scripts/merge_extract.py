#!/usr/bin/env python3
"""Merge ALL per-batch extraction JSON into Astro content collection YAML files.

Reads every scratch/extract/*.json (one file per subagent batch, across all
volumes), then regenerates the entity/story/taxonomy collections from scratch so
the result is deterministic and idempotent. Volume YAMLs are hand-authored and
never touched.

- Dedups entities by id (prefers the richest description), globally across volumes.
- Resolves object category conflicts via CATEGORY_OVERRIDES.
- Forces canonical name/description/category for specific ids via ENTITY_OVERRIDES.
- Verifies every story reference resolves to an entity; stubs + warns on dangling.
- Emits dependency-free YAML (JSON-quoted scalars are valid YAML).
"""
import json, sys, pathlib, glob

ROOT = pathlib.Path(__file__).resolve().parent.parent
EX = ROOT / "scratch" / "extract"
CONTENT = ROOT / "site" / "src" / "content"

# generated collections (volumes are hand-authored, excluded)
GENERATED = ["stories", "characters", "locations", "objects", "themes", "seasons", "holidays"]

# object id -> forced category when batches disagree
CATEGORY_OVERRIDES = {"babakocsi": "vehicle"}

# theme slug aliases -> canonical slug (merges synonym themes)
THEME_ALIASES = {}
# kanonikus, ékezetes címkék — az ügynökök gyakran ékezet nélküli slugból
# generálják a label-t, ezért a helyes magyar címke itt mindig felülírja.
CANONICAL_THEME_LABELS = {
    "alkotas": "Alkotás", "baratsag": "Barátság", "betegseg": "Betegség",
    "bocsanatkeres": "Bocsánatkérés", "csalad": "Család", "evszakok": "Évszakok",
    "farsang": "Farsang", "felfedezes": "Felfedezés", "gondoskodas": "Gondoskodás",
    "hangszerek": "Hangszerek", "jatszas": "Játszás", "jelmez": "Jelmez",
    "kirandulas": "Kirándulás", "kitartas": "Kitartás", "megbocsatas": "Megbocsátás",
    "mozgas": "Mozgás", "orvos": "Orvos", "osztozkodas": "Osztozkodás",
    "rajzolas": "Rajzolás", "rokonok": "Rokonok", "segites": "Segítés",
    "sport": "Sport", "sutes-fozes": "Sütés-főzés", "szuletesnap": "Születésnap",
    "termeszet": "Természet", "unnep": "Ünnep", "utazas": "Utazás",
    "verseny": "Verseny", "veszekedes": "Veszekedés",
    "veszekedes-kibekules": "Veszekedés és kibékülés", "zene": "Zene",
}
CANONICAL_SEASON_LABELS = {
    "tavasz": "Tavasz", "nyar": "Nyár", "osz": "Ősz", "tel": "Tél",
}
CANONICAL_HOLIDAY_LABELS = {
    "farsang": "Farsang", "szuletesnap": "Születésnap", "husvet": "Húsvét",
    "karacsony": "Karácsony", "mikulas": "Mikulás", "anyak-napja": "Anyák napja",
}
# szereplő-alias: ugyanaz a szereplő több slug alatt -> kanonikus id
CHARACTER_ALIASES = {
    "zold-kukac": "kukac",
}

ENTITY_OVERRIDES = {}  # (nem használt a Bogyó-wikin)

# szereplő faj/szerep (a név alatt jelenik meg) — kanonikus a visszatérő szereplőkhöz
SPECIES = {
    "bogyo": "Csigafiú", "baboca": "Katicalány", "baltazar": "Méhecske",
    "pihe": "Lepkekislány", "dome": "Krumplibogár", "szello": "Szitakötő",
    "ugri": "Szöcske", "vendel": "Szarvasbogár", "gombi": "Virágbogár",
    "alfonz": "Tücsök", "bagolydoktor": "Bagolydoktor", "sun-soma": "Sündisznó",
    "szarka": "Szarka", "milla": "Hóbogár", "kukac": "Kukac", "zold-kukac": "Kukac",
    "barlangi-pok": "Pók", "csiga-csaba": "Csigafiú", "hangyagyerekek": "Hangyák",
}
# a két főszereplő egységes leírása (species külön jelenik meg)
CHAR_DESC = {
    "bogyo": "Babóca legjobb barátja, a mesék egyik főszereplője.",
    "baboca": "Bogyó legjobb barátja, a mesék egyik főszereplője.",
}
# tárgy al-csoportok: csoportcímke -> az ide tartozó objektum-id-k (kulcsszó egyezés)
OBJECT_GROUPS = {
    "Hangszerek": {"hegedu", "gitar", "furulya", "zongora", "dob", "trombita", "harmonika", "cintanyer", "csengo", "sip"},
    "Zöldségek és gyümölcsök": {"alma", "afonya", "szamoca", "cseresznye", "szolo", "korte", "eper", "makk", "mogyoro", "gesztenye", "csipkebogyo", "borso", "tok"},
    "Ételek és sütemények": {"mezeskalacs", "lepeny", "afonyas-lepeny", "szamocas-lepeny", "suti", "torta", "palacsinta", "leves", "lekvar", "morzsa", "csipkebogyoszorp"},
    "Ruházat": {"pulover", "sapka", "sal", "kesztyu", "cipo", "kabat", "jelmez"},
    "Természet": {"virag", "level", "lapulevel", "fa", "ag", "kavics", "toboz", "harmat", "hoember", "hopehely"},
}

def q(s): return json.dumps(str(s), ensure_ascii=False)

def emit_yaml(obj):
    """Minimal YAML for flat dicts with scalar or list-of-scalar values."""
    lines = []
    for k, v in obj.items():
        if v is None: continue
        if isinstance(v, list):
            if not v:
                lines.append(f"{k}: []")
            else:
                lines.append(f"{k}:")
                for it in v:
                    lines.append(f"  - {q(it)}")
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            lines.append(f"{k}: {v}")
        else:
            lines.append(f"{k}: {q(v)}")
    return "\n".join(lines) + "\n"

def better(a, b):
    """Pick the entity dict with the longer description."""
    if a is None: return b
    if b is None: return a
    la = len(a.get("description") or "")
    lb = len(b.get("description") or "")
    return a if la >= lb else b

def load():
    batches = []
    for p in sorted(EX.glob("*.json")):
        batches.append(json.loads(p.read_text(encoding="utf-8")))
    if not batches:
        sys.exit("No batch JSON files found in scratch/extract/")
    return batches

def main():
    batches = load()
    stories, chars, locs, objs = [], {}, {}, {}
    themes, seasons, holidays = {}, {}, {}

    def norm(e, field, default, allowed):
        # robust to agents using "slug" instead of "id", stray keys, invalid enum values
        eid = e.get("id") or e.get("slug")
        val = e.get(field, default)
        if val not in allowed:
            val = default
        out = {"id": eid, "name": e.get("name", eid or ""), field: val,
               "description": e.get("description", "")}
        return eid, out

    KIND = {"person", "animal", "toy", "other"}
    LKIND = {"real", "fictional"}
    CAT = {"object", "vehicle"}
    for b in batches:
        stories.extend(b["stories"])
        for c in b["entities"].get("characters", []):
            raw = c
            cid, c = norm(c, "kind", "animal", KIND)
            sp = (raw.get("species") or raw.get("note") or "").strip()
            if sp: c["species"] = sp[:1].upper() + sp[1:]
            if cid:
                merged = better(chars.get(cid), c)
                # keep a species value from either side
                if not merged.get("species"):
                    for src in (c, chars.get(cid) or {}):
                        if src.get("species"): merged["species"] = src["species"]; break
                chars[cid] = merged
        for l in b["entities"].get("locations", []):
            lid, l = norm(l, "kind", "real", LKIND)
            if lid: locs[lid] = better(locs.get(lid), l)
        for o in b["entities"].get("objects", []):
            oid, o = norm(o, "category", "object", CAT)
            if oid: objs[oid] = better(objs.get(oid), o)
        def vocab(item):
            # robust to string form ("slug") or object form ({slug/id, label})
            if isinstance(item, str):
                return item, item.replace("-", " ").capitalize()
            s = item.get("slug") or item.get("id")
            return s, item.get("label") or (s.replace("-", " ").capitalize() if s else s)
        for t in b["taxonomy"].get("themes", []):
            s, lbl = vocab(t)
            if not s: continue
            s = THEME_ALIASES.get(s, s)
            themes.setdefault(s, CANONICAL_THEME_LABELS.get(s, lbl))
        for it in b["taxonomy"].get("seasons", []):
            s, lbl = vocab(it)
            if s: seasons.setdefault(s, lbl)
        for it in b["taxonomy"].get("holidays", []):
            s, lbl = vocab(it)
            if s: holidays.setdefault(s, lbl)

    # category overrides
    for oid, cat in CATEGORY_OVERRIDES.items():
        if oid in objs: objs[oid]["category"] = cat

    # entity field overrides (canonical name/desc/category)
    for tbl in (chars, locs, objs):
        for eid, fields in ENTITY_OVERRIDES.items():
            if eid in tbl:
                tbl[eid] = {**tbl[eid], **fields}

    # character aliases: remap story refs, fold entity, drop the alias
    for a, canon in CHARACTER_ALIASES.items():
        if a in chars:
            if canon not in chars:
                chars[canon] = {**chars[a], "id": canon}
            del chars[a]
    for s in stories:
        s["characters"] = list(dict.fromkeys(CHARACTER_ALIASES.get(c, c) for c in s.get("characters", [])))

    # canonical species (a név alatt) + a két főszereplő egységes leírása
    for cid, sp in SPECIES.items():
        if cid in chars: chars[cid]["species"] = sp
    for cid, desc in CHAR_DESC.items():
        if cid in chars: chars[cid]["description"] = desc

    # tárgy al-csoportok (kulcsszó alapján)
    for grp, ids in OBJECT_GROUPS.items():
        for oid in ids:
            if oid in objs: objs[oid]["group"] = grp

    # apply theme aliases to story references (dedup, preserve order)
    for s in stories:
        s["themes"] = list(dict.fromkeys(THEME_ALIASES.get(t, t) for t in s.get("themes", [])))
    # canonical labels win even if a canonical entry already existed with a weaker (ékezet nélküli) label
    for slug, label in CANONICAL_THEME_LABELS.items():
        if slug in themes:
            themes[slug] = label
    for slug, label in CANONICAL_SEASON_LABELS.items():
        if slug in seasons:
            seasons[slug] = label
    for slug, label in CANONICAL_HOLIDAY_LABELS.items():
        if slug in holidays:
            holidays[slug] = label

    stories.sort(key=lambda s: (s.get("volume", ""), s.get("order", 0)))

    # referential integrity check + stubs
    warnings = []
    def ensure(refs, table, kind):
        for rid in refs:
            if rid not in table:
                warnings.append(f"  {kind}: dangling ref '{rid}' — stub created")
                table[rid] = {"id": rid, "name": rid.replace("-", " ").title(),
                              "kind": "other" if kind == "characters" else "real",
                              "category": "object"}
    for s in stories:
        ensure(s["characters"], chars, "characters")
        ensure(s["locations"], locs, "locations")
        ensure(s["objects"], objs, "objects")
        for th in s["themes"]: themes.setdefault(th, th.replace("-", " ").capitalize())
        for se in s["seasons"]: seasons.setdefault(se, se.capitalize())
        for ho in s["holidays"]: holidays.setdefault(ho, ho.capitalize())

    # clear generated dirs so removed/renamed ids don't linger
    for dirname in GENERATED:
        d = CONTENT / dirname
        if d.exists():
            for f in d.glob("*.yaml"):
                f.unlink()

    # write files
    def write(dirname, entries, key="id"):
        d = CONTENT / dirname
        d.mkdir(parents=True, exist_ok=True)
        for e in entries:
            (d / f"{e[key]}.yaml").write_text(emit_yaml(e), encoding="utf-8")

    write("stories", stories)
    write("characters", [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "id"}} for k, v in chars.items()])
    write("locations", [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "id"}} for k, v in locs.items()])
    write("objects", [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "id"}} for k, v in objs.items()])
    write("themes", [{"id": k, "label": v} for k, v in themes.items()])
    write("seasons", [{"id": k, "label": v} for k, v in seasons.items()])
    write("holidays", [{"id": k, "label": v} for k, v in holidays.items()])

    print(f"stories={len(stories)} characters={len(chars)} locations={len(locs)} "
          f"objects={len(objs)} themes={len(themes)} seasons={len(seasons)} holidays={len(holidays)}")
    if warnings:
        print("WARNINGS:")
        print("\n".join(warnings))
    else:
        print("No dangling references.")

if __name__ == "__main__":
    main()
