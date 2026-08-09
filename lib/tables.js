// Thin accessor over the language-neutral `ampacity` data package.
// All table values and their provenance live there, not here.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const e11 = require('ampacity/data/e11.json');

export const CIRCULAR_MILS = e11.circular_mils;
export const AWG_ORDER = e11.awg_order;
export const AMPACITY_OUTSIDE = e11.ampacity_outside_engine_spaces;
export const ENGINE_SPACE_FACTOR = e11.engine_space_factor;
export const K_COPPER = e11.k_copper_dc;
export const STANDARD_FUSES = e11.standard_fuse_ratings;

export function bundleFactor(count) {
  for (const { max_conductors, factor } of e11.bundle_factors_dc) {
    if (max_conductors === null || count <= max_conductors) return factor;
  }
  return e11.bundle_factors_dc.at(-1).factor;
}
