import type {
  LabColor,
  LchColor,
  SrgbColor,
  XyzColor,
} from "@/utils/fashionCompatibility/color/types";

// W3C CSS Color 4 uses this IEC 61966-2-1 transfer function and D65 matrix.
const D65 = {
  x: 0.3127 / 0.329,
  y: 1,
  z: (1 - 0.3127 - 0.329) / 0.329,
};
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertSrgb(color: SrgbColor) {
  for (const [channel, value] of Object.entries(color)) {
    assertFinite(value, `sRGB ${channel}`);
    if (value < 0 || value > 255) {
      throw new RangeError(`sRGB ${channel} must be between 0 and 255.`);
    }
  }
}

function assertLab(color: LabColor) {
  assertFinite(color.l, "Lab L");
  assertFinite(color.a, "Lab a");
  assertFinite(color.b, "Lab b");
}

function linearizeSrgb(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function srgbToXyzD65(color: SrgbColor): XyzColor {
  assertSrgb(color);
  const r = linearizeSrgb(color.r);
  const g = linearizeSrgb(color.g);
  const b = linearizeSrgb(color.b);

  return {
    x: (506752 / 1228815) * r + (87881 / 245763) * g + (12673 / 70218) * b,
    y: (87098 / 409605) * r + (175762 / 245763) * g + (12673 / 175545) * b,
    z: (7918 / 409605) * r + (87881 / 737289) * g + (1001167 / 1053270) * b,
  };
}

function labTransfer(value: number) {
  return value > LAB_EPSILON
    ? Math.cbrt(value)
    : (LAB_KAPPA * value + 16) / 116;
}

export function xyzD65ToLab(color: XyzColor): LabColor {
  assertFinite(color.x, "XYZ X");
  assertFinite(color.y, "XYZ Y");
  assertFinite(color.z, "XYZ Z");
  const x = labTransfer(color.x / D65.x);
  const y = labTransfer(color.y / D65.y);
  const z = labTransfer(color.z / D65.z);

  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function srgbToLabD65(color: SrgbColor) {
  return xyzD65ToLab(srgbToXyzD65(color));
}

export function labToLch(color: LabColor): LchColor {
  assertLab(color);
  const c = Math.hypot(color.a, color.b);
  if (c <= Number.EPSILON) return { l: color.l, c };
  const h = (Math.atan2(color.b, color.a) * 180) / Math.PI;
  return { l: color.l, c, h: h < 0 ? h + 360 : h };
}

export function hueAngleDifference(a?: number, b?: number) {
  if (a === undefined || b === undefined) return undefined;
  assertFinite(a, "hue A");
  assertFinite(b, "hue B");
  const difference = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(difference, 360 - difference);
}

export function deltaE76(a: LabColor, b: LabColor) {
  assertLab(a);
  assertLab(b);
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function hueDegrees(a: number, b: number) {
  if (a === 0 && b === 0) return 0;
  const degrees = radiansToDegrees(Math.atan2(b, a));
  return degrees >= 0 ? degrees : degrees + 360;
}

// ISO/CIE 11664-6 CIEDE2000, with the reference parametric factors kL=kC=kH=1.
export function deltaE2000(first: LabColor, second: LabColor) {
  assertLab(first);
  assertLab(second);
  const c1 = Math.hypot(first.a, first.b);
  const c2 = Math.hypot(second.a, second.b);
  const meanC = (c1 + c2) / 2;
  const meanC7 = meanC ** 7;
  const g = 0.5 * (1 - Math.sqrt(meanC7 / (meanC7 + 25 ** 7)));
  const a1Prime = (1 + g) * first.a;
  const a2Prime = (1 + g) * second.a;
  const c1Prime = Math.hypot(a1Prime, first.b);
  const c2Prime = Math.hypot(a2Prime, second.b);
  const h1Prime = hueDegrees(a1Prime, first.b);
  const h2Prime = hueDegrees(a2Prime, second.b);
  const deltaLPrime = second.l - first.l;
  const deltaCPrime = c2Prime - c1Prime;
  const chromaProduct = c1Prime * c2Prime;

  let deltaHuePrime = h2Prime - h1Prime;
  if (chromaProduct === 0) deltaHuePrime = 0;
  else if (deltaHuePrime > 180) deltaHuePrime -= 360;
  else if (deltaHuePrime < -180) deltaHuePrime += 360;

  const deltaHPrime =
    2 * Math.sqrt(chromaProduct) * Math.sin(degreesToRadians(deltaHuePrime / 2));
  const meanLPrime = (first.l + second.l) / 2;
  const meanCPrime = (c1Prime + c2Prime) / 2;

  let meanHuePrime = h1Prime + h2Prime;
  if (chromaProduct !== 0) {
    const hueDistance = Math.abs(h1Prime - h2Prime);
    meanHuePrime =
      hueDistance <= 180
        ? (h1Prime + h2Prime) / 2
        : h1Prime + h2Prime < 360
          ? (h1Prime + h2Prime + 360) / 2
          : (h1Prime + h2Prime - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(meanHuePrime - 30)) +
    0.24 * Math.cos(degreesToRadians(2 * meanHuePrime)) +
    0.32 * Math.cos(degreesToRadians(3 * meanHuePrime + 6)) -
    0.2 * Math.cos(degreesToRadians(4 * meanHuePrime - 63));
  const deltaTheta =
    30 * Math.exp(-(((meanHuePrime - 275) / 25) ** 2));
  const meanCPrime7 = meanCPrime ** 7;
  const rc = 2 * Math.sqrt(meanCPrime7 / (meanCPrime7 + 25 ** 7));
  const meanLTerm = (meanLPrime - 50) ** 2;
  const sl = 1 + (0.015 * meanLTerm) / Math.sqrt(20 + meanLTerm);
  const sc = 1 + 0.045 * meanCPrime;
  const sh = 1 + 0.015 * meanCPrime * t;
  const rt = -Math.sin(degreesToRadians(2 * deltaTheta)) * rc;
  const lTerm = deltaLPrime / sl;
  const cTerm = deltaCPrime / sc;
  const hTerm = deltaHPrime / sh;

  return Math.sqrt(
    lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rt * cTerm * hTerm
  );
}
