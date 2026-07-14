// studio/lib.jsx — helpers puros do Studio desktop (sem componentes).
// Carregado antes de components.jsx/app.jsx; tudo vive no escopo global.

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${path}: HTTP ${res.status}`);
  return body;
}

function newSceneId() {
  return 's-' + Math.random().toString(36).slice(2, 8);
}

// Lê a duração (s) de um arquivo de mídia — URL servida pelo cli ou Blob local.
// <video> também mede webm/m4a só de áudio, então serve para os dois casos.
function readMediaDuration(src) {
  return new Promise((resolve) => {
    const isBlob = typeof src !== 'string';
    const url = isBlob ? URL.createObjectURL(src) : (src.startsWith('/') || src.startsWith('blob:') ? src : '/' + src);
    const el = document.createElement('video');
    el.preload = 'metadata';
    const done = (v) => { if (isBlob) URL.revokeObjectURL(url); resolve(v); };
    el.onloadedmetadata = () => done(isFinite(el.duration) ? +el.duration.toFixed(2) : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

// Duração efetiva de uma cena: o áudio do take manda; senão o campo duration;
// senão 3s. start/end são SEMPRE derivados daqui — nunca editados à mão.
function sceneDuration(s) {
  if (s.audio?.duracaoSegundos > 0) return +s.audio.duracaoSegundos;
  if (+s.duration > 0) return +s.duration;
  return 3;
}

function relayoutScenes(scenes) {
  let t = 0;
  return (scenes || []).map((s) => {
    const dur = sceneDuration(s);
    const out = { ...s, duration: dur, start: +t.toFixed(2), end: +(t + dur).toFixed(2) };
    t += dur;
    return out;
  });
}

function bodyDuration(scenes) {
  return scenes?.length ? scenes[scenes.length - 1].end : 0;
}

// Normaliza o cfg depois de qualquer mutação: garante ids, re-sequencia as
// cenas e deriva narracao.duracaoSegundos da soma — EXCETO no fluxo legado
// (narração global limpa e nenhum take por cena), onde o áudio real é a
// fonte de verdade da duração do corpo e não deve ser sobrescrito.
function deriveCfg(cfg) {
  const scenes = relayoutScenes((cfg.scenes || []).map(s => s.id ? s : { ...s, id: newSceneId() }));
  const hasSceneAudio = scenes.some(s => s.audio?.src);
  const legacyGlobal = !hasSceneAudio && cfg.narracao?.limpo;
  const narracao = { raw: '', limpo: '', duracaoSegundos: 0, ...(cfg.narracao || {}) };
  if (!legacyGlobal) narracao.duracaoSegundos = bodyDuration(scenes);
  return { ...cfg, scenes, narracao };
}

// Hidrata um JSON vindo do disco: cenas antigas têm start/end mas não duration.
// Formatos verticais (lista/quiz/historia) não têm cenas/timeline — passam
// intactos (o ReelEditor edita os campos direto, sem derivar nada).
function hydrateCfg(raw) {
  if (raw.formato && raw.formato !== 'tutorial') return { ...raw };
  const cfg = { ...DEFAULT_TUTORIAL, ...raw };
  cfg.intro = { ...DEFAULT_TUTORIAL.intro, ...(raw.intro || {}) };
  cfg.outro = { ...DEFAULT_TUTORIAL.outro, ...(raw.outro || {}) };
  cfg.scenes = (raw.scenes || []).map(s => ({
    ...s,
    duration: +s.duration > 0 ? +s.duration : Math.max(0.5, +(((+s.end || 0) - (+s.start || 0))).toFixed(2)) || 3,
  }));
  return deriveCfg(cfg);
}

const DEFAULT_TUTORIAL = {
  formato: 'tutorial',
  tag: 'Tutorial',
  titulo: 'Novo tutorial',
  intro: { titulo: 'Lucas Santos', subtitulo: 'tutoriais de tech, direto ao ponto', duracao: 2.4 },
  outro: { cta: 'INSCREVA-SE', sub: 'toda semana, um tutorial novo', duracao: 3.2 },
  narracao: { raw: '', limpo: '', duracaoSegundos: 0 },
  scenes: [],
};

// Catálogo da galeria "+ nova cena". Agora é FILE-DRIVEN: vem dos manifests em
// templates/scenes/*/manifest.yaml via GET /api/scene-templates. Este array é só
// o FALLBACK embutido (usado offline ou se a rota falhar).
const SCENE_CATALOG_FALLBACK = [
  { id: 'camera-intro', name: 'Abertura (câmera)', desc: 'Você grande na tela + título ao lado', scene: { type: 'camera-intro', duration: 6 }, fields: [{ name: 'badge', label: 'badge', type: 'text' }, { name: 'titulo', label: 'título', type: 'text', default: 'Abertura' }, { name: 'subtitulo', label: 'subtítulo', type: 'text' }] },
  { id: 'passo', name: 'Passo', desc: 'Número grande + título', scene: { type: 'passo', duration: 4 }, fields: [{ name: 'numero', label: 'número', type: 'number', step: 1, default: 1 }, { name: 'total', label: 'total', type: 'number', step: 1, default: 5 }, { name: 'titulo', label: 'título', type: 'text', default: 'Título do passo' }, { name: 'subtitulo', label: 'subtítulo', type: 'text' }] },
  { id: 'codigo', name: 'Terminal', desc: 'Janela de terminal', scene: { type: 'codigo', duration: 6 }, fields: [{ name: 'titulo', label: 'título', type: 'text', mono: true, default: 'terminal' }, { name: 'linhas', label: 'linhas', type: 'list', default: [{ prompt: '$', texto: 'comando' }], item: [{ name: 'prompt', type: 'text', mono: true, width: 52, default: '$' }, { name: 'texto', type: 'text', mono: true }] }, { name: 'caption', label: 'legenda', type: 'text' }] },
  { id: 'video-desktop', name: 'Vídeo · PC', desc: 'Tela do computador em navegador', scene: { type: 'video', layout: 'desktop', duration: 5 }, fields: [{ name: 'url', label: 'URL na barra', type: 'text', mono: true }, { name: 'numero', label: 'nº do passo', type: 'number', step: 1 }, { name: 'caption', label: 'legenda', type: 'text' }] },
  { id: 'video-celular', name: 'Vídeo · Celular', desc: 'Tela do celular em mockup', scene: { type: 'video', layout: 'celular', duration: 5 }, fields: [{ name: 'badge', label: 'badge', type: 'text' }, { name: 'titulo', label: 'título', type: 'text' }, { name: 'texto', label: 'texto', type: 'textarea', rows: 2 }, { name: 'comando', label: 'comando', type: 'text', mono: true }] },
  { id: 'image-desktop', name: 'Print · PC', desc: 'Print do computador', scene: { type: 'image', layout: 'desktop', duration: 4 }, fields: [{ name: 'url', label: 'URL na barra', type: 'text', mono: true }, { name: 'numero', label: 'nº do passo', type: 'number', step: 1 }, { name: 'caption', label: 'legenda', type: 'text' }] },
  { id: 'image-celular', name: 'Print · Celular', desc: 'Print do celular', scene: { type: 'image', layout: 'celular', duration: 4 }, fields: [{ name: 'badge', label: 'badge', type: 'text' }, { name: 'titulo', label: 'título', type: 'text' }, { name: 'texto', label: 'texto', type: 'textarea', rows: 2 }, { name: 'comando', label: 'comando', type: 'text', mono: true }] },
  { id: 'callout', name: 'Destaque', desc: 'Mídia + caixa de destaque', scene: { type: 'image', layout: 'callout', duration: 4 }, fields: [{ name: 'highlight', label: 'destaque', type: 'group', default: { x: 200, y: 200, w: 400, h: 200 }, fields: [{ name: 'x', label: 'x', type: 'number', step: 10 }, { name: 'y', label: 'y', type: 'number', step: 10 }, { name: 'w', label: 'larg.', type: 'number', step: 10 }, { name: 'h', label: 'alt.', type: 'number', step: 10 }] }, { name: 'title', label: 'título da anotação', type: 'text', default: 'Destaque' }, { name: 'body', label: 'texto da anotação', type: 'textarea', rows: 2 }] },
  { id: 'raw', name: 'Sem moldura', desc: 'Mídia direta, sem mockup', scene: { type: 'video', layout: 'raw', duration: 5 }, fields: [{ name: 'caption', label: 'legenda', type: 'text' }] },
];

// make(): objeto-cena inicial = scene do manifesto + defaults dos fields.
function sceneFromTemplate(entry) {
  const s = { ...entry.scene };
  for (const f of (entry.fields || [])) if (f.default !== undefined && s[f.name] === undefined) s[f.name] = f.default;
  return s;
}

// Busca o catálogo file-driven (fallback embutido se offline/erro).
async function loadSceneCatalog() {
  try {
    const res = await fetch('/api/scene-templates');
    if (!res.ok) throw 0;
    const list = await res.json();
    if (Array.isArray(list) && list.length) return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch {}
  return SCENE_CATALOG_FALLBACK;
}

// Acha o template (manifesto) que corresponde a uma cena, por type+layout.
function templateForScene(catalog, s) {
  const layout = s.layout || (s.type === 'video' || s.type === 'image' ? 'desktop' : undefined);
  return (catalog || []).find(c => c.scene?.type === s.type && (c.scene?.layout || undefined) === layout)
    || (catalog || []).find(c => c.scene?.type === s.type);
}

const fmtSecs = (s) => (+s || 0).toFixed(1).replace(/\.0$/, '') + 's';
const fmtClock = (s) => {
  s = Math.max(0, +s || 0);
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
};

const SLUG_RE_UI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// consts de topo não atravessam evals separados (só declarações de função) —
// exporta explicitamente, no mesmo padrão do engine/reel-kit.jsx.
Object.assign(window, { DEFAULT_TUTORIAL, SCENE_CATALOG_FALLBACK, sceneFromTemplate, loadSceneCatalog, templateForScene, fmtSecs, fmtClock, SLUG_RE_UI });
