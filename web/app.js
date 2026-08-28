// The DC circuit sizer, run in the browser. Same math as the CLI: this file
// imports lib/calc.js directly and esbuild bundles it (calc.js, tables.js,
// and ampacity/data/e11.json) into one file for the page. No table value or
// formula is copied here — see test/web-bundle.test.mjs, which bundles this
// same file and checks it against a direct `sizeCircuit` import.
import { sizeCircuit } from '../lib/calc.js';

export { sizeCircuit };

const AWG_LABEL = (awg) => (awg === null ? '4/0+' : `${awg} AWG`);

function sentence(r, lengthFt) {
  if (r.awg === null) return r.warnings[0];
  if (r.fuse === null) {
    return `At ${lengthFt} ft round trip, ${AWG_LABEL(r.awg)} is required, but no standard fuse fits.`;
  }
  const rule = r.governs === 'voltage-drop' ? 'voltage drop' : 'heat (ampacity)';
  return `At ${lengthFt} ft round trip, ${rule} decides: ${AWG_LABEL(r.awg)}, ${r.fuse}A fuse.`;
}

// Pure enough to unit-test without touching the DOM: given the raw form
// values, return what the page should show.
export function resultFor({ amps, lengthFt, voltage = 12, critical, engineSpace, bundle }) {
  if (!(amps > 0) || !(lengthFt > 0) || !(voltage > 0)) return null;
  const r = sizeCircuit({
    amps,
    lengthFt,
    voltage,
    dropPct: critical ? 3 : 10,
    engineSpace,
    bundleCount: bundle,
  });
  return { ...r, sentence: sentence(r, lengthFt) };
}

function initDOM() {
  const $ = (id) => document.getElementById(id);
  const inputs = {
    amps: $('amps'),
    lengthFt: $('lengthFt'),
    voltage: $('voltage'),
    critical: $('critical'),
    engineSpace: $('engineSpace'),
    bundle: $('bundle'),
  };
  const out = { awg: $('outAwg'), fuse: $('outFuse'), sentence: $('outSentence'), warning: $('outWarning') };

  function update() {
    const r = resultFor({
      amps: parseFloat(inputs.amps.value),
      lengthFt: parseFloat(inputs.lengthFt.value),
      voltage: parseFloat(inputs.voltage.value),
      critical: inputs.critical.checked,
      engineSpace: inputs.engineSpace.checked,
      bundle: parseInt(inputs.bundle.value, 10) || 1,
    });
    if (!r) {
      out.awg.textContent = '—';
      out.fuse.textContent = '—';
      out.sentence.textContent = '';
      out.warning.textContent = '';
      return;
    }
    out.warning.textContent = r.warnings.join(' ');
    if (r.awg === null) {
      out.awg.textContent = '—';
      out.fuse.textContent = '—';
      out.sentence.textContent = r.sentence;
      return;
    }
    out.awg.textContent = AWG_LABEL(r.awg);
    out.fuse.textContent = r.fuse === null ? '—' : `${r.fuse} A`;
    out.sentence.textContent = r.sentence;
  }

  for (const el of Object.values(inputs)) el.addEventListener('input', update);
  update();
}

// Guarded so this same file can be bundled and required in a test without a
// DOM present (see test/web-bundle.test.mjs).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDOM);
  else initDOM();
}
