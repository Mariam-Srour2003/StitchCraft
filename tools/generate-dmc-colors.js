#!/usr/bin/env node
/**
 * One-off generator: parses the raw DMC code/name/rgb CSV and writes
 * packages/color/src/dmc/dmc-colors.json with precomputed CIELAB values so
 * runtime nearest-color matching never has to convert color spaces on the
 * fly. See packages/color/src/dmc/README.md for the CSV's provenance.
 *
 * Deliberately plain CommonJS (no ts-node/build step) so it can run with
 * only a bare `node` binary, including before the workspace has installed
 * dependencies. The sRGB<->Lab math here must stay numerically identical to
 * packages/color/src/space/srgb-lab.ts - it is not imported from there
 * because re-implementing ~20 lines of pure math is simpler than adding a
 * build step for a script that runs once per dataset update.
 *
 * Usage: node tools/generate-dmc-colors.js
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

const dmcDir = path.join(__dirname, '..', 'packages', 'color', 'src', 'dmc');
const csvPath = path.join(dmcDir, 'source.csv');
const outPath = path.join(dmcDir, 'dmc-colors.json');

const [, ...rows] = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);

const codes = new Set();
const colors = rows.map((line) => {
  const [code, name, r, g, b] = line.split(',');
  if (codes.has(code)) throw new Error(`duplicate DMC code in source.csv: ${code}`);
  codes.add(code);

  const rgb = { r: Number(r), g: Number(g), b: Number(b) };
  return {
    code: code.trim(),
    name: name.trim(),
    hex: `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`,
    rgb,
    lab: roundLab(srgbToLab(rgb)),
  };
});

fs.writeFileSync(outPath, JSON.stringify(colors, null, 2) + '\n');
console.log(`wrote ${colors.length} DMC colors with precomputed Lab to ${outPath}`);
