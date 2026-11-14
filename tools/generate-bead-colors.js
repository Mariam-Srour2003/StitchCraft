#!/usr/bin/env node
/**
 * One-off generator: parses the fuse-bead colour CSVs in
 * packages/color/src/beads/source/ (from the MIT-licensed BeadColors
 * project, see that folder's README.md) and writes
 * packages/color/src/beads/bead-catalogues.json, one catalogue per bead line,
 * with hex, precomputed CIELAB and a finish tag per colour.
 *
 * Plain CommonJS for the same reason as generate-dmc-colors.js, whose
 * sRGB->Lab math this copies and must stay numerically identical to.
 *
 * Usage: node tools/generate-bead-colors.js
 */
const fs = require('fs');
const path = require('path');

const REF_WHITE = { x: 95.047, y: 100.0, z: 108.883 };

function srgbChannelToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToXyz({ r, g, b }) {
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);
  return {
    x: (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100,
    y: (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100,
    z: (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100,
  };
}

function xyzChannelToLab(t) {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

function xyzToLab({ x, y, z }) {
  const fx = xyzChannelToLab(x / REF_WHITE.x);
  const fy = xyzChannelToLab(y / REF_WHITE.y);
  const fz = xyzChannelToLab(z / REF_WHITE.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function srgbToLab(rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

function roundLab(lab) {
  const round = (n) => Math.round(n * 10000) / 10000;
  return { l: round(lab.l), a: round(lab.a), b: round(lab.b) };
}

function toHex(n) {
  return n.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Each bead line: its catalogue id, brand, line name, the source file and the
 * bead diameter. Diameters: 5 mm for standard (midi) beads, 2.6 mm for Perler
 * Mini and Artkal C, 2.5 mm for Hama Mini.
 */
const CATALOGUES = [
  { id: 'perler', brand: 'Perler', line: 'Perler', file: 'perler.csv', beadSizeMm: 5 },
  {
    id: 'perler-mini',
    brand: 'Perler',
    line: 'Perler Mini',
    file: 'perler_mini.csv',
    beadSizeMm: 2.6,
  },
  { id: 'hama-midi', brand: 'Hama', line: 'Hama Midi', file: 'hama.csv', beadSizeMm: 5 },
  { id: 'hama-mini', brand: 'Hama', line: 'Hama Mini', file: 'hama_mini.csv', beadSizeMm: 2.5 },
  { id: 'artkal-s', brand: 'Artkal', line: 'Artkal S', file: 'artkal_s.csv', beadSizeMm: 5 },
  { id: 'artkal-c', brand: 'Artkal', line: 'Artkal C', file: 'artkal_c.csv', beadSizeMm: 2.6 },
  { id: 'nabbi', brand: 'Nabbi', line: 'Nabbi', file: 'nabbi.csv', beadSizeMm: 5 },
];

/**
 * Bead finish, read from the colour name. Anything that isn't a plain opaque
 * colour looks different once ironed (see-through, sparkly, glowing), so
 * photo conversion leaves these out by default.
 */
function finishOf(name) {
  if (/\bglow\b/i.test(name)) return 'glow';
  if (/\bglitter\b/i.test(name)) return 'glitter';
  if (/\bstripe/i.test(name)) return 'striped';
  if (/\bpearl(escent)?\b/i.test(name)) return 'pearl';
  if (/\b(neon|fluorescent)\b/i.test(name)) return 'neon';
  if (/\bmetallic\b/i.test(name) || /^(silver|gold|copper|bronze)$/i.test(name.trim()))
    return 'metallic';
  // Only names that say so plainly: "Frosted Lilac" and "Cotton Candy" are
  // opaque colours, not see-through beads.
  if (/\b(transparent|translucent|clear)\b/i.test(name)) return 'translucent';
  return 'solid';
}

const beadsDir = path.join(__dirname, '..', 'packages', 'color', 'src', 'beads');
const catalogues = CATALOGUES.map(({ file, ...catalogue }) => {
  const rows = fs
    .readFileSync(path.join(beadsDir, 'source', file), 'utf8')
    .trim()
    .split(/\r?\n/);
  const codes = new Set();
  const colors = rows.map((line) => {
    const [code, name, r, g, b] = line.split(',');
    if (codes.has(code)) throw new Error(`duplicate code in ${file}: ${code}`);
    codes.add(code);
    const rgb = { r: Number(r), g: Number(g), b: Number(b) };
    if ([rgb.r, rgb.g, rgb.b].some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
      throw new Error(`bad RGB in ${file}: ${line}`);
    }
    return {
      code: code.trim(),
      name: name.trim(),
      hex: `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`,
      rgb,
      lab: roundLab(srgbToLab(rgb)),
      brand: catalogue.brand,
      finish: finishOf(name),
    };
  });
  return { ...catalogue, colors };
});

const outPath = path.join(beadsDir, 'bead-catalogues.json');
fs.writeFileSync(outPath, JSON.stringify(catalogues, null, 2) + '\n');
for (const c of catalogues) {
  const solid = c.colors.filter((x) => x.finish === 'solid').length;
  console.log(`${c.line}: ${c.colors.length} colours (${solid} solid)`);
}
console.log(`wrote ${outPath}`);
