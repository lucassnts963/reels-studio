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

// Catálogo da galeria "+ nova cena": um card por combinação tipo/layout.
const SCENE_CATALOG = [
  { key: 'camera-intro', name: 'Abertura (câmera)', desc: 'Você grande na tela + título ao lado — abertura talking-head', make: () => ({ type: 'camera-intro', badge: '', titulo: 'Abertura', subtitulo: '', duration: 6 }) },
  { key: 'passo', name: 'Passo', desc: 'Cartão de transição: número grande + título', make: () => ({ type: 'passo', numero: 1, total: 5, titulo: 'Título do passo', subtitulo: '', duration: 4 }) },
  { key: 'codigo', name: 'Terminal', desc: 'Janela de terminal com comandos', make: () => ({ type: 'codigo', titulo: 'terminal', linhas: [{ prompt: '$', texto: 'comando' }], caption: '', duration: 6 }) },
  { key: 'video-desktop', name: 'Vídeo · PC', desc: 'Gravação de tela do computador em janela de navegador', make: () => ({ type: 'video', layout: 'desktop', src: '', url: '', caption: '', duration: 5 }) },
  { key: 'video-celular', name: 'Vídeo · Celular', desc: 'Gravação de tela do celular em mockup de telefone', make: () => ({ type: 'video', layout: 'celular', src: '', badge: '', titulo: '', texto: '', duration: 5 }) },
  { key: 'image-desktop', name: 'Print · PC', desc: 'Print de tela do computador em janela de navegador', make: () => ({ type: 'image', layout: 'desktop', src: '', url: '', caption: '', duration: 4 }) },
  { key: 'image-celular', name: 'Print · Celular', desc: 'Print de tela do celular em mockup de telefone', make: () => ({ type: 'image', layout: 'celular', src: '', badge: '', titulo: '', texto: '', duration: 4 }) },
  { key: 'callout', name: 'Destaque', desc: 'Mídia em tela cheia + caixa de destaque e anotação', make: () => ({ type: 'image', layout: 'callout', src: '', highlight: { x: 200, y: 200, w: 400, h: 200 }, title: 'Destaque', body: '', duration: 4 }) },
  { key: 'raw', name: 'Sem moldura', desc: 'Mídia direta, sem mockup, com legenda opcional', make: () => ({ type: 'video', layout: 'raw', src: '', caption: '', duration: 5 }) },
];

const fmtSecs = (s) => (+s || 0).toFixed(1).replace(/\.0$/, '') + 's';
const fmtClock = (s) => {
  s = Math.max(0, +s || 0);
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
};

const SLUG_RE_UI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// consts de topo não atravessam evals separados (só declarações de função) —
// exporta explicitamente, no mesmo padrão do engine/reel-kit.jsx.
Object.assign(window, { DEFAULT_TUTORIAL, SCENE_CATALOG, fmtSecs, fmtClock, SLUG_RE_UI });
