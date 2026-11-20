// Neon Cover Studio: URL scenes for screenshots and deep links. A scene is a
// query string such as ?shot=cover&photo=pier&caption=Sunset%20Heist that sets
// the poster up before the first paint, so a screenshot shows a finished
// cover (shot=cover, chrome hidden) or the editor at work (shot=editor).
//
// Supported parameters:
//   shot      cover | editor (anything else: plain editor)
//   photo     sample name put in every panel (boulevard, pier, neon, palms)
//   photo1..4 sample name per panel (overrides photo for that panel)
//   layout    full | duo | triptych | mosaic | feature
//   grade     sunset | neon | palms | chrome
//   size      square | portrait | wide
//   caption   the title line
//   subtitle  the subtitle line
//   title     top | bottom (where the caption sits)

import { assignPhoto, findPhoto, slotCount } from './state.js';
import { POSTER_GRADES, POSTER_LAYOUTS, POSTER_SIZES } from './poster.js';

export function readSceneParams() {
  return new URLSearchParams(window.location.search);
}

/** Applies a scene's parameters to a poster; returns 'cover', 'editor' or ''. */
export function applyScene(poster, photos, params) {
  const shot = params.get('shot') || '';
  const layout = params.get('layout');
  if (layout && POSTER_LAYOUTS[layout]) poster.layout = layout;
  const grade = params.get('grade');
  if (grade && POSTER_GRADES[grade]) poster.grade = grade;
  const size = params.get('size');
  if (size && POSTER_SIZES[size]) poster.size = size;
  const caption = params.get('caption');
  if (caption !== null) poster.title = caption;
  const subtitle = params.get('subtitle');
  if (subtitle !== null) poster.subtitle = subtitle;
  const title = params.get('title');
  if (title === 'top') poster.titleAtTop = true;
  if (title === 'bottom') poster.titleAtTop = false;

  const base = params.get('photo');
  const basePhoto = base ? findPhoto(photos, base) : null;
  if (basePhoto) {
    for (let i = 0; i < slotCount(poster); i++) assignPhoto(poster, i, basePhoto);
  }
  for (let i = 0; i < slotCount(poster); i++) {
    const per = params.get(`photo${i + 1}`);
    if (per) {
      const photo = findPhoto(photos, per);
      if (photo) assignPhoto(poster, i, photo);
    }
  }
  return shot;
}
