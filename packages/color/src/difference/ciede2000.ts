import { Lab } from '@stitchcraft/types';

/**
 * CIEDE2000 color difference (Sharma, Wu & Dalal, 2005).
 * Perceptually accurate distance between two CIELAB colors; used to find the
 * nearest real thread color to an arbitrary pixel color. Lower is closer;
 * roughly, dE < 1 is imperceptible, dE < 2-3 is noticeable only on close
 * inspection, dE > 5 is clearly a different color.
 */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const CBar = (C1 + C2) / 2;

  const CBar7 = Math.pow(CBar, 7);
  const G = 0.5 * (1 - Math.sqrt(CBar7 / (CBar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = hueAngleDeg(a1p, b1);
  const h2p = hueAngleDeg(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(toRad(dhp) / 2);

  const LBarp = (L1 + L2) / 2;
  const CBarp = (C1p + C2p) / 2;

  let hBarp: number;
  if (C1p * C2p === 0) {
    hBarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hBarp = (h1p + h2p + 360) / 2;
  } else {
    hBarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(toRad(hBarp - 30)) +
    0.24 * Math.cos(toRad(2 * hBarp)) +
    0.32 * Math.cos(toRad(3 * hBarp + 6)) -
    0.2 * Math.cos(toRad(4 * hBarp - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hBarp - 275) / 25, 2));
  const CBarp7 = Math.pow(CBarp, 7);
  const RC = 2 * Math.sqrt(CBarp7 / (CBarp7 + Math.pow(25, 7)));

  const SL = 1 + (0.015 * Math.pow(LBarp - 50, 2)) / Math.sqrt(20 + Math.pow(LBarp - 50, 2));
  const SC = 1 + 0.045 * CBarp;
  const SH = 1 + 0.015 * CBarp * T;
  const RT = -Math.sin(toRad(2 * dTheta)) * RC;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const termL = dLp / (kL * SL);
  const termC = dCp / (kC * SC);
  const termH = dHp / (kH * SH);

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + RT * termC * termH);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** atan2(b, a') normalized to [0, 360). */
function hueAngleDeg(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const deg = toDeg(Math.atan2(b, a));
  return deg < 0 ? deg + 360 : deg;
}
