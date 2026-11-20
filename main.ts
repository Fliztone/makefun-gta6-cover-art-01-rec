// Vice Cover studio — gta6-cover-art-01 entry point (Node 22, standard library only).
// The app is app/: plain static files a desktop browser loads offline (index.html
// and its ES modules, shipped OFL fonts, no library, no network request). This
// program hands it in: it copies app/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json with the vendored make.fun library.
// Deterministic: pure file copies plus canonical JSON — no clock, no randomness,
// no network, so two runs write byte-identical output.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const indexHtml = join(here, 'app', 'index.html');
if (!existsSync(indexHtml)) throw new Error('app/index.html is missing');
if (statSync(indexHtml).size > 1048576) throw new Error('app/index.html is over 1 MiB');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps, passed to buildDossier so this program refuses where the
// scorer would: at most 4 screenshots of 256 KiB, at most 993 app entries and
// 48 MiB of app files, paths of at most 1000 UTF-8 bytes.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Screenshot pixel caps the dossier library does not check: long side <= 1280,
// short side >= 480. Read them from the PNG/JPEG headers themselves.
function imageDims(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let p = 2;
    while (p + 9 < b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      const marker = b[p + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: b.readUInt16BE(p + 7), h: b.readUInt16BE(p + 5) };
      }
      p += 2 + b.readUInt16BE(p + 2);
    }
  }
  throw new Error(`not a PNG or JPEG: ${file}`);
}

const shotsDir = join(out, 'screenshots');
const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) throw new Error(`screenshots: need 3-4 images, found ${shots.length}`);
for (const name of shots) {
  const { w, h } = imageDims(join(shotsDir, name));
  if (Math.max(w, h) > 1280 || Math.min(w, h) < 480) {
    throw new Error(`screenshot ${name}: ${w}x${h} outside caps (long side <= 1280, short side >= 480)`);
  }
}

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Vice Cover handed in: app/ + ${shots.length} screenshots + dossier.json (${dossier.length} bytes) -> ${out}`);