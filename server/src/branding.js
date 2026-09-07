import zlib from 'zlib';

// Extract a brand color from a logo image so the app can build a custom
// light/dark theme around the adopted company. Supports SVG (inline fills)
// and PNG (scanline decode). Returns '#rrggbb' or null if it can't tell.
export function sampleBrandColor(buf, contentType = '') {
  const type = String(contentType || '').toLowerCase();
  const bytes = buf instanceof Uint8Array ? buf : Buffer.from(buf);
  if (type.includes('svg') || isSvgText(bytes)) return sampleSvg(bytes);
  if (type.includes('png') || isPng(bytes)) return samplePng(bytes);
  return null;
}

function isPng(b) {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function isSvgText(b) {
  const head = b.subarray(0, 512).toString('latin1').toLowerCase();
  return head.includes('<svg');
}

function hex6(...rgb) {
  const p = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${p(rgb[0])}${p(rgb[1])}${p(rgb[2])}`;
}

function parseCssColor(str) {
  const s = str.trim().toLowerCase();
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 8) h = h.slice(0, 6); // drop alpha
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
}

function pickVivid(colors, size) {
  if (!colors.length) return null;
  const scores = colors
    .map((c, i) => {
      const [r, g, b] = c;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      // Prefer vivid, mid-luminance colors; favour larger areas, but never let a
      // huge near-neutral (white/black/logo base) mask the actual brand color.
      const count = size[i];
      const areaBoost = Math.min(1, count / 1200);
      const vivid = sat >= 0.16 && lum >= 0.14 && lum <= 0.88;
      return { i, key: (vivid ? 1 : 0) * 2 + Math.min(1, sat) * 0.9, s: vivid ? areaBoost + sat : areaBoost * 0.25 };
    });
  const ordered = scores.slice().sort((a, b) => b.key - a.key || b.s - a.s);
  return hex6(...colors[ordered[0].i]);
}

// ---------- SVG ----------
function sampleSvg(bytes) {
  const text = bytes.toString('utf8');
  const rgb = [];
  // fill/stroke/stop-color/color (as attributes or inside style="...") — covers
  // flat logos and gradients; class-based <style> rules are resolved afterward.
  const re = /(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|(?:black|white|red|blue|green|orange|purple)\b)/g;
  let m;
  while ((m = re.exec(text))) {
    const c = parseCssColor(m[1]);
    if (c) rgb.push(c);
  }
  if (!rgb.length) return null;
  const counts = {};
  const keys = [];
  for (const c of rgb) {
    const k = hex6(...c);
    if (!counts[k]) { counts[k] = 0; keys.push([c, k]); }
    counts[k]++;
  }
  const sizes = keys.map(([, k]) => counts[k]);
  return pickVivid(keys.map(([c]) => c), sizes);
}

// ---------- PNG ----------
function readU32(b, off) {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

function unfilterPng(pixels, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };
  for (let y = 0; y < height; y++) {
    const f = pixels[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const raw = pixels[rowStart + x];
      const left = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw;
      if (f === 1) v = (raw + left) & 0xff;
      else if (f === 2) v = (raw + up) & 0xff;
      else if (f === 3) v = (raw + ((left + up) >> 1)) & 0xff;
      else if (f === 4) v = (raw + paeth(left, up, upLeft)) & 0xff;
      out[y * stride + x] = v;
    }
  }
  return out;
}

function samplePng(bytes) {
  try {
    if (!isPng(bytes) || bytes.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
    const width = readU32(bytes, 16);
    const height = readU32(bytes, 20);
    const bitDepth = bytes[24];
    const colorType = bytes[25];
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6 && colorType !== 3 && colorType !== 0 && colorType !== 4)) return null;
    if (width < 8 || height < 8 || width * height > 2000000) return null;
    const bpp = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 3 ? 1 : colorType === 0 ? 1 : 3;
    const chunks = [];
    let palette = null;
    let trns = null;
    let off = 8;
    while (off + 8 <= bytes.length) {
      const len = readU32(bytes, off);
      const type = bytes.subarray(off + 4, off + 8).toString('latin1');
      const chunk = bytes.subarray(off + 8, off + 8 + len);
      if (type === 'PLTE') palette = chunk;
      if (type === 'tRNS') trns = chunk;
      if (type === 'IDAT') chunks.push(chunk);
      if (type === 'IEND') break;
      off += 12 + len;
    }
    if (!chunks.length) return null;
    const raw = zlib.inflateSync(Buffer.concat(chunks));
    const stride = width * bpp;
    if (raw.length < height * (stride + 1)) return null;
    const px = unfilterPng(raw, width, height, bpp);

    // Bucket colors so logos with gradients/antialiasing collapse to a few hues.
    const buckets = new Map();
    const totals = new Map();
    const add = (r, g, b, n = 1) => {
      const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
      const acc = buckets.get(key) || [0, 0, 0];
      acc[0] += r * n; acc[1] += g * n; acc[2] += b * n;
      buckets.set(key, acc);
      totals.set(key, (totals.get(key) || 0) + n);
    };
    if (colorType === 3) {
      // Palette-indexed: expand each pixel to its PLTE entry.
      const plt = (i) => [palette[i], palette[i + 1], palette[i + 2]];
      const alphaOf = (i) => (trns && trns[i] !== undefined ? trns[i] : 255);
      for (let i = 0; i < width * height; i++) {
        const idx = px[i];
        if (alphaOf(idx) < 200) continue;
        const [r, g, b] = plt(idx * 3);
        add(r, g, b);
      }
    } else if (colorType === 0 || colorType === 4) {
      // Greyscale (with optional alpha), 8-bit.
      for (let i = 0; i < px.length; i += bpp) {
        if (colorType === 4 && px[i + 1] < 200) continue;
        add(px[i], px[i], px[i]);
      }
    } else {
      for (let i = 0; i < px.length; i += bpp) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (colorType === 6 && px[i + 3] < 200) continue; // skip transparent
        add(r, g, b);
      }
    }
    const colors = [];
    const sizes = [];
    for (const [k, acc] of buckets) {
      const n = totals.get(k);
      colors.push([acc[0] / n, acc[1] / n, acc[2] / n]);
      sizes.push(n);
    }
    return pickVivid(colors, sizes);
  } catch {
    return null;
  }
}