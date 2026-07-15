#!/usr/bin/env node
// reels-studio CLI — automatiza a produção dos Reels elucas.dev.
//
// Cada projeto vive em projects/<slug>/ (project.json + assets/ + render/).
//
//   node cli.mjs new <slug> --formato lista|quiz|historia|tutorial   cria projects/<slug>/project.json
//   node cli.mjs list                                       lista reels e status
//   node cli.mjs validate <slug>                            checa limites de texto
//   node cli.mjs serve [--port 5173]                        servidor do player/preview/Studio
//   node cli.mjs render <slug> [--fps 30]                   renderiza projects/<slug>/render/video.mp4
//   node cli.mjs render --all                               renderiza todos
//   node cli.mjs export <slug>                              empacota o projeto num <slug>.rvs (zip)
//   node cli.mjs import <arquivo.rvs>                       importa um .rvs para projects/<slug>/
//   node cli.mjs import <planilha.xlsx>                     abas quizzes/listas/historias -> vários projetos
//   node cli.mjs migrate [--dry-run]                        move content/+pastas antigas p/ projects/
//   node cli.mjs planilha                                   gera out/publicacao.xlsx (títulos/tags p/ upload manual)
//   node cli.mjs audio <slug>                                limpa a narração crua -> assets/narracao/limpo/
//   node cli.mjs tts <slug> [--scene <id>] [--text ...]      gera narração por TTS (ElevenLabs/OpenAI; chave em env)
//
// Música: coloque .mp3/.m4a em musica/ e o render embute a trilha no MP4
// (rotaciona entre as faixas; use --sem-musica para sair mudo).
//
// Tutorial (vídeos longos): grave a narração em narracao/raw/<slug>.wav,
// rode `audio <slug>` para limpar e medir a duração, depois `render <slug>`
// — o áudio limpo entra sincronizado com a intro (veja formato tutorial).
// narracao/raw/<slug>.* também aceita um vídeo (mp4/mov/webm) com áudio
// embutido — ex.: a própria gravação de câmera — e usa só a trilha de áudio.
//
// Câmera (opcional): defina cfg.camera = { src, position, size, trimStart }
// no JSON para sobrepor uma bolha (PiP) da webcam durante o vídeo.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cmd = args[0];

// ── estrutura por projeto ────────────────────────────────────────────────────
// Cada projeto vive numa pasta única projects/<slug>/ com project.json + assets/
// + render/. Os caminhos gravados no JSON são RELATIVOS ao projeto (ex.:
// "assets/gravacoes/foo.mp4"), então project.json é auto-contido e portátil (.rvs).
const PROJECTS = path.join(ROOT, 'projects');
const projectDir = (slug) => path.join(PROJECTS, slug);
const projectJson = (slug) => path.join(projectDir(slug), 'project.json');
const renderDir = (slug) => path.join(projectDir(slug), 'render');
// subpasta (project-relative, POSIX) por tipo de asset.
const ASSET_SUBDIR = {
  gravacao: 'assets/gravacoes',
  print: 'assets/prints',
  narracao: 'assets/narracao/raw',
  audioCena: 'assets/narracao/cenas',
  limpo: 'assets/narracao/limpo',
};
const assetDir = (slug, kind) => path.join(projectDir(slug), ...ASSET_SUBDIR[kind].split('/'));
const relAsset = (kind, filename) => ASSET_SUBDIR[kind] + '/' + filename; // grava no JSON
const projPath = (slug, rel) => path.join(projectDir(slug), rel);          // resolve p/ disco

// Temas e templates de cena são arquivos YAML autorais (mais fáceis de escrever
// à mão). O YAML é parseado SÓ aqui no Node — o navegador sempre recebe JSON via
// rota. readYaml devolve null (com aviso) se o arquivo estiver inválido, sem
// derrubar o servidor.
const THEMES = path.join(ROOT, 'themes');
const SCENE_TEMPLATES = path.join(ROOT, 'templates', 'scenes');
const QUIZ_TEMPLATES = path.join(ROOT, 'templates', 'quiz');
function readYaml(file) {
  try { return yamlLoad(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.warn(`  ⚠ YAML inválido em ${path.relative(ROOT, file)}: ${String(e.message || e).split('\n')[0]}`); return null; }
}

// Lista os temas instalados (pastas em themes/ com theme.yaml).
function listThemes() {
  if (!fs.existsSync(THEMES)) return [];
  return fs.readdirSync(THEMES, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(THEMES, d.name, 'theme.yaml')))
    .map(d => {
      const t = readYaml(path.join(THEMES, d.name, 'theme.yaml')) || {};
      const hasPreview = fs.existsSync(path.join(THEMES, d.name, 'preview.png'));
      return { id: d.name, name: t.name || d.name, preview: hasPreview ? `/themes/${d.name}/preview.png` : null };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Resolve um tema para JSON (theme.yaml + fontFaces com src virando URL do tema).
function loadTheme(id) {
  const file = path.join(THEMES, id, 'theme.yaml');
  if (!fs.existsSync(file)) return null;
  const t = readYaml(file);
  if (!t) return null;
  t.id = id;
  (t.fontFaces || []).forEach(ff => { if (ff.src && !ff.src.startsWith('/')) ff.src = `/themes/${id}/${ff.src}`; });
  return t;
}

// Lista os manifests de template de cena (templates/scenes/<id>/manifest.yaml),
// resolvendo o thumb (svg inline do arquivo, se houver) para o Studio.
function listSceneTemplates() {
  if (!fs.existsSync(SCENE_TEMPLATES)) return [];
  return fs.readdirSync(SCENE_TEMPLATES, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(SCENE_TEMPLATES, d.name, 'manifest.yaml')))
    .map(d => {
      const man = readYaml(path.join(SCENE_TEMPLATES, d.name, 'manifest.yaml'));
      if (!man) return null;
      man.id = man.id || d.name;
      const thumbFile = path.join(SCENE_TEMPLATES, d.name, man.thumb || 'thumb.svg');
      if (fs.existsSync(thumbFile)) man.thumbSvg = fs.readFileSync(thumbFile, 'utf8');
      return man;
    })
    .filter(Boolean);
}

// Lista os templates de quiz file-driven (templates/quiz/*/manifest.yaml). Cada
// manifesto traz um `layout` temporal interpretado por engine/quiz-renderer.jsx.
// Espelha listSceneTemplates().
function listQuizTemplates() {
  if (!fs.existsSync(QUIZ_TEMPLATES)) return [];
  return fs.readdirSync(QUIZ_TEMPLATES, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(QUIZ_TEMPLATES, d.name, 'manifest.yaml')))
    .map(d => {
      const man = readYaml(path.join(QUIZ_TEMPLATES, d.name, 'manifest.yaml'));
      if (!man) return null;
      man.id = man.id || d.name;
      const thumbFile = path.join(QUIZ_TEMPLATES, d.name, man.thumb || 'thumb.svg');
      if (fs.existsSync(thumbFile)) man.thumbSvg = fs.readFileSync(thumbFile, 'utf8');
      return man;
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

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
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.woff2': 'font/woff2',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
};

function listSlugs() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs.readdirSync(PROJECTS, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(PROJECTS, d.name, 'project.json')))
    .map(d => d.name)
    .sort();
}

// slug simples (sem barras/traversal) usado nas rotas /api/*. Aceita letras
// Unicode (há projetos com acento no nome, ex.: quiz-história-tech-614) — só
// letras/dígitos/hífen, então nada de barra, ponto ou espaço (seguro p/ path).
const SLUG_RE = /^[\p{L}0-9][\p{L}0-9-]*$/u;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// extensões aceitas por tipo de asset (a pasta vem de assetDir(slug,kind)).
const ASSET_KINDS = {
  gravacao: { dir: (slug) => assetDir(slug, 'gravacao'), ext: /\.(mp4|mov|webm)$/i },
  print: { dir: (slug) => assetDir(slug, 'print'), ext: /\.(png|jpg|jpeg|webp)$/i },
  // aceita áudio puro ou um vídeo com áudio embutido (ex.: a própria gravação de câmera).
  narracao: { dir: (slug) => assetDir(slug, 'narracao'), ext: /\.(wav|mp3|m4a|aac|ogg|mp4|mov|webm)$/i },
  // takes de narração por cena (nomeados pelo scene.id, nunca por índice — reordenar não órfã áudio).
  audioCena: { dir: (slug) => assetDir(slug, 'audioCena'), ext: /\.(wav|mp3|m4a|aac|ogg|webm)$/i },
};

function listAssets(slug) {
  const rel = (abs) => path.relative(projectDir(slug), abs).replace(/\\/g, '/');
  const listDir = (dir, extRe) => fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => extRe.test(f)).sort().map(f => rel(path.join(dir, f)))
    : [];
  const raw = findRawNarracao(slug);
  const limpo = path.join(assetDir(slug, 'limpo'), slug + '.m4a');
  return {
    gravacoes: listDir(ASSET_KINDS.gravacao.dir(slug), ASSET_KINDS.gravacao.ext),
    prints: listDir(ASSET_KINDS.print.dir(slug), ASSET_KINDS.print.ext),
    audioCenas: listDir(ASSET_KINDS.audioCena.dir(slug), ASSET_KINDS.audioCena.ext),
    narracaoRaw: raw ? rel(raw) : null,
    narracaoLimpo: fs.existsSync(limpo) ? rel(limpo) : null,
  };
}

// progresso de renders disparados pelo Studio (POST /api/render/:slug), em memória.
const renderStatus = new Map();

// Rotas do Studio (UI local de montagem de tutoriais). Tudo sob /api/*;
// qualquer outro caminho cai no handler estático abaixo.
async function handleApi(req, res, url) {
  const m = (re) => { const r = re.exec(url.pathname); return r; };

  if (url.pathname === '/api/reels') {
    return sendJson(res, 200, listSlugs());
  }

  // temas: lista (id/name/preview). O tema resolvido /api/theme/:id fica após `let r`.
  if (url.pathname === '/api/themes') {
    return sendJson(res, 200, listThemes());
  }
  // catálogo de cenas: todos os manifests (manifest.yaml -> JSON) para a galeria/inspector.
  if (url.pathname === '/api/scene-templates') {
    return sendJson(res, 200, listSceneTemplates());
  }
  // catálogo de layouts de quiz (por canal): manifests com layout temporal declarativo.
  if (url.pathname === '/api/quiz-templates') {
    return sendJson(res, 200, listQuizTemplates());
  }

  // lista todos os projetos com formato + status de render (o Studio filtra na UI).
  // rendered = existe render/video.mp4; stale = project.json mudou depois do mp4
  // (precisa re-renderizar). Usado pela tela de render em lote.
  if (url.pathname === '/api/projects') {
    const items = listSlugs().map((slug) => {
      let formato = '?', rendered = false, stale = false;
      try {
        const jf = projectJson(slug);
        formato = JSON.parse(fs.readFileSync(jf, 'utf8')).formato || '?';
        const mp4 = path.join(renderDir(slug), 'video.mp4');
        if (fs.existsSync(mp4)) {
          rendered = true;
          try { stale = fs.statSync(jf).mtimeMs > fs.statSync(mp4).mtimeMs; } catch {}
        }
      } catch {}
      return { slug, formato, rendered, stale };
    });
    return sendJson(res, 200, items);
  }

  // lista só os slugs tutorial. Usado pelo ping() do sync (detecção de conexão);
  // a lista completa multi-formato vem de /api/projects.
  if (url.pathname === '/api/tutorials') {
    const slugs = listSlugs().filter((slug) => {
      try { return JSON.parse(fs.readFileSync(projectJson(slug), 'utf8')).formato === 'tutorial'; }
      catch { return false; }
    });
    return sendJson(res, 200, slugs);
  }

  let r;
  if ((r = m(/^\/api\/theme\/([a-z0-9-]+)$/i))) {
    const t = loadTheme(r[1]);
    return t ? sendJson(res, 200, t) : sendJson(res, 404, { error: 'tema não encontrado' });
  }
  if ((r = m(/^\/api\/skeleton\/([a-z]+)$/))) {
    const skeleton = SKELETONS[r[1]];
    return skeleton ? sendJson(res, 200, skeleton) : sendJson(res, 404, { error: 'formato desconhecido' });
  }

  if ((r = m(/^\/api\/tutorial\/([^/]+)$/i))) {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    const file = projectJson(slug);
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'não encontrado' });
      return sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    if (req.method === 'POST') {
      let cfg;
      try { cfg = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return sendJson(res, 400, { error: 'JSON inválido' }); }
      const warns = validate(slug, cfg);
      fs.mkdirSync(projectDir(slug), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
      return sendJson(res, 200, { ok: true, warns });
    }
  }

  // exclui um projeto inteiro (projects/<slug>/). Usado pelo botão do Studio.
  if ((r = m(/^\/api\/project\/([^/]+)$/i)) && req.method === 'DELETE') {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    const dir = projectDir(slug);
    if (path.relative(PROJECTS, dir).startsWith('..')) return sendJson(res, 400, { error: 'caminho inválido' });
    if (!fs.existsSync(dir)) return sendJson(res, 404, { error: 'não encontrado' });
    fs.rmSync(dir, { recursive: true, force: true });
    return sendJson(res, 200, { ok: true });
  }

  if ((r = m(/^\/api\/assets\/([^/]+)$/i)) && req.method === 'GET') {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    return sendJson(res, 200, listAssets(slug));
  }

  if ((r = m(/^\/api\/assets\/([^/]+)\/(gravacao|print|narracao|audioCena)\/([^/]+)$/i)) && req.method === 'PUT') {
    const slug = decodeURIComponent(r[1]), kind = r[2], filenameRaw = r[3];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    const filename = path.basename(decodeURIComponent(filenameRaw));
    const spec = ASSET_KINDS[kind];
    if (!spec.ext.test(filename)) return sendJson(res, 400, { error: `extensão não aceita para ${kind}` });
    const dir = spec.dir(slug);
    fs.mkdirSync(dir, { recursive: true });
    // narracao: um arquivo cru por slug — normaliza o nome para <slug>.<ext>, sobrescrevendo o anterior.
    const finalName = kind === 'narracao' ? slug + path.extname(filename).toLowerCase() : filename;
    const body = await readBody(req);
    fs.writeFileSync(path.join(dir, finalName), body);
    return sendJson(res, 200, { ok: true, path: relAsset(kind, finalName) });
  }

  if ((r = m(/^\/api\/audio\/([^/]+)$/i)) && req.method === 'POST') {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    try {
      const narracao = await cleanNarration(slug);
      return sendJson(res, 200, { ok: true, ...narracao });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // importa a planilha de quizzes (corpo = bytes do .xlsx/.csv) — cria vários projetos.
  if (url.pathname === '/api/import-planilha' && req.method === 'POST') {
    try {
      const { total, ok, bad, slugs } = await importPlanilha(await readBody(req));
      return sendJson(res, 200, { ok: true, total, okCount: ok, warns: bad, slugs });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // importa um .rvs (corpo = bytes do zip) para projects/<slug>/. ?slug=<slug>&overwrite=1
  if (url.pathname === '/api/import' && req.method === 'POST') {
    const slug = url.searchParams.get('slug');
    if (!slug || !SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    if (fs.existsSync(projectDir(slug)) && url.searchParams.get('overwrite') !== '1') {
      return sendJson(res, 409, { error: `projects/${slug}/ já existe` });
    }
    try {
      const entries = zipRead(await readBody(req));
      for (const e of entries) {
        const to = path.join(projectDir(slug), e.name);
        if (!to.startsWith(projectDir(slug))) continue; // anti-traversal
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, e.data);
      }
      const cfg = JSON.parse(fs.readFileSync(projectJson(slug), 'utf8'));
      return sendJson(res, 200, { ok: true, slug, formato: cfg.formato || '?' });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // importa um .rvtheme -> themes/<id>/  ou  .rvtemplate -> templates/scenes/<id>/.
  if ((url.pathname === '/api/import-theme' || url.pathname === '/api/import-template') && req.method === 'POST') {
    const isTheme = url.pathname === '/api/import-theme';
    const id = url.searchParams.get('id');
    if (!id || !SLUG_RE.test(id)) return sendJson(res, 400, { error: 'id inválido' });
    const destBase = isTheme ? path.join(THEMES, id) : path.join(SCENE_TEMPLATES, id);
    if (fs.existsSync(destBase) && url.searchParams.get('overwrite') !== '1') {
      return sendJson(res, 409, { error: `${isTheme ? 'themes' : 'templates/scenes'}/${id}/ já existe` });
    }
    try {
      for (const e of zipRead(await readBody(req))) {
        const to = path.join(destBase, e.name);
        if (!to.startsWith(destBase)) continue; // anti-traversal
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, e.data);
      }
      return sendJson(res, 200, { ok: true, id });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // limpa o take de UMA cena (gravado pelo Studio) e devolve {src, duracaoSegundos}.
  if ((r = m(/^\/api\/audio-cena\/([^/]+)\/([a-z0-9-]+)$/i)) && req.method === 'POST') {
    const slug = decodeURIComponent(r[1]), sceneId = r[2];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    try {
      const audio = await cleanSceneAudio(slug, sceneId, { trim: url.searchParams.get('trim') !== '0' });
      return sendJson(res, 200, { ok: true, ...audio });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // TTS: gera narração por texto (body: { text, provider?, voice?, model? }).
  if ((r = m(/^\/api\/tts\/([^/]+)$/i)) && req.method === 'POST') {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    try {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const narracao = await ttsToNarration(slug, b.text || '', { provider: b.provider, voice: b.voice, model: b.model });
      return sendJson(res, 200, { ok: true, ...narracao });
    } catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }
  if ((r = m(/^\/api\/tts-cena\/([^/]+)\/([a-z0-9-]+)$/i)) && req.method === 'POST') {
    const slug = decodeURIComponent(r[1]), sceneId = r[2];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    try {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const audio = await ttsToSceneAudio(slug, sceneId, b.text || '', { provider: b.provider, voice: b.voice, model: b.model });
      return sendJson(res, 200, { ok: true, ...audio });
    } catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }
  // lista as vozes de um provedor (ElevenLabs precisa da env; OpenAI é fixo).
  if (url.pathname === '/api/voices' && req.method === 'GET') {
    try { return sendJson(res, 200, await listVoices(url.searchParams.get('provider') || 'elevenlabs')); }
    catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }

  if ((r = m(/^\/api\/render\/([^/]+)\/status$/i)) && req.method === 'GET') {
    return sendJson(res, 200, renderStatus.get(decodeURIComponent(r[1])) || { state: 'idle' });
  }

  if ((r = m(/^\/api\/render\/([^/]+)$/i)) && req.method === 'POST') {
    const slug = decodeURIComponent(r[1]);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: 'slug inválido' });
    const current = renderStatus.get(slug);
    if (current && current.state === 'running') return sendJson(res, 409, { error: 'já renderizando' });
    renderStatus.set(slug, { state: 'running', frame: 0, total: 0 });
    const port = req.socket.localPort;
    renderOne(slug, {
      port,
      secure: !!req.socket.encrypted, // o serve do Studio pode ser HTTPS (mkcert)
      onProgress: ({ frame, total }) => renderStatus.set(slug, { state: 'running', frame, total }),
    })
      .then(() => renderStatus.set(slug, { state: 'done', frame: 1, total: 1 }))
      .catch((e) => renderStatus.set(slug, { state: 'error', error: String(e.message || e) }));
    return sendJson(res, 202, { ok: true });
  }

  return sendJson(res, 404, { error: 'rota desconhecida' });
}

function requestHandler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => sendJson(res, 500, { error: String(e.message || e) }));
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/player/player.html';
  else if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found: ' + p);
    return;
  }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  // Range requests: o <video> do Chrome exige isso pra reportar um range
  // "seekable" além do byte 0 — sem isso, seek em vídeo trava sempre em t=0
  // (fundamental pro formato tutorial, que faz seek frame-a-frame no export).
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'content-type': type, 'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
  fs.createReadStream(file).pipe(res);
}

function createServer() {
  return http.createServer(requestHandler);
}

// certs/cert.pem + certs/key.pem (gerados uma vez com mkcert, gitignored):
// se existirem, `serve` sobe em HTTPS e escuta em todas as interfaces (não só
// 127.0.0.1) — é o que permite o celular acessar o Studio pela rede local pra
// sincronizar/instalar o PWA. Sem certs, comportamento de sempre: HTTP só em localhost.
function httpsOptions() {
  const certFile = path.join(ROOT, 'certs', 'cert.pem');
  const keyFile = path.join(ROOT, 'certs', 'key.pem');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) return null;
  return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
}

function serve(port, { network = false } = {}) {
  return new Promise((resolve) => {
    const tls = network ? httpsOptions() : null;
    const srv = tls ? https.createServer(tls, requestHandler) : createServer();
    srv.listen(port, tls ? undefined : '127.0.0.1', () => resolve(srv));
  });
}

// IP da LAN pra mostrar a URL que o celular deve acessar (/studio/).
function lanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return null;
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
    // canal: template de layout file-driven (opcional). Sem template = layout inline.
    if (cfg.template) {
      const ids = listQuizTemplates().map(t => t.id);
      if (ids.length && !ids.includes(cfg.template)) warns.push(`template: "${cfg.template}" não existe (disponíveis: ${ids.join(', ') || 'nenhum'})`);
    }
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
  } else if (cfg.formato === 'tutorial') {
    const n = cfg.scenes?.length ?? 0;
    if (n < 1) warns.push('scenes: 0 cenas (use pelo menos 1)');
    const bodyDur = cfg.narracao?.duracaoSegundos || 0;
    // Tipos/layouts embutidos (molduras JSX) + os file-driven (templates/scenes/
    // */manifest.yaml). Um template declarativo novo passa a valer sem tocar aqui.
    const catalog = listSceneTemplates();
    const SCENE_TYPES = [...new Set(['video', 'image', 'passo', 'codigo', 'camera-intro', ...catalog.map(c => c.scene?.type).filter(Boolean)])];
    const SCENE_LAYOUTS = [...new Set(['desktop', 'celular', 'callout', 'raw', ...catalog.map(c => c.scene?.layout).filter(Boolean)])];
    const hasSceneAudio = (cfg.scenes || []).some(s => s.audio?.src);
    for (const [i, s] of (cfg.scenes || []).entries()) {
      if (!s.type || !SCENE_TYPES.includes(s.type)) warns.push(`scenes[${i}].type: "${s.type}" inválido (tipos: ${SCENE_TYPES.join(', ')})`);
      if (['video', 'image'].includes(s.type) && !s.src) warns.push(`scenes[${i}].src: obrigatório para type=${s.type}`);
      if (s.layout && !SCENE_LAYOUTS.includes(s.layout)) warns.push(`scenes[${i}].layout: "${s.layout}" inválido (layouts: ${SCENE_LAYOUTS.join(', ')})`);
      if (s.audio && !s.audio.src) warns.push(`scenes[${i}].audio.src: obrigatório quando "audio" está presente`);
      if (s.camera && !s.camera.src) warns.push(`scenes[${i}].camera.src: obrigatório quando "camera" está presente`);
      const start = +s.start || 0, end = +s.end || 0;
      if (end <= start) warns.push(`scenes[${i}]: end (${end}) deve ser maior que start (${start})`);
      if (bodyDur && end > bodyDur) warns.push(`scenes[${i}].end (${end}) ultrapassa a duração da narração (${bodyDur}s)`);
      check(`scenes[${i}].caption`, s.caption, 60);
    }
    if (hasSceneAudio) {
      // narração por cena: a duração do corpo é a soma das cenas (end da última).
      const lastEnd = Math.max(0, ...(cfg.scenes || []).map(s => +s.end || 0));
      if (bodyDur && Math.abs(bodyDur - lastEnd) > 0.05) {
        warns.push(`narracao.duracaoSegundos (${bodyDur}) difere do fim da última cena (${lastEnd}) — com áudio por cena, a soma das cenas manda`);
      }
    } else if (!bodyDur) {
      warns.push('narracao.duracaoSegundos: ausente — rode `node cli.mjs audio <slug>` ou informe manualmente');
    }
    if (cfg.outro?.media) {
      const md = cfg.outro.media;
      if (!['celular', 'desktop', 'ambos'].includes(md.tipo)) warns.push(`outro.media.tipo: "${md.tipo}" inválido (use celular, desktop ou ambos)`);
      if (md.tipo !== 'desktop' && !md.srcCelular) warns.push('outro.media.srcCelular: obrigatório para tipo celular/ambos');
      if (md.tipo !== 'celular' && !md.srcDesktop) warns.push('outro.media.srcDesktop: obrigatório para tipo desktop/ambos');
    }
    if (cfg.camera) {
      if (!cfg.camera.src) warns.push('camera.src: obrigatório quando "camera" está presente');
      const pos = cfg.camera.position || 'bottom-right';
      if (!['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(pos)) warns.push(`camera.position: "${pos}" inválido (use bottom-right/bottom-left/top-right/top-left)`);
    }
  }
  return warns;
}

function loadCfg(slug) {
  const file = projectJson(slug);
  if (!fs.existsSync(file)) {
    console.error(`✗ projects/${slug}/project.json não existe. Reels disponíveis: ${listSlugs().join(', ')}`);
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

async function renderOne(slug, { fps = 30, port, onProgress, secure = false }) {
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
    acceptInsecureCerts: true, // servidor pode ser HTTPS com cert self-signed (mkcert)
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio'],
  });
  try {
    const page = await browser.newPage();
    // tutorial é paisagem (1920x1080); os demais formatos são retrato (1080x1920).
    // +44 da barra de playback do player ⇒ Stage fica em escala 1:1 (captura nítida).
    const landscape = cfg.formato === 'tutorial';
    await page.setViewport(landscape ? { width: 1920, height: 1124, deviceScaleFactor: 1 } : { width: 1080, height: 1964, deviceScaleFactor: 1 });
    await page.goto(`${secure ? 'https' : 'http'}://127.0.0.1:${port}/player/player.html?reel=${encodeURIComponent(slug)}`, { waitUntil: 'networkidle0' });
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

    const outFile = path.join(renderDir(slug), 'video.mp4');
    fs.mkdirSync(renderDir(slug), { recursive: true });
    const ff = spawn(ffmpegPath, [
      '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-movflags', '+faststart', outFile,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    const ffDone = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-2000)))));

    const clip = { x: meta.rect.x, y: meta.rect.y, width: meta.rect.width, height: meta.rect.height };
    const started = Date.now();
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      await page.evaluate((time) => {
        const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
        svg.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', { detail: { time, sync: true } }));
      }, t);
      // cenas com <video> (formato tutorial) precisam decodificar o frame buscado
      // antes do screenshot, senão capturam frames borrados/atrasados/parados.
      // Checa video.seeking (não readyState — esse fica sempre "pronto" depois
      // do primeiro frame e faria a espera virar um no-op nos frames seguintes).
      await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        if (!videos.length) return Promise.resolve();
        return Promise.race([
          Promise.all(Array.from(videos).map(v => !v.seeking ? null : new Promise(res => {
            v.addEventListener('seeked', res, { once: true });
          }))),
          new Promise(res => setTimeout(res, 200)),
        ]);
      });
      const png = await page.screenshot({ clip, type: 'png', optimizeForSpeed: true });
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${totalFrames} (${Math.round(i / totalFrames * 100)}%)`);
      if (onProgress) onProgress({ frame: i, total: totalFrames });
    }
    ff.stdin.end();
    await ffDone;
    if (onProgress) onProgress({ frame: totalFrames, total: totalFrames });

    // narração (formato tutorial): mux do áudio limpo, atrasado pelo tempo da intro.
    // narração por cena: se alguma cena tem take próprio, monta narracao/limpo/<slug>.m4a
    // a partir dos takes (cada um no seu start) — o mux abaixo consome sem mudanças.
    const hasSceneAudio = cfg.formato === 'tutorial' && (cfg.scenes || []).some(s => s.audio?.src);
    if (hasSceneAudio) {
      const limpo = await buildSceneNarration(slug, cfg, ffmpegPath);
      cfg.narracao = { ...(cfg.narracao || {}), limpo };
    }
    // narração muxada: tutorial (delay = intro) e quiz (delay = quando a pergunta
    // aparece, ~2.5s, batendo com o início da fase "question" do quiz-renderer).
    const QUIZ_NARR_START = 2.5;
    const temNarracao = (cfg.formato === 'tutorial' || cfg.formato === 'quiz') && cfg.narracao?.limpo;
    if (temNarracao) {
      const narrDelaySec = cfg.formato === 'quiz' ? QUIZ_NARR_START : (cfg.intro?.duracao ?? 2.4);
      const narracaoFile = projPath(slug, cfg.narracao.limpo);
      if (!fs.existsSync(narracaoFile)) {
        console.warn(`  ⚠ ${cfg.narracao.limpo} não encontrado — rode "node cli.mjs audio ${slug}" antes de renderizar`);
      } else {
        const tmp = outFile.replace(/\.mp4$/, '.tmp.mp4');
        const introMs = Math.round(narrDelaySec * 1000);
        // sem -shortest: o vídeo (com intro+corpo+outro) manda na duração final;
        // a narração termina antes do outro e o restante fica em silêncio.
        await run(ffmpegPath, [
          '-y', '-i', outFile, '-i', narracaoFile,
          '-filter_complex', `[1:a]adelay=${introMs}|${introMs}[a1]`,
          '-map', '0:v', '-map', '[a1]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
          '-t', String(meta.duration), '-movflags', '+faststart', tmp,
        ]);
        fs.renameSync(tmp, outFile);
      }
    }

    // trilha sonora: embute uma faixa de musica/ (rotaciona pela ordem dos slugs).
    // Com narração, mixa a música baixinho por baixo em vez de substituir o áudio.
    if (!hasFlag('sem-musica')) {
      const track = pickTrack(slug);
      if (track) {
        const tmp = outFile.replace(/\.mp4$/, '.tmp.mp4');
        if (temNarracao) {
          await run(ffmpegPath, [
            '-y', '-i', outFile, '-stream_loop', '-1', '-i', track,
            '-filter_complex',
            // apad: a narração termina antes do outro (sem áudio); preenche com
            // silêncio até o fim, senão o amix corta no fim da narração.
            `[0:a]apad[a0];[1:a]volume=0.18,afade=t=out:st=${Math.max(0, meta.duration - 1.2)}:d=1.2[bg];[a0][bg]amix=inputs=2:duration=first:dropout_transition=0[a]`,
            '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
            '-t', String(meta.duration), '-movflags', '+faststart', tmp,
          ]);
        } else {
          await run(ffmpegPath, [
            '-y', '-i', outFile, '-stream_loop', '-1', '-i', track,
            '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '128k',
            '-af', 'volume=0.9,afade=t=out:st=' + Math.max(0, meta.duration - 1.2) + ':d=1.2',
            '-t', String(meta.duration), '-movflags', '+faststart', tmp,
          ]);
        }
        fs.renameSync(tmp, outFile);
      }
    }

    await makeThumbnail(slug, cfg, meta, ffmpegPath);

    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
    console.log(`\r  ✓ projects/${slug}/render/video.mp4 — ${mb} MB, renderizado em ${secs}s          `);
  } finally {
    await browser.close();
  }
}

// Gera out/<slug>.jpg após o render. Editável via content/<slug>.json:
//   "thumbnail": { "tempo": 2.5 }   → captura o frame nesse segundo
//   "thumbnail": { "src": "assets/prints/capa.png" } → usa uma imagem própria
// Sem o campo, captura um frame representativo (após a intro, se houver).
async function makeThumbnail(slug, cfg, meta, ffmpegPath) {
  const outJpg = path.join(renderDir(slug), 'thumb.jpg');
  const outMp4 = path.join(renderDir(slug), 'video.mp4');
  const thumb = cfg.thumbnail || {};
  try {
    if (thumb.src) {
      const srcAbs = projPath(slug, thumb.src);
      if (!fs.existsSync(srcAbs)) { console.warn(`  ⚠ thumbnail.src não encontrado: ${thumb.src}`); return; }
      await run(ffmpegPath, ['-y', '-i', srcAbs, '-vf', 'scale=640:-2', '-frames:v', '1', outJpg]);
    } else {
      const introDur = cfg.formato === 'tutorial' ? (cfg.intro?.duracao ?? 2.4) : 0;
      const t = thumb.tempo != null ? +thumb.tempo
        : Math.min(meta.duration - 0.1, introDur + 0.6); // logo depois da intro / do gancho
      await run(ffmpegPath, ['-y', '-ss', String(Math.max(0, t)), '-i', outMp4, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=640:-2', outJpg]);
    }
  } catch (e) {
    console.warn(`  ⚠ não gerou thumbnail: ${String(e.message || e).split('\n')[0]}`);
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

// Mede a duração (segundos) de um arquivo de mídia lendo o stderr do ffmpeg.
function probeDuration(ffmpegPath, file) {
  return new Promise((res) => {
    const p = spawn(ffmpegPath, ['-i', file]);
    let e = ''; p.stderr.on('data', d => e += d);
    p.on('close', () => {
      const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e);
      res(m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 15);
    });
  });
}

// Localiza narracao/raw/<slug>.<ext> — aceita áudio puro (wav/mp3/m4a/aac/ogg)
// ou um vídeo com áudio embutido (mp4/mov/webm — ex.: gravação de câmera),
// caso em que só a trilha de áudio é aproveitada (veja cleanNarration).
function findRawNarracao(slug) {
  const dir = assetDir(slug, 'narracao');
  if (!fs.existsSync(dir)) return null;
  // após a migração o raw é <slug>.<ext>; aceita qualquer basename por robustez.
  const file = fs.readdirSync(dir).find(f => /\.(wav|mp3|m4a|aac|ogg|mp4|mov|webm)$/i.test(f));
  return file ? path.join(dir, file) : null;
}

// Limpa a narração crua de <slug> (corte de silêncio nas pontas, noise gate,
// highpass, normalização de volume — filtros nativos do ffmpeg, sem depender
// de perfil de ruído) e grava narracao/limpo/<slug>.m4a. Se o arquivo cru for
// um vídeo (ex.: gravação de câmera), descarta a imagem e usa só o áudio.
// Atualiza content/<slug>.json com narracao{raw,limpo,duracaoSegundos}. Usado
// tanto pelo comando `audio` quanto pela rota /api/audio/:slug do Studio.
// Cadeia de filtros compartilhada pela narração global e pelos takes por cena:
// corte de silêncio nas pontas, highpass, noise gate e normalização de volume.
const NARRACAO_AF = (() => {
  const silenceTrim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1:detection=peak,areverse,'
    + 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1:detection=peak,areverse';
  return `${silenceTrim},highpass=f=80,agate=threshold=-40dB:ratio=4:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=11`;
})();
// variante sem corte de silêncio — usada quando o take tem vídeo de câmera
// junto (o áudio precisa manter a duração exata do vídeo).
const NARRACAO_AF_SEM_TRIM = 'highpass=f=80,agate=threshold=-40dB:ratio=4:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=11';

async function cleanNarration(slug) {
  const ffmpegPath = path.join(ROOT, 'tools', 'ffmpeg.exe');
  const raw = findRawNarracao(slug);
  if (!raw) throw new Error(`narracao/raw/${slug}.* não encontrado (áudio: wav/mp3/m4a/aac/ogg — ou vídeo com áudio: mp4/mov/webm)`);
  const limpoRel = relAsset('limpo', slug + '.m4a');
  const limpoAbs = projPath(slug, limpoRel);
  fs.mkdirSync(path.dirname(limpoAbs), { recursive: true });
  // -vn: descarta qualquer trilha de vídeo do arquivo cru (câmera) — só o áudio importa aqui.
  await run(ffmpegPath, ['-y', '-i', raw, '-vn', '-af', NARRACAO_AF, '-c:a', 'aac', '-b:a', '192k', limpoAbs]);
  const duracaoSegundos = +(await probeDuration(ffmpegPath, limpoAbs)).toFixed(2);
  const cfgFile = projectJson(slug);
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.narracao = { raw: path.relative(projectDir(slug), raw).replace(/\\/g, '/'), limpo: limpoRel, duracaoSegundos };
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
  return cfg.narracao;
}

// Limpa um take de narração de UMA cena (narracao/cenas/<slug>/<sceneId>.<ext>
// cru → <sceneId>.m4a limpo) com a mesma cadeia de filtros da narração global.
// Limpar por take (e não o concatenado) equaliza volume entre takes gravados em
// momentos diferentes e o silenceremove encurta exatamente a cena certa.
// Não escreve o content JSON — quem chama (o Studio) é o dono do cfg.
// trim=false (take gravado COM câmera): pula o silenceremove para o áudio
// limpo manter exatamente a duração do vídeo do take — senão a bolha PiP
// da cena desalinha da narração.
async function cleanSceneAudio(slug, sceneId, { trim = true } = {}) {
  const ffmpegPath = path.join(ROOT, 'tools', 'ffmpeg.exe');
  const dir = ASSET_KINDS.audioCena.dir(slug);
  const raw = fs.existsSync(dir)
    ? fs.readdirSync(dir).find(f => f.replace(/\.[^.]+$/, '') === sceneId && ASSET_KINDS.audioCena.ext.test(f) && !f.endsWith('.m4a'))
    : null;
  if (!raw) throw new Error(`narracao/cenas/${slug}/${sceneId}.* não encontrado`);
  const limpoAbs = path.join(dir, sceneId + '.m4a');
  const af = trim ? NARRACAO_AF : NARRACAO_AF_SEM_TRIM;
  await run(ffmpegPath, ['-y', '-i', path.join(dir, raw), '-vn', '-af', af, '-c:a', 'aac', '-b:a', '192k', limpoAbs]);
  const duracaoSegundos = +(await probeDuration(ffmpegPath, limpoAbs)).toFixed(2);
  return { src: relAsset('audioCena', sceneId + '.m4a'), duracaoSegundos };
}

// ── camada de voz (TTS) ──────────────────────────────────────────────────────
// Gera narração a partir de TEXTO por um provedor de TTS e joga no MESMO pipeline
// de limpeza/medição da voz gravada (cleanNarration/cleanSceneAudio) — o render
// não muda. Chaves de API vêm SÓ de env vars (nunca do código/UI).
const TTS_PROVIDERS = {
  // ElevenLabs: POST /v1/text-to-speech/<voiceId> -> audio/mpeg.
  async elevenlabs(text, { voice, model }) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('defina a env ELEVENLABS_API_KEY');
    if (!voice) throw new Error('defina a voz (cfg.voz.voice ou a env ELEVENLABS_VOICE_ID)');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model || 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  },
  // OpenAI TTS: POST /v1/audio/speech -> mp3.
  async openai(text, { voice, model }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('defina a env OPENAI_API_KEY');
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: model || 'tts-1', voice: voice || 'alloy', input: text, response_format: 'mp3' }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  },
};
// Resolve provider/voz/model do cfg.voz + override (args/body) + defaults por env.
function resolveVoice(cfg, override = {}) {
  const v = { ...(cfg?.voz || {}), ...Object.fromEntries(Object.entries(override).filter(([, x]) => x)) };
  const provider = v.provider || process.env.TTS_PROVIDER || 'elevenlabs';
  const voice = v.voice || (provider === 'elevenlabs' ? process.env.ELEVENLABS_VOICE_ID : process.env.OPENAI_TTS_VOICE || 'alloy');
  return { provider, voice, model: v.model };
}
async function synthesizeTTS(text, { provider, voice, model } = {}) {
  const fn = TTS_PROVIDERS[provider];
  if (!fn) throw new Error(`provider TTS desconhecido: "${provider}" (use ${Object.keys(TTS_PROVIDERS).join(', ')})`);
  if (!text || !text.trim()) throw new Error('texto vazio para TTS');
  return fn(text.trim(), { voice, model });
}
async function listVoices(provider = 'elevenlabs') {
  if (provider === 'openai') return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(v => ({ id: v, name: v }));
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('defina a env ELEVENLABS_API_KEY');
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return ((await res.json()).voices || []).map(v => ({ id: v.voice_id, name: v.name }));
}
// remove os raws de uma unidade (menos o .m4a limpo) — pra o TTS ser a fonte nova.
function clearRaws(dir, base) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (f.replace(/\.[^.]+$/, '') === base && !f.endsWith('.m4a')) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
}
// TTS -> narração global do projeto (reusa cleanNarration).
async function ttsToNarration(slug, text, override = {}) {
  const cfg = loadCfg(slug);
  const opts = resolveVoice(cfg, override);
  const dir = assetDir(slug, 'narracao');
  fs.mkdirSync(dir, { recursive: true });
  clearRaws(dir, slug);
  fs.writeFileSync(path.join(dir, slug + '.mp3'), await synthesizeTTS(text, opts));
  return cleanNarration(slug);
}
// TTS -> take de UMA cena (reusa cleanSceneAudio, trim on: TTS não tem câmera).
async function ttsToSceneAudio(slug, sceneId, text, override = {}) {
  const cfg = loadCfg(slug);
  const opts = resolveVoice(cfg, override);
  const dir = ASSET_KINDS.audioCena.dir(slug);
  fs.mkdirSync(dir, { recursive: true });
  clearRaws(dir, sceneId);
  fs.writeFileSync(path.join(dir, sceneId + '.mp3'), await synthesizeTTS(text, opts));
  return cleanSceneAudio(slug, sceneId, { trim: true });
}

// Monta a narração final a partir dos takes por cena: cada take entra no seu
// scenes[].start (relativo ao início do corpo) via adelay, misturado sobre uma
// base de silêncio com a duração do corpo. normalize=0 é essencial — o padrão
// do amix divide o volume pelo número de entradas. Gera narracao/limpo/<slug>.m4a,
// que o mux existente do render consome sem nenhuma mudança.
async function buildSceneNarration(slug, cfg, ffmpegPath) {
  const takes = (cfg.scenes || [])
    .filter(s => s.audio?.src)
    .map(s => ({ file: projPath(slug, s.audio.src), start: +s.start || 0 }));
  if (!takes.length) throw new Error('nenhuma cena com audio.src');
  for (const t of takes) if (!fs.existsSync(t.file)) throw new Error(`take não encontrado: ${path.relative(projectDir(slug), t.file)}`);
  const bodyDur = Math.max(cfg.narracao?.duracaoSegundos || 0, ...(cfg.scenes || []).map(s => +s.end || 0));
  const limpoRel = relAsset('limpo', slug + '.m4a');
  const limpoAbs = projPath(slug, limpoRel);
  fs.mkdirSync(path.dirname(limpoAbs), { recursive: true });
  const inputs = takes.flatMap(t => ['-i', t.file]);
  const delays = takes.map((t, i) => {
    const ms = Math.round(t.start * 1000);
    return `[${i}:a]adelay=${ms}|${ms}[a${i}]`;
  });
  const mixIn = takes.map((_, i) => `[a${i}]`).join('');
  const fc = `anullsrc=r=48000:cl=stereo:d=${bodyDur.toFixed(2)}[base];${delays.join(';')};`
    + `[base]${mixIn}amix=inputs=${takes.length + 1}:duration=first:normalize=0[a]`;
  await run(ffmpegPath, ['-y', ...inputs, '-filter_complex', fc, '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', limpoAbs]);
  return limpoRel;
}

// ── .rvs (zip do projeto) + migração ─────────────────────────────────────────
// .rvs é um zip com o projeto na raiz (project.json + assets/ + render/).
// Escrevemos STORED (sem compressão — a mídia já é comprimida); a leitura
// aceita STORED e DEFLATE (o export do Studio usa deflate via CompressionStream).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipWrite(entries) { // entries: [{ name, data: Buffer }]
  const parts = [], central = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), data = e.data, crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += lh.length + name.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, eocd]);
}

// Coleta todos os arquivos de um diretório como entries de zip (caminhos
// relativos, POSIX) — usado por export/.rvs/.rvtheme/.rvtemplate.
function dirToZipEntries(dir) {
  const entries = [];
  const walk = (d, base) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, f.name), rel = (base ? base + '/' : '') + f.name;
      if (f.isDirectory()) walk(abs, rel); else entries.push({ name: rel, data: fs.readFileSync(abs) });
    }
  };
  walk(dir, '');
  return entries;
}

function zipRead(buf) {
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error('.rvs inválido (EOCD não encontrado)');
  const count = buf.readUInt16LE(i + 10); let off = buf.readUInt32LE(i + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('.rvs inválido (central dir)');
    const method = buf.readUInt16LE(off + 10), compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(lho + 26), lExtra = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtra;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(comp) : Buffer.from(comp) });
    off += 46 + nameLen + extraLen + commLen;
  }
  return out;
}

// Reescreve um caminho de asset legado (relativo à raiz) para project-relative.
function rewriteAssetPath(p, slug) {
  if (typeof p !== 'string' || !p) return p;
  const rules = [
    [new RegExp('^gravacoes/' + slug + '/'), 'assets/gravacoes/'],
    [new RegExp('^prints/' + slug + '/'), 'assets/prints/'],
    [new RegExp('^narracao/cenas/' + slug + '/'), 'assets/narracao/cenas/'],
    [/^narracao\/raw\//, 'assets/narracao/raw/'],
    [/^narracao\/limpo\//, 'assets/narracao/limpo/'],
  ];
  for (const [re, to] of rules) if (re.test(p)) return p.replace(re, to);
  return p;
}
function rewriteCfgPaths(cfg, slug) {
  const r = (p) => rewriteAssetPath(p, slug);
  if (cfg.narracao) { if (cfg.narracao.raw) cfg.narracao.raw = r(cfg.narracao.raw); if (cfg.narracao.limpo) cfg.narracao.limpo = r(cfg.narracao.limpo); }
  if (cfg.camera?.src) cfg.camera.src = r(cfg.camera.src);
  if (cfg.thumbnail?.src) cfg.thumbnail.src = r(cfg.thumbnail.src);
  if (cfg.outro?.media) { const m = cfg.outro.media; if (m.srcCelular) m.srcCelular = r(m.srcCelular); if (m.srcDesktop) m.srcDesktop = r(m.srcDesktop); }
  for (const s of (cfg.scenes || [])) { if (s.src) s.src = r(s.src); if (s.camera?.src) s.camera.src = r(s.camera.src); if (s.audio?.src) s.audio.src = r(s.audio.src); }
  return cfg;
}

// Importa uma planilha de reels curtos: cada linha vira um projeto. Uma aba por
// formato — "quizzes" (quiz), "listas" (lista), "historias" (historia) — pelo
// nome da aba (prefixo quiz/lista/histor). Sem aba reconhecida, a primeira é
// tratada como quizzes (compatível com planilhas antigas). Aceita Buffer (rota
// /api/import-planilha) ou caminho de arquivo (CLI). Colunas por formato:
//   comuns:   slug, tag, handleSub, theme, fonte, dificuldade, dia, hora,
//             yt_titulo, yt_descricao, yt_tags
//   quiz:     hook1, hookSub, question (linhas por "|"), optionA..D, correta
//             (A/B/C/D), reveal, template
//   lista:    hook1, hook2, hookSub, items ("badge :: texto | badge :: texto",
//             badge vazio vira número), ctaTitle, ctaSub
//   historia: hook_line1, hook_line2, hook_punch, sections ("eyebrow :: titulo
//             :: body :: punch | ...", quebra de linha no titulo com "/"),
//             cta_top, cta_title
const S = (v) => String(v ?? '').trim();
const lines = (v) => S(v).split('|').map(s => s.trim()).filter(Boolean); // "a | b | c" -> [a,b,c]
function addMeta(cfg, r) {
  if (S(r.theme)) cfg.theme = S(r.theme);
  cfg.fonte = S(r.fonte);
  cfg.dificuldade = S(r.dificuldade);
  cfg.agenda = { dia: +r.dia || null, hora: r.hora === '' ? null : +r.hora };
  cfg.yt = { titulo: S(r.yt_titulo), descricao: S(r.yt_descricao), tags: S(r.yt_tags) };
  return cfg;
}
function buildQuizRow(r) {
  const options = ['A', 'B', 'C', 'D']
    .filter(L => S(r['option' + L]))
    .map(L => ({ text: S(r['option' + L]), correct: S(r.correta).toUpperCase() === L }));
  const cfg = {
    formato: 'quiz',
    tag: S(r.tag) || 'Quiz',
    hook1: S(r.hook1) || 'VOCÊ SABIA?',
    hookSub: S(r.hookSub),
    question: S(r.question).split('|').map(s => s.trim()).join('\n'),
    options,
    reveal: S(r.reveal),
    ctaTitle: S(r.ctaTitle) || 'Acertou? Comenta aí.',
    handleSub: S(r.handleSub) || 'tech · produtividade · IA',
  };
  if (S(r.template)) cfg.template = S(r.template);
  return addMeta(cfg, r);
}
function buildListaRow(r) {
  const items = lines(r.items).map(chunk => {
    const i = chunk.indexOf('::');
    return i === -1 ? { badge: '', text: chunk } : { badge: chunk.slice(0, i).trim(), text: chunk.slice(i + 2).trim() };
  });
  const cfg = {
    formato: 'lista',
    tag: S(r.tag) || 'Lista',
    hook1: S(r.hook1),
    hook2: S(r.hook2),
    hookSub: S(r.hookSub),
    items,
    ctaTitle: S(r.ctaTitle),
    ctaSub: S(r.ctaSub),
    handleSub: S(r.handleSub) || 'tech · produtividade · IA',
  };
  return addMeta(cfg, r);
}
function buildHistoriaRow(r) {
  const sections = lines(r.sections).map(chunk => {
    const [eyebrow = '', title = '', body = '', punch = ''] = chunk.split('::').map(x => x.trim());
    const sec = { eyebrow };
    if (title) sec.title = title.split('/').map(x => x.trim()).join('\n');
    if (body) sec.body = body;
    if (punch) sec.punch = punch;
    return sec;
  });
  const cfg = {
    formato: 'historia',
    tag: S(r.tag) || 'Case',
    hook: { line1: S(r.hook_line1), line2: S(r.hook_line2), punch: S(r.hook_punch) },
    sections,
    cta: { top: S(r.cta_top), title: S(r.cta_title).split('/').map(x => x.trim()).join('\n') },
    handleSub: S(r.handleSub) || 'tech · produtividade · IA',
  };
  return addMeta(cfg, r);
}
const ROW_BUILDERS = { quiz: buildQuizRow, lista: buildListaRow, historia: buildHistoriaRow };
function sheetFormato(name) {
  const n = String(name).toLowerCase();
  if (n.startsWith('quiz')) return 'quiz';
  if (n.startsWith('lista')) return 'lista';
  if (n.startsWith('histor')) return 'historia';
  return null;
}
async function importPlanilha(bufOrPath) {
  const XLSX = (await import('xlsx')).default;
  const wb = Buffer.isBuffer(bufOrPath) ? XLSX.read(bufOrPath, { type: 'buffer' }) : XLSX.readFile(bufOrPath);
  const result = { total: 0, ok: 0, bad: 0, slugs: [], warnsBySlug: {} };
  let sheets = wb.SheetNames.map(n => [n, sheetFormato(n)]).filter(([, f]) => f);
  if (!sheets.length && wb.SheetNames.length) sheets = [[wb.SheetNames[0], 'quiz']]; // compat: 1 aba = quizzes
  for (const [name, formato] of sheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
    for (const r of rows) {
      const slug = S(r.slug);
      if (!slug || !SLUG_RE.test(slug)) continue;
      const cfg = ROW_BUILDERS[formato](r);
      const warns = validate(slug, cfg);
      result.total++;
      if (warns.length) { result.bad++; result.warnsBySlug[slug] = warns; } else result.ok++;
      fs.mkdirSync(projectDir(slug), { recursive: true });
      fs.writeFileSync(projectJson(slug), JSON.stringify(cfg, null, 2) + '\n');
      result.slugs.push(slug);
    }
  }
  return result;
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
  tutorial: {
    formato: 'tutorial', tag: 'Tutorial', titulo: 'Título do tutorial',
    intro: { titulo: 'Lucas Santos', subtitulo: 'tutoriais de tech, direto ao ponto', duracao: 2.4 },
    outro: { cta: 'INSCREVA-SE', sub: 'toda semana, um tutorial novo', duracao: 3.2 },
    narracao: { raw: '', limpo: '', duracaoSegundos: 10 },
    scenes: [
      // layout "desktop" (padrão p/ video/image): janela de navegador — gravação de tela do PC.
      // roteiro é opcional: texto de apoio mostrado na tela ao gravar pelo app móvel (teleprompter).
      // id: gerado pelo Studio (nomeia o áudio da cena); duration: fonte de verdade — start/end são derivados em sequência.
      { id: 's-passo1', type: 'video', layout: 'desktop', src: 'assets/gravacoes/passo1.mp4', duration: 5, start: 0, end: 5, trimStart: 0, numero: 1, caption: 'Passo 1', roteiro: 'Aqui eu explico o passo 1...' },
      // layout "celular": mockup de telefone — gravação/print de tela do celular.
      { id: 's-tela2', type: 'image', layout: 'celular', src: 'assets/prints/tela2.png', duration: 3, start: 5, end: 8, badge: 'RESPONSIVO', titulo: 'No celular', texto: 'Também funciona em mobile.', roteiro: 'Aqui eu explico o passo 2...' },
    ],
  },
};

async function main() {
  if (cmd === 'list') {
    for (const slug of listSlugs()) {
      const cfg = JSON.parse(fs.readFileSync(projectJson(slug), 'utf8'));
      const rendered = fs.existsSync(path.join(renderDir(slug), 'video.mp4')) ? '✓ mp4' : '—';
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
    const file = projectJson(slug);
    if (fs.existsSync(file)) { console.error(`✗ ${file} já existe`); process.exit(1); }
    fs.mkdirSync(projectDir(slug), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(SKELETONS[formato], null, 2) + '\n');
    console.log(`✓ projects/${slug}/project.json criado (formato ${formato}). Edite e rode:\n  node cli.mjs render ${slug}`);
  } else if (cmd === 'validate') {
    const slug = args[1];
    const warns = validate(slug, loadCfg(slug));
    if (!warns.length) console.log(`✓ ${slug}: dentro dos limites`);
    else { for (const w of warns) console.warn('  ⚠ ' + w); process.exitCode = 1; }
  } else if (cmd === 'export') {
    // Empacota projects/<slug>/ num <slug>.rvs (projeto na raiz do zip).
    const slug = args[1];
    if (!slug || !fs.existsSync(projectJson(slug))) { console.error('uso: node cli.mjs export <slug>'); process.exit(1); }
    const entries = dirToZipEntries(projectDir(slug));
    const out = path.join(ROOT, slug + '.rvs');
    fs.writeFileSync(out, zipWrite(entries));
    console.log(`✓ ${slug}.rvs — ${entries.length} arquivos, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
  } else if (cmd === 'export-theme' || cmd === 'export-template') {
    // Empacota themes/<id>/ (.rvtheme) ou templates/scenes/<id>/ (.rvtemplate).
    const isTheme = cmd === 'export-theme';
    const id = args[1];
    const dir = isTheme ? path.join(THEMES, id) : path.join(SCENE_TEMPLATES, id);
    const ext = isTheme ? '.rvtheme' : '.rvtemplate';
    if (!id || !fs.existsSync(dir)) { console.error(`uso: node cli.mjs ${cmd} <id>`); process.exit(1); }
    const entries = dirToZipEntries(dir);
    const out = path.join(ROOT, id + ext);
    fs.writeFileSync(out, zipWrite(entries));
    console.log(`✓ ${id}${ext} — ${entries.length} arquivos`);
  } else if (cmd === 'pack-plugin') {
    // Empacota cowork-plugin/ num .zip válido (caminhos POSIX) p/ upload no Cowork.
    // (Compress-Archive do Windows grava barra invertida — o Cowork rejeita.)
    const dir = path.join(ROOT, 'cowork-plugin');
    if (!fs.existsSync(dir)) { console.error('✗ cowork-plugin/ não encontrado'); process.exit(1); }
    const entries = dirToZipEntries(dir);
    const out = path.join(ROOT, 'cowork-plugin.zip');
    fs.writeFileSync(out, zipWrite(entries));
    console.log(`✓ cowork-plugin.zip — ${entries.length} arquivos (${(fs.statSync(out).size / 1024).toFixed(1)} KB). Suba em Plugins → Adicionar → Fazer upload de plugin.`);
  } else if (cmd === 'migrate') {
    // Move content/<slug>.json + pastas por-tipo para projects/<slug>/ (uma vez).
    const dry = hasFlag('dry-run');
    const contentDir = path.join(ROOT, 'content');
    if (!fs.existsSync(contentDir)) { console.log('nada em content/ — já migrado?'); return; }
    const slugs = fs.readdirSync(contentDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
    const mv = (from, to) => {
      if (!fs.existsSync(from)) return;
      if (dry) { console.log('  mv', path.relative(ROOT, from), '→', path.relative(ROOT, to)); return; }
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to);
    };
    const mvDir = (from, toDir) => { if (fs.existsSync(from)) for (const f of fs.readdirSync(from)) mv(path.join(from, f), path.join(toDir, f)); };
    let done = 0;
    for (const slug of slugs) {
      if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) { console.warn(`  ⚠ nome inseguro, pulando: ${slug}`); continue; }
      const cfg = rewriteCfgPaths(JSON.parse(fs.readFileSync(path.join(contentDir, slug + '.json'), 'utf8')), slug);
      if (dry) console.log('projeto', slug);
      else { fs.mkdirSync(projectDir(slug), { recursive: true }); fs.writeFileSync(projectJson(slug), JSON.stringify(cfg, null, 2) + '\n'); }
      mvDir(path.join(ROOT, 'gravacoes', slug), assetDir(slug, 'gravacao'));
      mvDir(path.join(ROOT, 'prints', slug), assetDir(slug, 'print'));
      mvDir(path.join(ROOT, 'narracao', 'cenas', slug), assetDir(slug, 'audioCena'));
      const rawDir = path.join(ROOT, 'narracao', 'raw');
      if (fs.existsSync(rawDir)) for (const f of fs.readdirSync(rawDir)) if (f.replace(/\.[^.]+$/, '') === slug) mv(path.join(rawDir, f), path.join(assetDir(slug, 'narracao'), f));
      mv(path.join(ROOT, 'narracao', 'limpo', slug + '.m4a'), path.join(assetDir(slug, 'limpo'), slug + '.m4a'));
      mv(path.join(ROOT, 'out', slug + '.mp4'), path.join(renderDir(slug), 'video.mp4'));
      mv(path.join(ROOT, 'out', slug + '.jpg'), path.join(renderDir(slug), 'thumb.jpg'));
      if (!dry) fs.unlinkSync(path.join(contentDir, slug + '.json'));
      done++;
    }
    console.log(dry ? `(dry-run) ${done} projetos migrariam para projects/` : `✓ ${done} projetos migrados para projects/`);
  } else if (cmd === 'import') {
    // .rvs/.rvtheme/.rvtemplate -> pasta certa | .json -> projeto | .xlsx/.csv -> quizzes.
    const file = args[1];
    if (!file || !fs.existsSync(file)) { console.error('uso: node cli.mjs import <arquivo.rvs|.rvtheme|.rvtemplate|.json|planilha.xlsx>'); process.exit(1); }
    if (/\.(rvtheme|rvtemplate)$/i.test(file)) {
      const isTheme = /\.rvtheme$/i.test(file);
      const id = flag('id', path.basename(file).replace(/\.(rvtheme|rvtemplate)$/i, ''));
      if (!SLUG_RE.test(id)) { console.error('✗ id inválido (use --id)'); process.exit(1); }
      const destBase = isTheme ? path.join(THEMES, id) : path.join(SCENE_TEMPLATES, id);
      if (fs.existsSync(destBase)) { console.error(`✗ ${path.relative(ROOT, destBase)}/ já existe`); process.exit(1); }
      for (const e of zipRead(fs.readFileSync(file))) {
        const to = path.join(destBase, e.name);
        if (!to.startsWith(destBase)) continue;
        fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, e.data);
      }
      console.log(`✓ importado para ${path.relative(ROOT, destBase)}/`);
      return;
    }
    if (/\.rvs$/i.test(file)) {
      const slug = flag('slug', path.basename(file).replace(/\.rvs$/i, ''));
      if (!SLUG_RE.test(slug)) { console.error('✗ slug inválido'); process.exit(1); }
      if (fs.existsSync(projectDir(slug))) { console.error(`✗ projects/${slug}/ já existe`); process.exit(1); }
      for (const e of zipRead(fs.readFileSync(file))) {
        const to = path.join(projectDir(slug), e.name);
        if (!to.startsWith(projectDir(slug))) continue; // anti-traversal
        fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, e.data);
      }
      console.log(`✓ importado para projects/${slug}/`);
      return;
    }
    if (/\.json$/i.test(file)) {
      // só a definição (sem assets) -> projects/<slug>/project.json
      const slug = flag('slug', path.basename(file).replace(/\.json$/i, ''));
      if (!SLUG_RE.test(slug)) { console.error('✗ slug inválido (use --slug)'); process.exit(1); }
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.mkdirSync(projectDir(slug), { recursive: true });
      fs.writeFileSync(projectJson(slug), JSON.stringify(cfg, null, 2) + '\n');
      const warns = validate(slug, cfg);
      console.log(`✓ importado projects/${slug}/project.json${warns.length ? ` (${warns.length} aviso(s))` : ''}`);
      return;
    }
    const { total, ok, bad, warnsBySlug } = await importPlanilha(file);
    for (const [slug, warns] of Object.entries(warnsBySlug)) { console.warn(`⚠ ${slug}:`); for (const w of warns) console.warn('    ' + w); }
    console.log(`✓ importados ${total} reels (${ok} ok, ${bad} com avisos — revise antes de renderizar)`);
  } else if (cmd === 'audio') {
    // Limpa a narração crua (narracao/raw/<slug>.*) e atualiza content/<slug>.json.
    // Uso: node cli.mjs audio <slug>
    const slug = args[1];
    if (!slug) { console.error('uso: node cli.mjs audio <slug>'); process.exit(1); }
    loadCfg(slug); // valida que o projeto existe
    const { limpo, duracaoSegundos } = await cleanNarration(slug);
    console.log(`✓ ${limpo} — ${duracaoSegundos}s (projects/${slug}/project.json atualizado)`);
  } else if (cmd === 'tts') {
    // Gera narração por TTS. Uso: node cli.mjs tts <slug> [--scene <id>]
    //   [--text "..."] [--provider elevenlabs|openai] [--voice <id>] [--model <m>]
    // Sem --text: usa o roteiro da cena (--scene) ou a question do quiz.
    const slug = args[1];
    if (!slug) { console.error('uso: node cli.mjs tts <slug> [--scene <id>] [--text "..."] [--provider] [--voice]'); process.exit(1); }
    const cfg = loadCfg(slug);
    const sceneId = flag('scene');
    const over = { provider: flag('provider'), voice: flag('voice'), model: flag('model') };
    let text = flag('text');
    if (!text) text = sceneId ? ((cfg.scenes || []).find(s => s.id === sceneId)?.roteiro || '') : (cfg.question || '').replace(/\n/g, ' ');
    if (!text.trim()) { console.error('sem texto: passe --text, ou a cena precisa de "roteiro" / o quiz de "question"'); process.exit(1); }
    try {
      const r = sceneId ? await ttsToSceneAudio(slug, sceneId, text, over) : await ttsToNarration(slug, text, over);
      console.log(`✓ narração TTS (${resolveVoice(cfg, over).provider}) — ${r.duracaoSegundos}s → ${r.src || r.limpo}`);
    } catch (e) { console.error('✗ ' + String(e.message || e)); process.exitCode = 1; } // exitCode (não exit) p/ o fetch fechar limpo
  } else if (cmd === 'voices') {
    // Lista as vozes de um provedor. Uso: node cli.mjs voices [--provider elevenlabs|openai]
    try { console.log(JSON.stringify(await listVoices(flag('provider', 'elevenlabs')), null, 2)); }
    catch (e) { console.error('✗ ' + String(e.message || e)); process.exitCode = 1; }
  } else if (cmd === 'musica') {
    // Embute trilha nos MP4s já renderizados (sem re-renderizar): out/ -> out-com-musica/.
    // Faixas em musica/ (rotaciona). Uso: node cli.mjs musica <slug> | --all
    const ffmpegPath = path.join(ROOT, 'tools', 'ffmpeg.exe');
    const tracks = listTracks();
    if (!tracks.length) { console.error('✗ pasta musica/ vazia — baixe faixas da YouTube Audio Library e coloque lá'); process.exit(1); }
    const slugs = (hasFlag('all') ? listSlugs() : [args[1]]).filter(s => s && fs.existsSync(path.join(renderDir(s), 'video.mp4')));
    if (!slugs.length) { console.error('uso: node cli.mjs musica <slug> | --all (renderize antes)'); process.exit(1); }
    for (const [i, slug] of slugs.entries()) {
      const src = path.join(renderDir(slug), 'video.mp4');
      const dst = path.join(renderDir(slug), 'video-com-musica.mp4');
      const track = tracks[i % tracks.length];
      const dur = await probeDuration(ffmpegPath, src);
      await run(ffmpegPath, [
        '-y', '-i', src, '-stream_loop', '-1', '-i', track,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k',
        '-af', `volume=0.9,afade=t=out:st=${Math.max(0, dur - 1.2)}:d=1.2`,
        '-t', String(dur), '-movflags', '+faststart', dst,
      ]);
      console.log(`  ✓ projects/${slug}/render/video-com-musica.mp4 ← ${path.basename(track)}`);
    }
  } else if (cmd === 'planilha') {
    // Gera out/publicacao.xlsx com os metadados de upload manual, ordenado por dia/hora.
    const XLSX = (await import('xlsx')).default;
    const rows = [];
    for (const slug of listSlugs()) {
      const cfg = JSON.parse(fs.readFileSync(projectJson(slug), 'utf8'));
      if (!cfg.yt) continue; // qualquer formato curto com metadados de upload
      const isQuiz = cfg.formato === 'quiz';
      // resumo do conteúdo por formato (só pra referência ao publicar).
      const conteudo = isQuiz ? String(cfg.question || '').replace(/\n/g, ' ')
        : cfg.formato === 'lista' ? [cfg.hook1, cfg.hook2].filter(Boolean).join(' ')
        : cfg.formato === 'historia' ? [cfg.hook?.line1, cfg.hook?.line2].filter(Boolean).join(' ')
        : (cfg.titulo || '');
      rows.push({
        dia: cfg.agenda?.dia ?? '', hora: cfg.agenda?.hora ?? '',
        formato: cfg.formato,
        arquivo: `projects\\${slug}\\render\\video.mp4`,
        mp4_pronto: fs.existsSync(path.join(renderDir(slug), 'video.mp4')) ? 'sim' : 'NÃO',
        titulo: cfg.yt.titulo, descricao: cfg.yt.descricao, tags: cfg.yt.tags,
        conteudo,
        resposta: isQuiz ? (cfg.options.find(o => o.correct) || {}).text || '' : '',
        fonte: cfg.fonte || '',
        publicado: '',
      });
    }
    rows.sort((a, b) => (a.dia - b.dia) || (a.hora - b.hora));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 5 }, { wch: 9 }, { wch: 34 }, { wch: 10 }, { wch: 70 }, { wch: 90 }, { wch: 60 }, { wch: 50 }, { wch: 16 }, { wch: 40 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'publicacao');
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    XLSX.writeFile(wb, path.join(ROOT, 'out', 'publicacao.xlsx'));
    console.log(`✓ out/publicacao.xlsx — ${rows.length} vídeos, ordenado por dia/hora`);
  } else if (cmd === 'serve') {
    const port = +flag('port', 5173);
    const tls = httpsOptions();
    await serve(port, { network: true });
    console.log(`reels-studio no ar: http${tls ? 's' : ''}://127.0.0.1:${port}/  (player: /player/player.html?reel=<slug>)`);
    if (tls) {
      const ip = lanIp();
      console.log(`  Studio na rede local (celular): https://${ip || '<IP-da-LAN>'}:${port}/studio/`);
    } else {
      console.log('  (sem certs/cert.pem + certs/key.pem — HTTP local apenas; gere certs com mkcert para acessar do celular)');
    }
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
