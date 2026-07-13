#!/usr/bin/env node
// reels-studio CLI — automatiza a produção dos Reels elucas.dev.
//
//   node cli.mjs new <slug> --formato lista|quiz|historia   cria content/<slug>.json
//   node cli.mjs list                                       lista reels e status
//   node cli.mjs validate <slug>                            checa limites de texto
//   node cli.mjs serve [--port 5173]                        servidor do player/preview
//   node cli.mjs render <slug> [--fps 30]                   renderiza out/<slug>.mp4
//   node cli.mjs render --all                               renderiza todos
//   node cli.mjs import <planilha.xlsx>                     aba "quizzes" -> content/*.json
//   node cli.mjs planilha                                   gera out/publicacao.xlsx (títulos/tags p/ upload manual)
//
// Música: coloque .mp3/.m4a em musica/ e o render embute a trilha no MP4
// (rotaciona entre as faixas; use --sem-musica para sair mudo).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cmd = args[0];

const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes('--' + name);

// ── servidor estático ────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

function listSlugs() {
  return fs.readdirSync(path.join(ROOT, 'content'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/reels') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(listSlugs()));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/player/player.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found: ' + p);
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

function serve(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

// ── validação (limites do guia da marca) ─────────────────────────────────────
function validate(slug, cfg) {
  const warns = [];
  const len = (s) => Math.max(...String(s || '').split('\n').map(l => l.length));
  const check = (label, value, max) => {
    if (value && len(value) > max) warns.push(`${label}: "${value}" tem ${len(value)} chars por linha (máx ~${max})`);
  };
  if (cfg.formato === 'lista') {
    check('hook1', cfg.hook1, 22);
    check('hook2', cfg.hook2, 22);
    if (!cfg.items || cfg.items.length < 3 || cfg.items.length > 7) warns.push(`items: ${cfg.items?.length ?? 0} itens (use de 3 a 7)`);
    for (const [i, it] of (cfg.items || []).entries()) {
      check(`items[${i}].badge`, it.badge, 12);
      check(`items[${i}].text`, it.text, 28);
    }
  } else if (cfg.formato === 'quiz') {
    check('question', cfg.question, 24);
    const n = cfg.options?.length ?? 0;
    if (n < 2 || n > 4) warns.push(`options: ${n} opções (use de 2 a 4)`);
    const corrects = (cfg.options || []).filter(o => o.correct).length;
    if (corrects !== 1) warns.push(`options: ${corrects} marcadas como corretas (deve ser exatamente 1)`);
    for (const [i, o] of (cfg.options || []).entries()) check(`options[${i}].text`, o.text, 18);
    check('reveal', cfg.reveal, 34);
  } else if (cfg.formato === 'historia') {
    check('hook.line1', cfg.hook?.line1, 16);
    check('hook.line2', cfg.hook?.line2, 16);
    check('hook.punch', cfg.hook?.punch, 30);
    const n = cfg.sections?.length ?? 0;
    if (n < 2 || n > 4) warns.push(`sections: ${n} seções (use de 2 a 4)`);
    for (const [i, s] of (cfg.sections || []).entries()) {
      check(`sections[${i}].title`, s.title, 24);
      check(`sections[${i}].body`, s.body, 38);
      check(`sections[${i}].punch`, s.punch, 30);
    }
    check('cta.title', cfg.cta?.title, 24);
  }
  return warns;
}

function loadCfg(slug) {
  const file = path.join(ROOT, 'content', slug + '.json');
  if (!fs.existsSync(file)) {
    console.error(`✗ content/${slug}.json não existe. Reels disponíveis: ${listSlugs().join(', ')}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── render (Chrome headless + ffmpeg) ────────────────────────────────────────
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
];

async function renderOne(slug, { fps = 30, port }) {
  const cfg = loadCfg(slug);
  const warns = validate(slug, cfg);
  for (const w of warns) console.warn('  ⚠ ' + w);

  const { default: puppeteer } = await import('puppeteer-core');
  const ffmpegPath = path.join(ROOT, 'tools', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpegPath)) { console.error('✗ tools/ffmpeg.exe não encontrado (veja README)'); process.exit(1); }
  const chrome = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!chrome) { console.error('✗ Chrome não encontrado'); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio'],
  });
  try {
    const page = await browser.newPage();
    // 1920 do canvas + 44 da barra de playback ⇒ Stage fica em escala 1:1
    await page.setViewport({ width: 1080, height: 1964, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/player/player.html?reel=${encodeURIComponent(slug)}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__REEL_READY === true || window.__REEL_ERROR', { timeout: 30000 });
    const err = await page.evaluate('window.__REEL_ERROR');
    if (err) throw new Error('Player falhou:\n' + err);

    const meta = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
      const r = svg.getBoundingClientRect();
      return {
        duration: parseFloat(svg.getAttribute('data-om-exportable-video-with-duration-secs')),
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });
    const totalFrames = Math.round(meta.duration * fps);
    console.log(`  ${slug}: ${meta.duration}s · ${fps}fps · ${totalFrames} frames · canvas ${meta.rect.width}x${meta.rect.height}`);

    const outFile = path.join(ROOT, 'out', slug + '.mp4');
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    const ff = spawn(ffmpegPath, [
      '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-movflags', '+faststart', outFile,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    const ffDone = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-2000)))));

    const clip = { x: meta.rect.x, y: meta.rect.y, width: 1080, height: 1920 };
    const started = Date.now();
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      await page.evaluate((time) => {
        const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
        svg.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', { detail: { time, sync: true } }));
      }, t);
      const png = await page.screenshot({ clip, type: 'png', optimizeForSpeed: true });
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${totalFrames} (${Math.round(i / totalFrames * 100)}%)`);
    }
    ff.stdin.end();
    await ffDone;

    // trilha sonora: embute uma faixa de musica/ (rotaciona pela ordem dos slugs)
    if (!hasFlag('sem-musica')) {
      const track = pickTrack(slug);
      if (track) {
        const tmp = outFile.replace(/\.mp4$/, '.tmp.mp4');
        await run(ffmpegPath, [
          '-y', '-i', outFile, '-stream_loop', '-1', '-i', track,
          '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
          '-c:a', 'aac', '-b:a', '128k',
          '-af', 'volume=0.9,afade=t=out:st=' + Math.max(0, meta.duration - 1.2) + ':d=1.2',
          '-t', String(meta.duration), '-movflags', '+faststart', tmp,
        ]);
        fs.renameSync(tmp, outFile);
      }
    }

    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
    console.log(`\r  ✓ out/${slug}.mp4 — ${mb} MB, renderizado em ${secs}s          `);
  } finally {
    await browser.close();
  }
}

function run(bin, argv) {
  return new Promise((res, rej) => {
    const p = spawn(bin, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => c === 0 ? res() : rej(new Error(bin + ' exit ' + c + '\n' + err.slice(-1500))));
  });
}

function listTracks() {
  const dir = path.join(ROOT, 'musica');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f)).sort().map(f => path.join(dir, f));
}

function pickTrack(slug) {
  const tracks = listTracks();
  if (!tracks.length) return null;
  const i = listSlugs().indexOf(slug);
  return tracks[(i >= 0 ? i : 0) % tracks.length];
}

// ── comandos ─────────────────────────────────────────────────────────────────
const SKELETONS = {
  lista: {
    formato: 'lista', tag: 'Tema',
    hook1: 'Gancho linha 1', hook2: 'linha 2 (vermelha)', hookSub: 'salva pra não esquecer ↓',
    items: [
      { badge: 'Ctrl + ?', text: 'O que esse item faz' },
      { badge: '', text: 'badge vazio vira número' },
      { badge: 'F2', text: 'De 3 a 7 itens' },
    ],
    ctaTitle: 'Pergunta de fechamento?', ctaSub: 'Comenta aí e salva o post.',
    handleSub: 'tech · produtividade · IA', grid: 'cells',
  },
  quiz: {
    formato: 'quiz', tag: 'Quiz', hook1: 'VOCÊ SABIA?', hookSub: 'Teste rápido',
    question: 'Pergunta em até\ntrês linhas\nde ~24 chars?',
    options: [
      { text: 'Opção A', correct: false },
      { text: 'Opção B', correct: true },
      { text: 'Opção C', correct: false },
    ],
    reveal: 'Explicação curta da resposta.',
    ctaTitle: 'Acertou? Comenta aí.', handleSub: 'tech · produtividade · IA',
  },
  historia: {
    formato: 'historia', tag: 'Case',
    hook: { line1: 'Linha um', line2: 'linha dois.', punch: 'Punch em vermelho.' },
    sections: [
      { eyebrow: '// O problema', title: 'Título da seção\nem até 3 linhas.', body: 'linha de apoio.', punch: 'Punch da seção.' },
      { eyebrow: '// Resultado', widget: { type: 'stats', rows: [['Nº', 'descrição'], ['Nº', 'descrição']] } },
    ],
    cta: { top: 'linha mono em cima', title: 'fechamento forte\nem duas linhas.' },
    handleSub: 'tech · produtividade · IA',
  },
};

async function main() {
  if (cmd === 'list') {
    for (const slug of listSlugs()) {
      const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', slug + '.json'), 'utf8'));
      const rendered = fs.existsSync(path.join(ROOT, 'out', slug + '.mp4')) ? '✓ mp4' : '—';
      const warns = validate(slug, cfg).length;
      console.log(`  ${slug.padEnd(24)} ${String(cfg.formato).padEnd(9)} ${rendered}${warns ? `  ⚠ ${warns} aviso(s)` : ''}`);
    }
  } else if (cmd === 'new') {
    const slug = args[1];
    const formato = flag('formato', 'lista');
    if (!slug || !SKELETONS[formato]) {
      console.error('uso: node cli.mjs new <slug> --formato lista|quiz|historia');
      process.exit(1);
    }
    const file = path.join(ROOT, 'content', slug + '.json');
    if (fs.existsSync(file)) { console.error(`✗ ${file} já existe`); process.exit(1); }
    fs.writeFileSync(file, JSON.stringify(SKELETONS[formato], null, 2) + '\n');
    console.log(`✓ content/${slug}.json criado (formato ${formato}). Edite e rode:\n  node cli.mjs render ${slug}`);
  } else if (cmd === 'validate') {
    const slug = args[1];
    const warns = validate(slug, loadCfg(slug));
    if (!warns.length) console.log(`✓ ${slug}: dentro dos limites`);
    else { for (const w of warns) console.warn('  ⚠ ' + w); process.exitCode = 1; }
  } else if (cmd === 'import') {
    // Planilha (aba "quizzes") -> content/*.json. Colunas: slug, tag, hook1, hookSub,
    // question (linhas separadas por " | "), optionA..C, correta, reveal, fonte,
    // dificuldade, dia, hora, yt_titulo, yt_descricao, yt_tags.
    const file = args[1];
    if (!file || !fs.existsSync(file)) { console.error('uso: node cli.mjs import <planilha.xlsx|csv>'); process.exit(1); }
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets['quizzes'] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    let ok = 0, bad = 0;
    for (const r of rows) {
      const slug = String(r.slug || '').trim();
      if (!slug) continue;
      const options = ['A', 'B', 'C']
        .filter(L => String(r['option' + L]).trim())
        .map(L => ({ text: String(r['option' + L]).trim(), correct: String(r.correta).trim().toUpperCase() === L }));
      const cfg = {
        formato: 'quiz',
        tag: String(r.tag || 'Quiz').trim(),
        hook1: String(r.hook1 || 'VOCÊ SABIA?').trim(),
        hookSub: String(r.hookSub || '').trim(),
        question: String(r.question).split('|').map(s => s.trim()).join('\n'),
        options,
        reveal: String(r.reveal || '').trim(),
        ctaTitle: 'Acertou? Comenta aí.',
        handleSub: 'tech · produtividade · IA',
        fonte: String(r.fonte || '').trim(),
        dificuldade: String(r.dificuldade || '').trim(),
        agenda: { dia: +r.dia || null, hora: r.hora === '' ? null : +r.hora },
        yt: { titulo: String(r.yt_titulo || '').trim(), descricao: String(r.yt_descricao || '').trim(), tags: String(r.yt_tags || '').trim() },
      };
      const warns = validate(slug, cfg);
      if (warns.length) { bad++; console.warn(`⚠ ${slug}:`); for (const w of warns) console.warn('    ' + w); }
      else ok++;
      fs.writeFileSync(path.join(ROOT, 'content', slug + '.json'), JSON.stringify(cfg, null, 2) + '\n');
    }
    console.log(`✓ importados ${ok + bad} quizzes (${ok} ok, ${bad} com avisos — revise antes de renderizar)`);
  } else if (cmd === 'musica') {
    // Embute trilha nos MP4s já renderizados (sem re-renderizar): out/ -> out-com-musica/.
    // Faixas em musica/ (rotaciona). Uso: node cli.mjs musica <slug> | --all
    const ffmpegPath = path.join(ROOT, 'tools', 'ffmpeg.exe');
    const tracks = listTracks();
    if (!tracks.length) { console.error('✗ pasta musica/ vazia — baixe faixas da YouTube Audio Library e coloque lá'); process.exit(1); }
    const slugs = (hasFlag('all') ? listSlugs() : [args[1]]).filter(s => s && fs.existsSync(path.join(ROOT, 'out', s + '.mp4')));
    if (!slugs.length) { console.error('uso: node cli.mjs musica <slug> | --all (renderize antes)'); process.exit(1); }
    fs.mkdirSync(path.join(ROOT, 'out-com-musica'), { recursive: true });
    for (const [i, slug] of slugs.entries()) {
      const src = path.join(ROOT, 'out', slug + '.mp4');
      const dst = path.join(ROOT, 'out-com-musica', slug + '.mp4');
      const track = tracks[i % tracks.length];
      const dur = await new Promise((res) => {
        const p = spawn(ffmpegPath, ['-i', src]);
        let e = ''; p.stderr.on('data', d => e += d);
        p.on('close', () => {
          const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e);
          res(m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 15);
        });
      });
      await run(ffmpegPath, [
        '-y', '-i', src, '-stream_loop', '-1', '-i', track,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k',
        '-af', `volume=0.9,afade=t=out:st=${Math.max(0, dur - 1.2)}:d=1.2`,
        '-t', String(dur), '-movflags', '+faststart', dst,
      ]);
      console.log(`  ✓ out-com-musica/${slug}.mp4 ← ${path.basename(track)}`);
    }
  } else if (cmd === 'planilha') {
    // Gera out/publicacao.xlsx com os metadados de upload manual, ordenado por dia/hora.
    const XLSX = (await import('xlsx')).default;
    const rows = [];
    for (const slug of listSlugs()) {
      const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', slug + '.json'), 'utf8'));
      if (cfg.formato !== 'quiz' || !cfg.yt) continue;
      rows.push({
        dia: cfg.agenda?.dia ?? '', hora: cfg.agenda?.hora ?? '',
        arquivo: 'out\\' + slug + '.mp4',
        mp4_pronto: fs.existsSync(path.join(ROOT, 'out', slug + '.mp4')) ? 'sim' : 'NÃO',
        titulo: cfg.yt.titulo, descricao: cfg.yt.descricao, tags: cfg.yt.tags,
        pergunta: cfg.question.replace(/\n/g, ' '),
        resposta: (cfg.options.find(o => o.correct) || {}).text || '',
        fonte: cfg.fonte || '',
        publicado: '',
      });
    }
    rows.sort((a, b) => (a.dia - b.dia) || (a.hora - b.hora));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 5 }, { wch: 34 }, { wch: 10 }, { wch: 70 }, { wch: 90 }, { wch: 60 }, { wch: 50 }, { wch: 16 }, { wch: 40 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'publicacao');
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    XLSX.writeFile(wb, path.join(ROOT, 'out', 'publicacao.xlsx'));
    console.log(`✓ out/publicacao.xlsx — ${rows.length} vídeos, ordenado por dia/hora`);
  } else if (cmd === 'serve') {
    const port = +flag('port', 5173);
    await serve(port);
    console.log(`reels-studio no ar: http://127.0.0.1:${port}/  (player: /player/player.html?reel=<slug>)`);
  } else if (cmd === 'render') {
    const fps = +flag('fps', 30);
    const slugs = hasFlag('all') ? listSlugs() : [args[1]];
    if (!slugs[0]) { console.error('uso: node cli.mjs render <slug> | --all'); process.exit(1); }
    const srv = await serve(0);
    const port = srv.address().port;
    try {
      for (const slug of slugs) await renderOne(slug, { fps, port });
    } finally {
      srv.close();
    }
  } else {
    console.log('comandos: new · list · validate · serve · render  (veja o topo de cli.mjs)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
