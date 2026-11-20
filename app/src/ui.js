// Neon Cover Studio: the editor's wiring. It binds the page's controls to
// the poster, lets the user pick panels and drag their photos around, and
// exports the finished cover as a PNG at the poster's own size.

import {
  clampPanFor,
  paintPoster,
  posterFrames,
  POSTER_SIZES,
} from './poster.js';
import {
  assignPhoto,
  fillAllPanels,
  photoFromFile,
  slotCount,
} from './state.js';

/** Repaints the preview canvas at the poster's export size. */
export function renderPreview(canvas, poster) {
  const size = POSTER_SIZES[poster.size] || POSTER_SIZES.wide;
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  paintPoster(canvas, poster, { highlight: poster.selected });
}

/** Renders the poster offscreen and downloads it as a PNG. */
export function exportPoster(poster) {
  const size = POSTER_SIZES[poster.size] || POSTER_SIZES.wide;
  const offscreen = document.createElement('canvas');
  offscreen.width = size.width;
  offscreen.height = size.height;
  paintPoster(offscreen, poster);
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neon-cover-${size.width}x${size.height}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

/** Marks the active button of a chip group by its data attribute. */
function markGroup(row, attr, value) {
  row.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset[attr] === value);
  });
}

/** Binds every control in the page to the poster. */
export function mountEditor({ canvas, poster, photos, onRender }) {
  const $ = (id) => document.getElementById(id);
  const tray = $('tray');
  const zoomRange = $('zoomRange');
  const titleScale = $('titleScale');

  function refresh() {
    markGroup($('layoutRow'), 'layout', poster.layout);
    markGroup($('gradeRow'), 'grade', poster.grade);
    markGroup($('sizeRow'), 'size', poster.size);
    markGroup($('posRow'), 'pos', poster.titleAtTop ? 'top' : 'bottom');
    const panel = poster.panels[poster.selected];
    zoomRange.value = panel ? panel.zoom : 1;
    titleScale.value = poster.titleScale;
    tray.querySelectorAll('button').forEach((button, i) => {
      const photo = photos[i];
      const assigned =
        photo && poster.panels.slice(0, slotCount(poster)).some((p) => p.photo === photo.img);
      button.classList.toggle('assigned', Boolean(assigned));
    });
    onRender();
  }

  function rebuildTray() {
    tray.replaceChildren();
    photos.forEach((photo, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = photo.label;
      button.setAttribute('aria-label', `Use ${photo.label}`);
      const img = document.createElement('img');
      img.src = photo.img.src;
      img.alt = photo.label;
      button.appendChild(img);
      button.addEventListener('click', () => {
        assignPhoto(poster, poster.selected, photos[i]);
        refresh();
      });
      tray.appendChild(button);
    });
    refresh();
  }

  $('layoutRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-layout]');
    if (!button) return;
    poster.layout = button.dataset.layout;
    if (poster.selected >= slotCount(poster)) poster.selected = 0;
    refresh();
  });

  $('gradeRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-grade]');
    if (!button) return;
    poster.grade = button.dataset.grade;
    refresh();
  });

  $('sizeRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;
    poster.size = button.dataset.size;
    refresh();
  });

  $('posRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-pos]');
    if (!button) return;
    poster.titleAtTop = button.dataset.pos === 'top';
    refresh();
  });

  $('titleInput').addEventListener('input', (event) => {
    poster.title = event.target.value;
    onRender();
  });

  $('subtitleInput').addEventListener('input', (event) => {
    poster.subtitle = event.target.value;
    onRender();
  });

  titleScale.addEventListener('input', (event) => {
    poster.titleScale = Number(event.target.value);
    onRender();
  });

  zoomRange.addEventListener('input', (event) => {
    const panel = poster.panels[poster.selected];
    if (!panel) return;
    panel.zoom = Number(event.target.value);
    const frames = posterFrames(poster.layout, canvas.width, canvas.height);
    const clamped = clampPanFor(frames[poster.selected], panel.photo, panel.zoom, panel.panX, panel.panY);
    panel.panX = clamped.panX;
    panel.panY = clamped.panY;
    onRender();
  });

  $('resetPanBtn').addEventListener('click', () => {
    const panel = poster.panels[poster.selected];
    if (!panel) return;
    panel.zoom = 1;
    panel.panX = 0;
    panel.panY = 0;
    refresh();
  });

  $('fillAllBtn').addEventListener('click', () => {
    const panel = poster.panels[poster.selected];
    if (!panel || !panel.photo) return;
    const photo = photos.find((p) => p.img === panel.photo);
    if (photo) fillAllPanels(poster, photo);
    refresh();
  });

  $('fileInput').addEventListener('change', async (event) => {
    const files = [...event.target.files].filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const photo = await photoFromFile(file);
        photos.push(photo);
      } catch {
        // A file that does not load is skipped; the rest still land.
      }
    }
    if (files.length) {
      assignPhoto(poster, poster.selected, photos[photos.length - 1]);
      rebuildTray();
    }
    event.target.value = '';
  });

  $('exportBtn').addEventListener('click', () => {
    exportPoster(poster);
  });

  // --- pointer interaction on the preview canvas ---

  function frameAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const frames = posterFrames(poster.layout, canvas.width, canvas.height);
    const index = frames.findIndex((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
    return { index, x, y, frames };
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (event) => {
    const hit = frameAt(event.clientX, event.clientY);
    if (hit.index === -1) return;
    poster.selected = hit.index;
    const panel = poster.panels[hit.index];
    drag = { startX: hit.x, startY: hit.y, panX: panel.panX, panY: panel.panY, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
    refresh();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const hit = frameAt(event.clientX, event.clientY);
    const frame = hit.frames[poster.selected];
    const panel = poster.panels[poster.selected];
    if (!frame || !panel || !panel.photo) return;
    const dx = (hit.x - drag.startX) / frame.w;
    const dy = (hit.y - drag.startY) / frame.h;
    if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;
    const clamped = clampPanFor(frame, panel.photo, panel.zoom, drag.panX + dx, drag.panY + dy);
    panel.panX = clamped.panX;
    panel.panY = clamped.panY;
    onRender();
  });

  function endDrag(event) {
    if (!drag) return;
    drag = null;
    canvas.classList.remove('dragging');
    if (event) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // The capture may already be gone.
      }
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const hit = frameAt(event.clientX, event.clientY);
      if (hit.index === -1) return;
      poster.selected = hit.index;
      const panel = poster.panels[hit.index];
      if (!panel) return;
      const step = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      panel.zoom = Math.max(1, Math.min(2.5, panel.zoom * step));
      const clamped = clampPanFor(hit.frames[hit.index], panel.photo, panel.zoom, panel.panX, panel.panY);
      panel.panX = clamped.panX;
      panel.panY = clamped.panY;
      refresh();
    },
    { passive: false },
  );

  rebuildTray();
  return { refresh, rebuildTray };
}
