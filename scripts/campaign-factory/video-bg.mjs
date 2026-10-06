// Fundo animado do vídeo por campanha: fundo desenhado (faixas, estrela, elementos 3D) com zoom lento
// + raios girando (screen) + partículas subindo e confete dourado caindo (screen). 12 s, sem áudio.
// Uso: node video-bg.mjs [slug...]  (rodar dentro de output/campanhas-magnific-2026-10-06)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CAMPAIGNS, LOOK, videoLayout } from './campaigns.mjs';
const exec = promisify(execFile);
const only = process.argv.slice(2), SECONDS = 12;

// Centro dos raios = centro do selo no layout de vídeo da campanha.
const center = ([x, y, w, h]) => ({ cx: Math.round(x + w / 2), cy: Math.round(y + h / 2) });

for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
  const dir = `work/${c.slug}`;
  const vl = videoLayout(LOOK[c.slug].layout);
  for (const f of [{ id: 'vertical', w: 1080, h: 1920, ...center(vl.vertical.seal) }, { id: 'horizontal', w: 1920, h: 1080, ...center(vl.horizontal.seal) }]) {
    const ov = `scale=${f.w}:${f.h}:force_original_aspect_ratio=increase,crop=${f.w}:${f.h},fps=30,format=gbrp`;
    const filter = [
      // Zoom lento de 4% ao longo do clipe dá vida ao fundo sem tirar o selo do lugar.
      `[0:v]scale=${f.w * 1.04}:${f.h * 1.04},zoompan=z='1+0.0001*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${f.w}x${f.h}:fps=30,format=gbrp[base]`,
      // Raios brancos girando centrados atrás do selo.
      `[1:v]format=gbrp,rotate=a='t*0.12':c=black:ow=2400:oh=2400,crop=${f.w}:${f.h}:${1200 - f.cx}:${1200 - f.cy},format=gbrp[rays]`,
      `[base][rays]blend=all_mode=screen[r1]`,
      `[2:v]${ov}[parts]`,
      `[r1][parts]blend=all_mode=screen[r2]`,
      `[3:v]${ov}[conf]`,
      `[r2][conf]blend=all_mode=screen,format=yuv420p[out]`
    ].join(';');
    await exec('ffmpeg', ['-v', 'error', '-y',
      '-loop', '1', '-i', `${dir}/video-design-${f.id}.png`,
      '-loop', '1', '-i', 'work/overlays/rays.png',
      '-stream_loop', '-1', '-i', 'video-raw/9031541.mp4',
      '-stream_loop', '-1', '-i', 'video-raw/3964557.mp4',
      '-filter_complex', filter, '-map', '[out]', '-t', String(SECONDS), '-an',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${dir}/video-bg-${f.id}.mp4`], { maxBuffer: 1 << 26 });
    console.log('fundo de vídeo', c.slug, f.id);
  }
}
