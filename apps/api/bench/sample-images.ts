import * as fs from 'fs';
import * as path from 'path';

/**
 * The benchmark's fixed image set: four photos (see images/README.md for
 * their licences) and four drawn in code, so the set covers smooth
 * gradients, flat logo colours and pixel art as well as photos.
 */
export interface SampleImage {
  name: string;
  kind: 'photo' | 'gradient' | 'flat' | 'pixel-art';
  buffer: Buffer;
}

const PHOTOS = ['chelsea', 'coffee', 'astronaut', 'rocket'];

export function loadSampleImages(): SampleImage[] {
  const dir = path.join(__dirname, 'images');
  const photos: SampleImage[] = PHOTOS.map((name) => ({
    name,
    kind: 'photo',
    buffer: fs.readFileSync(path.join(dir, `${name}.jpg`)),
  }));
  return [...photos, ...drawnImages()];
}

function drawnImages(): SampleImage[] {
  const svg = (w: number, h: number, body: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

  const sky = svg(
    400,
    300,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#1b3f8f"/><stop offset="0.55" stop-color="#f08a4b"/><stop offset="1" stop-color="#fbe3a1"/>
     </linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>
     <circle cx="290" cy="190" r="38" fill="#fff2c4"/>`,
  );

  const skin = svg(
    400,
    300,
    `<defs><radialGradient id="r" cx="0.45" cy="0.4" r="0.7">
       <stop offset="0" stop-color="#f6d2b8"/><stop offset="0.6" stop-color="#d79b7a"/><stop offset="1" stop-color="#6b3f2c"/>
     </radialGradient></defs><rect width="400" height="300" fill="url(#r)"/>`,
  );

  const logo = svg(
    400,
    300,
    `<rect width="400" height="300" fill="#ffffff"/>
     <circle cx="120" cy="150" r="80" fill="#d7263d"/>
     <rect x="210" y="70" width="150" height="160" rx="24" fill="#1b998b"/>
     <polygon points="200,40 240,110 160,110" fill="#2e294e"/>
     <rect x="60" y="250" width="280" height="18" fill="#f46036"/>`,
  );

  // A 16x16 sprite drawn with hard edges, then scaled up 16x without
  // smoothing: what someone uploading pixel art would give the converter.
  const sprite = [
    '................',
    '.....KKKKKK.....',
    '...KKRRRRRRKK...',
    '..KRRRRRRRRRRK..',
    '..KRRWWRRWWRRK..',
    '.KRRRWKRRWKRRRK.',
    '.KRRRRRRRRRRRRK.',
    '.KRRRRRRRRRRRRK.',
    '.KRRYRRRRRRYRRK.',
    '.KRRRYYYYYYRRRK.',
    '..KRRRRRRRRRRK..',
    '..KRRRRRRRRRRK..',
    '...KKRRRRRRKK...',
    '.....KKKKKK.....',
    '......GGGG......',
    '.....GGGGGG.....',
  ];
  const colours: Record<string, string> = {
    '.': '#9fd8f5',
    K: '#1d1d1d',
    R: '#e2403a',
    W: '#ffffff',
    Y: '#ffd23f',
    G: '#3a9a4a',
  };
  const cells = sprite
    .flatMap((row, y) =>
      [...row].map(
        (c, x) => `<rect x="${x * 16}" y="${y * 16}" width="16" height="16" fill="${colours[c]}"/>`,
      ),
    )
    .join('');
  const pixel = svg(256, 256, `<g shape-rendering="crispEdges">${cells}</g>`);

  return [
    { name: 'sunset-gradient', kind: 'gradient', buffer: sky },
    { name: 'skin-gradient', kind: 'gradient', buffer: skin },
    { name: 'flat-logo', kind: 'flat', buffer: logo },
    { name: 'pixel-sprite', kind: 'pixel-art', buffer: pixel },
  ];
}
