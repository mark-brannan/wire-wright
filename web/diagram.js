// STUB. Where the wiring-diagram renderer lives is an open decision
// (https://github.com/mark-brannan/wire-wright/issues/7): a small diagram
// package, rendering inside the demo page, or a port of an existing SVG
// schematic emitter. This file is the in-page option only, kept small so it
// can be deleted or moved whole once that call is made. Nothing here is an
// API: the function name, its input shape and the drawing may all change.
//
// It draws the positive side of a DC one-line from the same rows the grid
// sizes: battery -> positive bus -> fuse -> labelled wire run -> load. A
// planned circuit is dashed; a run whose length is not measured is drawn in
// the guess colour; a row that could not be sized is drawn in the error colour.

const ROW = 44;
const TOP = 56;
const BUS_X = 130;
const FUSE_X = 160, FUSE_W = 64;
const LOAD_X = 470, LOAD_W = 230;
const WIDTH = LOAD_X + LOAD_W + 10;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// `circuits` is one entry per grid row, in grid order: the row as typed
// (`row`, CSV-shaped strings) and what `sizeRow` returned for it (`sized`).
export function diagramSVG(circuits) {
  const height = TOP + Math.max(circuits.length, 1) * ROW;
  const busTop = TOP - 20, busBottom = TOP + (circuits.length - 1) * ROW + 10;
  const parts = [];

  parts.push(
    `<g class="dg-source">`,
    `<rect x="10" y="${busTop - 16}" width="76" height="32" rx="4"/>`,
    `<text x="48" y="${busTop + 5}" text-anchor="middle">12 V battery</text>`,
    `<line x1="86" y1="${busTop}" x2="${BUS_X}" y2="${busTop}"/>`,
    `</g>`,
    `<line class="dg-bus" x1="${BUS_X}" y1="${busTop}" x2="${BUS_X}" y2="${Math.max(busBottom, busTop + 20)}"/>`,
    `<text class="dg-small" x="${BUS_X + 6}" y="${busTop - 6}">+ bus</text>`,
  );

  circuits.forEach(({ row, sized }, i) => {
    const y = TOP + i * ROW;
    const r = sized.row;
    const planned = row.status && row.status !== 'installed';
    const guessed = sized.flags.some((f) => f.startsWith('length:'));
    const cls = ['dg-circuit', planned ? 'dg-planned' : '', sized.error ? 'dg-error' : ''].join(' ').trim();
    const fuse = r && r.fuse !== null ? `${r.fuse} A` : '—';
    const awg = !r ? 'not sized' : r.awg === null ? '4/0+' : `${r.awg} AWG`;
    const wireMid = (FUSE_X + FUSE_W + LOAD_X) / 2;

    parts.push(
      `<g class="${cls}">`,
      `<title>${esc(row.name)}: ${esc(awg)}, ${esc(fuse)} fuse${sized.error ? ` (${esc(sized.error)})` : ''}</title>`,
      `<line x1="${BUS_X}" y1="${y}" x2="${FUSE_X}" y2="${y}"/>`,
      `<rect class="dg-fuse" x="${FUSE_X}" y="${y - 11}" width="${FUSE_W}" height="22" rx="11"/>`,
      `<text x="${FUSE_X + FUSE_W / 2}" y="${y + 4}" text-anchor="middle">${esc(fuse)}</text>`,
      `<line class="dg-wire${guessed ? ' dg-guess' : ''}" x1="${FUSE_X + FUSE_W}" y1="${y}" x2="${LOAD_X}" y2="${y}"/>`,
      `<text class="dg-label" x="${wireMid}" y="${y - 6}" text-anchor="middle">${esc(awg)}</text>`,
      `<text class="dg-small" x="${wireMid}" y="${y + 15}" text-anchor="middle">${esc(row.length_ft)} ft round trip${guessed ? ` (${esc(row.length_source || 'guess')})` : ''}</text>`,
      `<rect class="dg-load" x="${LOAD_X}" y="${y - 14}" width="${LOAD_W}" height="28" rx="4"/>`,
      `<text x="${LOAD_X + 8}" y="${y + 5}">${esc(clip(row.name, 30))}</text>`,
      `</g>`,
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" class="diagram" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-label="DC one-line diagram of the circuits above">${parts.join('')}</svg>`;
}
