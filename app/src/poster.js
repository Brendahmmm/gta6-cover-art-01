// Neon Cover Studio: the poster painter. It draws a multi-panel cover onto any
// canvas at the canvas's own pixel size: photos in framed panels, a colour
// grade, and bold display lettering over a legibility scrim. Pure canvas
// drawing — no DOM, no network.

export const POSTER_SIZES = {
  square: { width: 1080, height: 1080, label: 'Square · 1080 × 1080' },
  portrait: { width: 1080, height: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { width: 1920, height: 1080, label: 'Wide · 1920 × 1080' },
};

// Each layout is a list of fractional frames (x, y, w, h in 0..1 of the poster
// area). `frames` gets true for a landscape canvas so a layout can turn itself
// around; slots is how many panels it fills.
export const POSTER_LAYOUTS = {
  full: {
    label: 'Full',
    slots: 1,
    frames: () => [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  duo: {
    label: 'Duo',
    slots: 2,
    frames: (wide) =>
      wide
        ? [
            { x: 0, y: 0, w: 0.5, h: 1 },
            { x: 0.5, y: 0, w: 0.5, h: 1 },
          ]
        : [
            { x: 0, y: 0, w: 1, h: 0.5 },
            { x: 0, y: 0.5, w: 1, h: 0.5 },
          ],
  },
  triptych: {
    label: 'Triptych',
    slots: 3,
    frames: (wide) => {
      if (wide) {
        const third = 1 / 3;
        return [0, 1, 2].map((i) => ({ x: third * i, y: 0, w: third, h: 1 }));
      }
      const third = 1 / 3;
      return [0, 1, 2].map((i) => ({ x: 0, y: third * i, w: 1, h: third }));
    },
  },
  mosaic: {
    label: 'Mosaic',
    slots: 4,
    frames: () => [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  feature: {
    label: 'Feature',
    slots: 3,
    frames: (wide) => {
      if (wide) {
        return [
          { x: 0, y: 0, w: 0.62, h: 1 },
          { x: 0.62, y: 0, w: 0.38, h: 0.5 },
          { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
        ];
      }
      return [
        { x: 0, y: 0, w: 1, h: 0.62 },
        { x: 0, y: 0.62, w: 0.5, h: 0.38 },
        { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
      ];
    },
  },
};

export const POSTER_GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.42) contrast(1.09) brightness(1.03)',
    accent: '#ff6b81',
    tint: { blend: 'overlay', from: 'rgba(255,122,40,0.20)', to: 'rgba(150,20,95,0.30)' },
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.58) contrast(1.13) brightness(0.99)',
    accent: '#2ee6c8',
    tint: { blend: 'soft-light', from: 'rgba(255,40,145,0.34)', to: 'rgba(30,205,255,0.34)' },
  },
  palms: {
    label: 'Palms',
    filter: 'saturate(1.22) contrast(1.07) hue-rotate(-9deg)',
    accent: '#ffd166',
    tint: { blend: 'overlay', from: 'rgba(35,185,160,0.15)', to: 'rgba(10,55,105,0.30)' },
  },
  chrome: {
    label: 'Chrome',
    filter: 'grayscale(1) contrast(1.20) brightness(1.04)',
    accent: '#ffffff',
    tint: { blend: 'soft-light', from: 'rgba(255,240,220,0.18)', to: 'rgba(12,10,32,0.24)' },
  },
};

const FRAME_COLOR = '#0a0710';
const SCRIM_RGB = '8,4,18';
const DISPLAY_STACK = 'Anton, "Arial Black", sans-serif';
const BODY_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Pixel frames for a layout inside the poster's black frame and gutters. */
export function posterFrames(layout, width, height) {
  const gap = Math.max(6, Math.round(Math.min(width, height) * 0.012));
  const spec = POSTER_LAYOUTS[layout] || POSTER_LAYOUTS.feature;
  const wide = width >= height;
  const innerX = gap;
  const innerY = gap;
  const innerW = width - gap * 2;
  const innerH = height - gap * 2;
  return spec.frames(wide).map((f) => {
    const x = innerX + f.x * innerW + (f.x > 0 ? gap / 2 : 0);
    const y = innerY + f.y * innerH + (f.y > 0 ? gap / 2 : 0);
    const w = f.w * innerW - (f.x > 0 ? gap / 2 : 0) - (f.x + f.w < 1 ? gap / 2 : 0);
    const h = f.h * innerH - (f.y > 0 ? gap / 2 : 0) - (f.y + f.h < 1 ? gap / 2 : 0);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  });
}

/** A fresh panel: empty, fitted to its frame, unpanned. */
export function newPanel() {
  return { photo: null, zoom: 1, panX: 0, panY: 0 };
}

/** Clamps a pan to the slack the zoomed photo leaves around its frame. */
export function clampPanFor(frame, photo, zoom, panX, panY) {
  if (!photo) return { panX: 0, panY: 0 };
  const base = Math.max(frame.w / photo.naturalWidth, frame.h / photo.naturalHeight);
  const scale = base * zoom;
  const slackX = Math.max(0, (photo.naturalWidth * scale - frame.w) / 2 / frame.w);
  const slackY = Math.max(0, (photo.naturalHeight * scale - frame.h) / 2 / frame.h);
  return {
    panX: Math.max(-slackX, Math.min(slackX, panX)),
    panY: Math.max(-slackY, Math.min(slackY, panY)),
  };
}

/** Paints one panel: the photo cover-fit with pan and zoom, then the grade. */
function paintPhotoPanel(ctx, frame, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.w, frame.h);
  ctx.clip();
  if (!panel || !panel.photo) {
    paintEmptyPanel(ctx, frame);
    ctx.restore();
    return;
  }
  const photo = panel.photo;
  const base = Math.max(frame.w / photo.naturalWidth, frame.h / photo.naturalHeight);
  const scale = base * panel.zoom;
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  const dx = frame.x + (frame.w - dw) / 2 + panel.panX * frame.w;
  const dy = frame.y + (frame.h - dh) / 2 + panel.panY * frame.h;
  ctx.filter = grade.filter;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.filter = 'none';
  const tint = ctx.createLinearGradient(frame.x, frame.y, frame.x, frame.y + frame.h);
  tint.addColorStop(0, grade.tint.from);
  tint.addColorStop(1, grade.tint.to);
  ctx.globalCompositeOperation = grade.tint.blend;
  ctx.fillStyle = tint;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.globalCompositeOperation = 'source-over';
  paintVignette(ctx, frame);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);
  ctx.restore();
}

/** The placeholder a panel shows before a photo is assigned to it. */
function paintEmptyPanel(ctx, frame) {
  const grad = ctx.createLinearGradient(frame.x, frame.y, frame.x, frame.y + frame.h);
  grad.addColorStop(0, '#241536');
  grad.addColorStop(1, '#100820');
  ctx.fillStyle = grad;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = Math.max(1, frame.w * 0.004);
  ctx.setLineDash([frame.w * 0.022, frame.w * 0.016]);
  ctx.strokeRect(frame.x + frame.w * 0.07, frame.y + frame.h * 0.07, frame.w * 0.86, frame.h * 0.86);
  ctx.setLineDash([]);
  const size = Math.min(frame.w, frame.h) * 0.085;
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `600 ${size}px ${BODY_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+ ADD A PHOTO', frame.x + frame.w / 2, frame.y + frame.h / 2);
}

/** A soft darkening toward a panel's edges, for depth and legibility. */
function paintVignette(ctx, frame) {
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const radius = Math.hypot(frame.w, frame.h) / 2;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.42, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
}

/** Wraps words into at most two lines, shrinking the type until they fit. */
function fitCaptionLines(ctx, words, maxWidth, startSize, minSize) {
  let size = startSize;
  for (;;) {
    ctx.font = `${size}px ${DISPLAY_STACK}`;
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 || size <= minSize) return { lines, size };
    size *= 0.93;
  }
}

/** The caption block: a scrim, the title in display type, a bar, a subtitle. */
function paintCaption(ctx, width, height, poster, grade) {
  const title = poster.title.trim().toUpperCase();
  const subtitle = poster.subtitle.trim().toUpperCase();
  if (!title && !subtitle) return;
  const onTop = poster.titleAtTop;
  const scrimH = height * 0.46;
  const scrim = onTop
    ? ctx.createLinearGradient(0, 0, 0, scrimH)
    : ctx.createLinearGradient(0, height - scrimH, 0, height);
  scrim.addColorStop(onTop ? 0 : 1, `rgba(${SCRIM_RGB},0.82)`);
  scrim.addColorStop(onTop ? 1 : 0, `rgba(${SCRIM_RGB},0)`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, onTop ? 0 : height - scrimH, width, scrimH);

  const pad = height * 0.05;
  const maxWidth = width * 0.86;
  let lines = [];
  let size = height * 0.105 * (poster.titleScale || 1);
  if (title) {
    const fitted = fitCaptionLines(ctx, title.split(/\s+/), maxWidth, size, height * 0.03);
    lines = fitted.lines;
    size = fitted.size;
  }
  const lineHeight = size * 1.04;
  const subSize = Math.max(10, size * 0.21);
  const barH = Math.max(3, size * 0.07);
  const gap = size * 0.24;
  const blockH = lines.length * lineHeight + (subtitle ? gap + barH + gap + subSize : 0);
  const top = onTop ? pad : height - pad - blockH;
  let y = top;
  if (lines.length) {
    ctx.font = `${size}px ${DISPLAY_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(10,4,20,0.95)';
    ctx.lineWidth = Math.max(2, size * 0.14);
    for (const line of lines) {
      y += lineHeight * 0.88;
      ctx.strokeText(line, width / 2, y);
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.045;
    y = top;
    for (const line of lines) {
      y += lineHeight * 0.88;
      ctx.fillText(line, width / 2, y);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (!subtitle) return;
  y += gap;
  const barW = Math.min(width * 0.15, maxWidth * 0.28);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(width / 2 - barW / 2, y, barW, barH);
  y += gap + subSize;
  ctx.font = `600 ${subSize}px ${BODY_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try {
    ctx.letterSpacing = `${Math.round(subSize * 0.34)}px`;
  } catch {
    // letterSpacing is Chrome-only; the subtitle still draws without it.
  }
  ctx.fillStyle = grade.accent;
  ctx.fillText(subtitle, width / 2, y);
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // ignore
  }
}

/** The studio's mark: three rising bars and a label, in the corner opposite
 *  the title. The whole mark is measured first so it always fits inside. */
function paintStudioMark(ctx, width, height, poster, grade) {
  const unit = Math.min(width, height) * 0.011;
  const margin = Math.max(12, Math.min(width, height) * 0.022);
  const label = 'NEON COVER STUDIO';
  const fontSize = unit * 1.5;
  ctx.save();
  ctx.font = `600 ${fontSize}px ${BODY_STACK}`;
  try {
    ctx.letterSpacing = `${Math.round(unit * 0.5)}px`;
  } catch {
    // ignore
  }
  const textW = ctx.measureText(label).width;
  const barsW = unit * 4.5;
  const gapW = unit * 1.2;
  const markW = barsW + gapW + textW;
  const markH = unit * 3.4;
  const x = width - margin - markW;
  const y = poster.titleAtTop ? height - margin - markH : margin;
  ctx.fillStyle = grade.accent;
  for (let i = 0; i < 3; i++) {
    const barH = unit * (1.2 + i * 0.9);
    ctx.fillRect(x + i * unit * 1.5, y + markH - barH, unit, barH);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(label, x + barsW + gapW, y + markH / 2);
  ctx.restore();
}

/**
 * Paints the whole poster onto the canvas at the canvas's own size.
 * `options.highlight` draws a dashed outline around one panel (preview only;
 * exports pass nothing and get a clean poster).
 */
export function paintPoster(canvas, poster, options = {}) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const grade = POSTER_GRADES[poster.grade] || POSTER_GRADES.sunset;
  ctx.save();
  ctx.fillStyle = FRAME_COLOR;
  ctx.fillRect(0, 0, width, height);
  const frames = posterFrames(poster.layout, width, height);
  frames.forEach((frame, i) => paintPhotoPanel(ctx, frame, poster.panels[i], grade));
  paintCaption(ctx, width, height, poster, grade);
  paintStudioMark(ctx, width, height, poster, grade);
  const gap = Math.max(6, Math.round(Math.min(width, height) * 0.012));
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1, gap * 0.16);
  ctx.strokeRect(gap / 2, gap / 2, width - gap, height - gap);
  if (typeof options.highlight === 'number' && frames[options.highlight]) {
    const f = frames[options.highlight];
    ctx.strokeStyle = '#2ee6c8';
    ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
    ctx.setLineDash([Math.min(width, height) * 0.02, Math.min(width, height) * 0.012]);
    ctx.strokeRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4);
    ctx.setLineDash([]);
  }
  ctx.restore();
}
