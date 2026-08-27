// Thin accessor over the language-neutral `ampacity` data package.
// All table values and their provenance live there, not here.
//
// Imported as a JSON module rather than via createRequire so this file also
// runs in a browser bundle (esbuild's JSON loader understands this import
// as-is; createRequire has no browser equivalent). Node 20.10+/22/24 support
// the `with { type: 'json' }` attribute natively — see the CI matrix.
import e11 from 'ampacity/data/e11.json' with { type: 'json' };

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
