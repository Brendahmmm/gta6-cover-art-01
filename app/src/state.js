// Neon Cover Studio: the poster's state — the config, its panels and the
// photos that fill them. Photos are HTMLImageElements loaded from the app's
// own samples or from files the user picks on their machine; nothing is ever
// uploaded anywhere.

import { newPanel, POSTER_LAYOUTS } from './poster.js';

/** The sample photos shipped with the app (the kit's two, plus two made here). */
export const SAMPLE_PHOTOS = [
  { name: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
  { name: 'neon', label: 'Neon Street', src: 'samples/neon.jpg' },
  { name: 'palms', label: 'Palms', src: 'samples/palms.jpg' },
];

/** A fresh poster: feature layout, sunset grade, wide size, a default caption. */
export function createPoster() {
  return {
    layout: 'feature',
    grade: 'sunset',
    size: 'wide',
    title: 'Sunset Heist',
    subtitle: 'Neon Nights · 2026',
    titleAtTop: false,
    titleScale: 1,
    panels: [newPanel(), newPanel(), newPanel(), newPanel()],
    selected: 0,
  };
}

/** How many panels the current layout shows. */
export function slotCount(poster) {
  return (POSTER_LAYOUTS[poster.layout] || POSTER_LAYOUTS.feature).slots;
}

/** Loads an image from a URL (a sample path or a blob URL) as a promise. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** Loads every sample photo; resolves to [{name, label, img}]. */
export async function loadSamples() {
  const loaded = [];
  for (const sample of SAMPLE_PHOTOS) {
    loaded.push({ name: sample.name, label: sample.label, img: await loadImage(sample.src) });
  }
  return loaded;
}

/** Turns a user-picked File into a photo the poster can use. */
export async function photoFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const name = file.name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'photo';
  return { name, label: file.name, img, url };
}

/** Puts a photo in one panel, resetting its crop to fit the frame. */
export function assignPhoto(poster, index, photo) {
  const panel = poster.panels[index];
  if (!panel) return;
  panel.photo = photo ? photo.img : null;
  panel.zoom = 1;
  panel.panX = 0;
  panel.panY = 0;
}

/** Fills every panel of the current layout with the same photo. */
export function fillAllPanels(poster, photo) {
  for (let i = 0; i < slotCount(poster); i++) assignPhoto(poster, i, photo);
}

/** Finds a loaded photo by its sample name. */
export function findPhoto(photos, name) {
  return photos.find((p) => p.name === name) || null;
}
