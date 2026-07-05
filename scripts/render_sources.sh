#!/usr/bin/env bash
# Pre-render every unprocessed Bogyó source to PNG page images under
# scratch/pages/<slug>/p-XXX.png, so extraction agents only read images.
# PDF -> pdftoppm; DJVU -> ddjvu(pdf) -> pdftoppm; JPG dirs -> sips resample.
set -euo pipefail
cd "$(dirname "$0")/.."
PDFS="pdfs"
OUT="scratch/pages"
mkdir -p "$OUT"

render_pdf() {  # <slug> <pdf-path>
  local slug="$1" src="$2"
  local d="$OUT/$slug"; mkdir -p "$d"
  echo ">> PDF $slug  <- $src"
  pdftoppm -png -r 150 "$src" "$d/p" >/dev/null
}

render_djvu() {  # <slug> <djvu-path>
  local slug="$1" src="$2"
  local d="$OUT/$slug"; mkdir -p "$d"
  echo ">> DJVU $slug <- $src"
  local tmp; tmp="$(mktemp -u).pdf"
  ddjvu -format=pdf "$src" "$tmp" >/dev/null 2>&1
  pdftoppm -png -r 150 "$tmp" "$d/p" >/dev/null
  rm -f "$tmp"
}

render_jpgdir() {  # <slug> <dir> [glob]
  local slug="$1" dir="$2" glob="${3:-*.jpg}"
  local d="$OUT/$slug"; mkdir -p "$d"
  echo ">> JPGDIR $slug <- $dir"
  local i=0
  # shellcheck disable=SC2231
  while IFS= read -r img; do
    i=$((i+1))
    printf -v n "%03d" "$i"
    sips -s format png --resampleWidth 1500 "$img" --out "$d/p-$n.png" >/dev/null 2>&1
  done < <(find "$dir" -maxdepth 1 -type f -iname "$glob" | sort)
}

# --- clean single PDFs (wave-3 targets that died on login) ---
render_pdf finomsagai   "$PDFS/Bartos Erika - Bogyo es Baboca finomsagai.pdf"
render_pdf enekel       "$PDFS"/Bartos\ Erika\ -\ Bogyó\ és\ Babóca\ énekel*.pdf
# NOTE: Gyógypuszi kihagyva — NEM Bogyó és Babóca kötet.
render_pdf buborekot-fuj "$PDFS/BartosErika-BogyoEsBabocaBuborekotFuj.pdf"

# --- PDFs bundled in the 'ünnepel' folder (two separate books) ---
render_pdf a-bicikli            "$PDFS/Bogyó és Babóca ünnepel/Bartos Erika - Bogyó és Babóca - A bicikli.pdf"
render_pdf sun-soma-szuletesnapja "$PDFS/Bogyó és Babóca ünnepel/Bartos Erika - Bogyó és Babóca - Sün Soma születésnapja.pdf"

# --- djvu books ---
render_djvu ovodaban   "$PDFS/Bogyó és Babóca/Bartos Erika - Bogyó és Babóca az óvodában.djvu"
render_djvu karacsonya "$PDFS/Bogyó és Babóca/Bartos Erika - Bogyó és Babóca karácsonya.djvu"
render_djvu a-jegen-1  "$PDFS/Bartos Erika - Bogyó és Babóca a jégen/Az elveszett mogyoró.djvu"
render_djvu a-jegen-2  "$PDFS/Bartos Erika - Bogyó és Babóca a jégen/Vendel korcsolyázik.djvu"

# --- jpg-scan folders ---
render_jpgdir a-levegoben   "$PDFS/Bartos Erika - Bogyó és Babóca a levegoben"
render_jpgdir boszorkanyok  "$PDFS/Bogyó és Babóca - Boszorkányok"
render_jpgdir elveszett-nyuszi "$PDFS/Bogyó és Babóca Elveszett nyuszi"
render_jpgdir evszakos-konyv "$PDFS/Bogyó és Babóca Évszakos könyv"

echo "=== done. page counts ==="
for d in "$OUT"/*/; do printf "%-24s %s\n" "$(basename "$d")" "$(ls -1 "$d" | wc -l | tr -d ' ')"; done
