// Neon Cover Studio: boot. Loads the sample photos, applies any URL scene,
// mounts the editor and paints the first preview. The app needs no network
// once loaded: every asset is a file under app/.

import { createPoster, loadSamples } from './state.js';
import { applyScene, readSceneParams } from './scenes.js';
import { exportPoster, mountEditor, renderPreview } from './ui.js';
import { paintPoster } from './poster.js';

const canvas = document.getElementById('posterCanvas');
const poster = createPoster();
const photos = [];

function render() {
  renderPreview(canvas, poster);
}

async function boot() {
  await document.fonts.ready;
  try {
    // The display face drives the caption; load it explicitly so the first
    // paint (and a cover-only shot, where the header is hidden) uses it.
    await document.fonts.load('100px Anton');
  } catch {
    // The caption falls back to the system display stack.
  }
  const samples = await loadSamples();
  photos.push(...samples);

  const params = readSceneParams();
  const shot = applyScene(poster, photos, params);

  // With no scene photo, start from the boulevard sample in every panel.
  if (!params.get('photo') && !params.get('photo1')) {
    const first = photos[0];
    if (first) {
      for (let i = 0; i < poster.panels.length; i++) {
        poster.panels[i].photo = first.img;
      }
    }
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    render();
  } else {
    document.getElementById('titleInput').value = poster.title;
    document.getElementById('subtitleInput').value = poster.subtitle;
    mountEditor({ canvas, poster, photos, onRender: render });
    render();
  }

  // A small hook for automation and for the finalist review's own checks.
  window.neonCover = { poster, photos, render, exportPoster, paintPoster };
}

boot().catch((error) => {
  console.error('Neon Cover Studio failed to start:', error);
});
