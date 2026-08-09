import {
  CIRCULAR_MILS, AWG_ORDER, AMPACITY_OUTSIDE, ENGINE_SPACE_FACTOR,
  bundleFactor, K_COPPER, STANDARD_FUSES,
} from './tables.js';

// Derated ampacity of one AWG size in the given environment.
export function ampacity(awg, { insulationC = 105, engineSpace = false, bundleCount = 1 } = {}) {
  const base = AMPACITY_OUTSIDE[insulationC]?.[awg];
  if (base === undefined) throw new Error(`no ampacity data for ${awg} AWG at ${insulationC}°C`);
  let a = base;
  if (engineSpace) {
    const f = ENGINE_SPACE_FACTOR[insulationC];
    if (f === null) throw new Error(`${insulationC}°C insulation is not permitted in engine spaces (ABYC E-11)`);
    a *= f;
  }
  return a * bundleFactor(bundleCount);
}

// Minimum AWG to keep voltage drop within dropPct on a DC circuit.
// lengthFt is the ROUND-TRIP conductor length (source to device and back).
export function awgForVoltageDrop({ amps, lengthFt, dropPct, voltage }) {
  const allowableDrop = voltage * (dropPct / 100);
  const requiredCM = (K_COPPER * amps * lengthFt) / allowableDrop;
  for (const awg of AWG_ORDER) {
    if (CIRCULAR_MILS[awg] >= requiredCM) return { awg, requiredCM };
  }
  return { awg: null, requiredCM };
}

// Minimum AWG whose derated ampacity carries the load.
export function awgForAmpacity(amps, env) {
  for (const awg of AWG_ORDER) {
    if (ampacity(awg, env) >= amps) return awg;
  }
  return null;
}

// Smallest standard fuse >= target.
function nextFuse(target) {
  return STANDARD_FUSES.find((f) => f >= target) ?? null;
}

// Size one DC circuit per ABYC E-11 method:
// wire = larger of (voltage-drop minimum, ampacity minimum);
// fuse >= 125% of continuous load (100% if not continuous), and never
// above the derated ampacity of the chosen wire — upsizing the wire if
// needed to open a valid fuse window.
export function sizeCircuit({
  amps, lengthFt, dropPct = 3, voltage = 12,
  insulationC = 105, engineSpace = false, bundleCount = 1, continuous = true,
}) {
  if (!(amps > 0) || !(lengthFt > 0)) throw new Error('amps and lengthFt must be positive');
  const env = { insulationC, engineSpace, bundleCount };
  const warnings = [];

  const vd = awgForVoltageDrop({ amps, lengthFt, dropPct, voltage });
  const ampAwg = awgForAmpacity(amps, env);
  if (vd.awg === null || ampAwg === null) {
    return { awg: null, fuse: null, warnings: ['load exceeds 4/0 AWG — parallel runs or higher voltage needed'] };
  }

  let idx = Math.max(AWG_ORDER.indexOf(vd.awg), AWG_ORDER.indexOf(ampAwg));
  const governs = AWG_ORDER.indexOf(vd.awg) >= AWG_ORDER.indexOf(ampAwg) ? 'voltage-drop' : 'ampacity';

  const fuseTarget = continuous ? amps * 1.25 : amps;
  let awg, wireAmpacity, fuse;
  for (; idx < AWG_ORDER.length; idx++) {
    awg = AWG_ORDER[idx];
    wireAmpacity = ampacity(awg, env);
    fuse = nextFuse(fuseTarget);
    if (fuse !== null && fuse <= wireAmpacity) break;
    if (idx === AWG_ORDER.length - 1) {
      warnings.push('no standard fuse fits between 125% of load and wire ampacity');
      fuse = null;
    }
  }

  const actualDropPct = ((K_COPPER * amps * lengthFt) / CIRCULAR_MILS[awg] / voltage) * 100;
  return {
    awg,
    governs,
    fuse,
    wireAmpacity: Math.round(wireAmpacity * 10) / 10,
    actualDropPct: Math.round(actualDropPct * 100) / 100,
    requiredCM: Math.round(vd.requiredCM),
    warnings,
  };
}
