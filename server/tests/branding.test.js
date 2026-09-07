import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'zlib';
import { sampleBrandColor } from '../src/branding.js';

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function buildPalettePng(width, height, palette, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // color type: indexed
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const plte = Buffer.concat(palette.map(([r, g, b]) => Buffer.from([r, g, b])));
  const trns = Buffer.from(palette.map(() => 255));
  const stride = width + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < width; x++) raw[y * stride + 1 + x] = pixels[y][x];
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('tRNS', trns),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('svg sampler: gradient stop-color resolves the brand hue', () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#ea580c"/><stop stop-color="#f97316"/></linearGradient></defs><rect fill="url(#g)" width="64" height="64"/><rect fill="#0f172a" width="8" height="64" opacity="0.2"/></svg>'
  );
  assert.equal(sampleBrandColor(svg, 'image/svg+xml'), '#ea580c');
});

test('png sampler: palette logo on white picks the vivid mark', () => {
  const w = 32;
  const h = 32;
  const logo = buildPalettePng(w, h,
    [[0xea, 0x58, 0x0c], [0xff, 0xff, 0xff]],
    Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x < 12 ? 0 : 1)))
  );
  assert.equal(sampleBrandColor(logo, 'image/png'), '#ea580c');
});

test('png sampler: unsupported/interrupted content returns null', () => {
  assert.equal(sampleBrandColor(Buffer.from('not an image'), 'application/octet-stream'), null);
  assert.equal(sampleBrandColor(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), 'image/png'), null);
});