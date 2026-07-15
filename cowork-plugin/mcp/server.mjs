#!/usr/bin/env node
// mcp/server.mjs — servidor MCP (stdio) do reels-studio para o Claude Cowork.
// Expõe as operações do CLI como ferramentas nativas. ROOT = raiz do repo (onde
// estão cli.mjs, node_modules, tools/ffmpeg.exe e projects/). Ferramentas sem
// estado fazem spawn do `node cli.mjs ...`; o render vira jobs em memória neste
// processo (que vive durante a sessão) — dispara e consulta status, sem travar.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Servidor MCP SEM dependências (só Node built-ins) — o plugin roda igual esteja
// ele referenciado no lugar ou copiado no upload do Cowork.
// Raiz do repo (onde estão cli.mjs, node_modules, tools/ffmpeg.exe, projects/):
// REELS_ROOT > CLAUDE_PLUGIN_ROOT > pai de mcp/ — escolhe o primeiro que tem cli.mjs.
const HERE = path.dirname(fileURLToPath(import.meta.url));
function resolveRoot() {
  const cands = [process.env.REELS_ROOT, process.env.CLAUDE_PLUGIN_ROOT, path.dirname(HERE)].filter(Boolean);
  for (const c of cands) if (fs.existsSync(path.join(c, 'cli.mjs'))) return c;
  return cands[0] || path.dirname(HERE);
}
const ROOT = resolveRoot();
const CLI = path.join(ROOT, 'cli.mjs');
const PROJECTS = path.join(ROOT, 'projects');

const SLUG_RE = /^[\p{L}0-9][\p{L}0-9-]*$/u;
const okSlug = (s) => typeof s === 'string' && SLUG_RE.test(s);

// ── executar o CLI (sem estado) ──────────────────────────────────────────────
function runCli(args, { timeout = 180000 } = {}) {
  return new Promise((resolve) => {
    const ch = spawn(process.execPath, [CLI, ...args], { cwd: ROOT });
    let out = '', err = '';
    const to = setTimeout(() => { try { ch.kill(); } catch {} }, timeout);
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code) => { clearTimeout(to); resolve({ code, out: out.trim(), err: err.trim() }); });
    ch.on('error', (e) => { clearTimeout(to); resolve({ code: -1, out, err: String(e.message || e) }); });
  });
}
const asText = (r) => [r.out, r.err].filter(Boolean).join('\n') || (r.code === 0 ? 'ok' : `exit ${r.code}`);

// ── status de projetos (espelha /api/projects do cli.mjs) ────────────────────
function listProjects(formato) {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs.readdirSync(PROJECTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PROJECTS, d.name, 'project.json')))
    .map((d) => {
      const slug = d.name, jf = path.join(PROJECTS, slug, 'project.json');
      let fmt = '?', rendered = false, stale = false;
      try {
        fmt = JSON.parse(fs.readFileSync(jf, 'utf8')).formato || '?';
        const mp4 = path.join(PROJECTS, slug, 'render', 'video.mp4');
        if (fs.existsSync(mp4)) { rendered = true; try { stale = fs.statSync(jf).mtimeMs > fs.statSync(mp4).mtimeMs; } catch {} }
      } catch {}
      return { slug, formato: fmt, rendered, stale };
    })
    .filter((p) => !formato || p.formato === formato)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
const baseState = (p) => (p.rendered ? (p.stale ? 'desatualizado' : 'feito') : 'pendente');

function listDir(sub, hasFile) {
  const base = path.join(ROOT, sub);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!hasFile || fs.existsSync(path.join(base, d.name, hasFile))))
    .map((d) => d.name).sort();
}

// ── jobs de render (em memória) ──────────────────────────────────────────────
const jobs = new Map(); // slug -> { state:'running'|'done'|'error', frame,total,error, child }
const queue = [];       // fila do batch
let queueRunning = false;

function startRender(slug) {
  if (!okSlug(slug)) return { error: 'slug inválido' };
  if (!fs.existsSync(path.join(PROJECTS, slug, 'project.json'))) return { error: 'projeto não encontrado' };
  const cur = jobs.get(slug);
  if (cur && cur.state === 'running') return { slug, state: 'running', note: 'já renderizando' };
  const child = spawn(process.execPath, [CLI, 'render', slug], { cwd: ROOT });
  const job = { state: 'running', frame: 0, total: 0, error: '', child };
  jobs.set(slug, job);
  const onData = (d) => {
    const s = String(d);
    // "frame 120/393 (31%)" — pega o último match do chunk.
    const m = [...s.matchAll(/frame\s+(\d+)\/(\d+)/g)].pop();
    if (m) { job.frame = +m[1]; job.total = +m[2]; }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', (code) => { job.child = null; job.state = code === 0 ? 'done' : 'error'; if (code !== 0 && !job.error) job.error = `exit ${code}`; });
  child.on('error', (e) => { job.child = null; job.state = 'error'; job.error = String(e.message || e); });
  return { slug, state: 'running' };
}
function jobView(slug) {
  const j = jobs.get(slug); if (!j) return { slug, state: 'idle' };
  return { slug, state: j.state, frame: j.frame, total: j.total, pct: j.total ? Math.round(100 * j.frame / j.total) : null, error: j.error || undefined };
}
async function runQueue() {
  if (queueRunning) return; queueRunning = true;
  while (queue.length) {
    const slug = queue.shift();
    if (jobs.get(slug)?.state === 'canceled') continue;
    startRender(slug);
    await new Promise((res) => {
      const t = setInterval(() => { const j = jobs.get(slug); if (!j || j.state !== 'running') { clearInterval(t); res(); } }, 800);
    });
  }
  queueRunning = false;
}

// ── definição das ferramentas ────────────────────────────────────────────────
const S = (extra = {}) => ({ type: 'object', properties: { slug: { type: 'string', description: 'slug do projeto' }, ...extra }, required: ['slug'] });
const TOOLS = [
  { name: 'list_projects', description: 'Lista os projetos com formato e status de render (rendered/stale). Filtro opcional por formato.', inputSchema: { type: 'object', properties: { formato: { type: 'string', enum: ['tutorial', 'quiz', 'lista', 'historia', 'custom'] } } } },
  { name: 'read_project', description: 'Lê o project.json de um projeto.', inputSchema: S() },
  { name: 'write_project', description: 'Grava o project.json (cria a pasta) e valida; devolve os avisos.', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, cfg: { type: 'object', description: 'objeto de conteúdo do vídeo' } }, required: ['slug', 'cfg'] } },
  { name: 'create_project', description: 'Cria um projeto vazio de um formato (node cli.mjs new).', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, formato: { type: 'string', enum: ['tutorial', 'quiz', 'lista', 'historia'] } }, required: ['slug', 'formato'] } },
  { name: 'validate', description: 'Valida um projeto (limites de texto, campos).', inputSchema: S() },
  { name: 'delete_project', description: 'EXCLUI um projeto inteiro (projects/<slug>/ — project.json, assets e render). Não dá pra desfazer.', inputSchema: S() },
  { name: 'render_start', description: 'Dispara o render de um projeto (não bloqueia). Use render_status para acompanhar.', inputSchema: S() },
  { name: 'render_status', description: 'Status dos renders (um slug, ou todos os jobs se omitido).', inputSchema: { type: 'object', properties: { slug: { type: 'string' } } } },
  { name: 'render_batch', description: 'Enfileira renders sequenciais. Passe slugs, ou um filtro: formato e/ou status pendente/desatualizado/todos.', inputSchema: { type: 'object', properties: { slugs: { type: 'array', items: { type: 'string' } }, formato: { type: 'string' }, status: { type: 'string', enum: ['pendente', 'desatualizado', 'pendentes+desatualizados', 'todos'], default: 'pendentes+desatualizados' } } } },
  { name: 'render_stop', description: 'Cancela a fila de render e/ou um job (mata o processo).', inputSchema: { type: 'object', properties: { slug: { type: 'string' } } } },
  { name: 'import_spreadsheet', description: 'Importa uma planilha .xlsx (abas quizzes/listas/historias) criando vários projetos.', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'caminho do .xlsx (absoluto ou relativo à raiz)' } }, required: ['path'] } },
  { name: 'import_package', description: 'Importa um pacote .rvs / .rvtheme / .rvtemplate.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string', description: 'novo id (opcional, p/ tema/template)' } }, required: ['path'] } },
  { name: 'clean_audio', description: 'Limpa a narração crua e mede a duração (node cli.mjs audio).', inputSchema: S() },
  { name: 'tts_generate', description: 'Gera narração por TTS (ElevenLabs/OpenAI; chave em env). Sem sceneId, narra o projeto todo; com sceneId, narra a cena. Sem text, usa o roteiro da cena ou a question do quiz.', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, sceneId: { type: 'string' }, text: { type: 'string' }, provider: { type: 'string', enum: ['elevenlabs', 'openai'] }, voice: { type: 'string' }, model: { type: 'string' } }, required: ['slug'] } },
  { name: 'list_voices', description: 'Lista as vozes de um provedor de TTS (elevenlabs precisa da env ELEVENLABS_API_KEY; openai é fixo).', inputSchema: { type: 'object', properties: { provider: { type: 'string', enum: ['elevenlabs', 'openai'] } } } },
  { name: 'export_project', description: 'Empacota o projeto num .rvs.', inputSchema: S() },
  { name: 'export_theme', description: 'Empacota um tema num .rvtheme.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'export_template', description: 'Empacota um template de cena num .rvtemplate.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'list_themes', description: 'Lista os temas instalados (themes/).', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_quiz_templates', description: 'Lista os layouts de quiz por canal (templates/quiz/).', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_scene_templates', description: 'Lista os templates de cena de tutorial (templates/scenes/).', inputSchema: { type: 'object', properties: {} } },
  { name: 'publish_sheet', description: 'Gera out/publicacao.xlsx com títulos/tags para upload manual.', inputSchema: { type: 'object', properties: {} } },
  { name: 'serve_start', description: 'Sobe o servidor do Studio (node cli.mjs serve) e devolve a URL.', inputSchema: { type: 'object', properties: { port: { type: 'number', default: 5173 } } } },
  { name: 'serve_stop', description: 'Derruba o servidor do Studio iniciado por serve_start.', inputSchema: { type: 'object', properties: {} } },
];

// servidor de preview (um só)
let serveChild = null;

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });

async function handleCall(name, a = {}) {
  switch (name) {
    case 'list_projects': {
      const items = listProjects(a.formato).map((p) => ({ ...p, status: baseState(p) }));
      const c = { feito: 0, desatualizado: 0, pendente: 0 };
      for (const p of items) c[p.status]++;
      return text({ total: items.length, resumo: c, projetos: items });
    }
    case 'read_project': {
      if (!okSlug(a.slug)) return text('slug inválido');
      const jf = path.join(PROJECTS, a.slug, 'project.json');
      if (!fs.existsSync(jf)) return text('projeto não encontrado');
      return text(fs.readFileSync(jf, 'utf8'));
    }
    case 'write_project': {
      if (!okSlug(a.slug)) return text('slug inválido');
      if (!a.cfg || typeof a.cfg !== 'object') return text('cfg ausente');
      const dir = path.join(PROJECTS, a.slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(a.cfg, null, 2) + '\n');
      const v = await runCli(['validate', a.slug]);
      return text(`gravado projects/${a.slug}/project.json\n${asText(v)}`);
    }
    case 'create_project': return text(asText(await runCli(['new', a.slug, '--formato', a.formato])));
    case 'validate': return text(asText(await runCli(['validate', a.slug])));
    case 'delete_project': return text(asText(await runCli(['delete', a.slug])));
    case 'render_start': return text(startRender(a.slug));
    case 'render_status':
      return text(a.slug ? jobView(a.slug) : { fila: queue.slice(), jobs: [...jobs.keys()].map(jobView) });
    case 'render_batch': {
      let slugs = Array.isArray(a.slugs) && a.slugs.length ? a.slugs.filter(okSlug) : null;
      if (!slugs) {
        const status = a.status || 'pendentes+desatualizados';
        slugs = listProjects(a.formato).filter((p) => {
          const st = baseState(p);
          if (status === 'todos') return true;
          if (status === 'pendentes+desatualizados') return st !== 'feito';
          return st === status;
        }).map((p) => p.slug);
      }
      for (const s of slugs) if (!queue.includes(s) && jobs.get(s)?.state !== 'running') queue.push(s);
      runQueue();
      return text({ enfileirados: slugs.length, fila: queue.length, note: 'acompanhe com render_status' });
    }
    case 'render_stop': {
      if (a.slug) { const j = jobs.get(a.slug); if (j?.child) try { j.child.kill(); } catch {} ; if (j) j.state = 'canceled'; const i = queue.indexOf(a.slug); if (i >= 0) queue.splice(i, 1); return text(`cancelado ${a.slug}`); }
      queue.length = 0; for (const [, j] of jobs) if (j.child) try { j.child.kill(); } catch {}
      return text('fila e jobs cancelados');
    }
    case 'import_spreadsheet': return text(asText(await runCli(['import', a.path])));
    case 'import_package': return text(asText(await runCli(['import', a.path, ...(a.id ? ['--id', a.id] : [])])));
    case 'clean_audio': return text(asText(await runCli(['audio', a.slug], { timeout: 300000 })));
    case 'tts_generate': {
      const args = ['tts', a.slug];
      if (a.sceneId) args.push('--scene', a.sceneId);
      if (a.text) args.push('--text', a.text);
      if (a.provider) args.push('--provider', a.provider);
      if (a.voice) args.push('--voice', a.voice);
      if (a.model) args.push('--model', a.model);
      return text(asText(await runCli(args, { timeout: 120000 })));
    }
    case 'list_voices': return text(asText(await runCli(['voices', ...(a.provider ? ['--provider', a.provider] : [])])));
    case 'export_project': return text(asText(await runCli(['export', a.slug])));
    case 'export_theme': return text(asText(await runCli(['export-theme', a.id])));
    case 'export_template': return text(asText(await runCli(['export-template', a.id])));
    case 'list_themes': return text(listDir('themes', 'theme.yaml'));
    case 'list_quiz_templates': return text(listDir(path.join('templates', 'quiz'), 'manifest.yaml'));
    case 'list_scene_templates': return text(listDir(path.join('templates', 'scenes'), 'manifest.yaml'));
    case 'publish_sheet': return text(asText(await runCli(['planilha'])));
    case 'serve_start': {
      if (serveChild && !serveChild.killed) return text('servidor já rodando');
      const port = a.port || 5173;
      serveChild = spawn(process.execPath, [CLI, 'serve', '--port', String(port)], { cwd: ROOT, detached: false });
      serveChild.on('close', () => { serveChild = null; });
      const tls = fs.existsSync(path.join(ROOT, 'certs', 'cert.pem'));
      return text(`Studio no ar: http${tls ? 's' : ''}://127.0.0.1:${port}/studio/`);
    }
    case 'serve_stop': { if (serveChild) try { serveChild.kill(); } catch {} ; serveChild = null; return text('servidor derrubado'); }
    default: throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

// ── transporte MCP: JSON-RPC 2.0 sobre stdio (linhas), sem dependências ───────
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
async function dispatch(req) {
  const { id, method, params } = req;
  if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'reels-studio', version: '1.0.0' } } });
  if (method === 'notifications/initialized' || method === 'initialized') return; // notificação: sem resposta
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    try { const r = await handleCall(params.name, params.arguments || {}); return send({ jsonrpc: '2.0', id, result: r }); }
    catch (e) { return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'erro: ' + String(e.message || e) }], isError: true } }); }
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } });
}
let _buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  _buf += chunk;
  let i;
  while ((i = _buf.indexOf('\n')) >= 0) {
    const line = _buf.slice(0, i).trim();
    _buf = _buf.slice(i + 1);
    if (!line) continue;
    let req; try { req = JSON.parse(line); } catch { continue; }
    Promise.resolve(dispatch(req)).catch(() => {});
  }
});
console.error(`reels-studio MCP no ar (ROOT=${ROOT}${fs.existsSync(CLI) ? '' : ' — ⚠ cli.mjs não encontrado; defina REELS_ROOT'})`);
