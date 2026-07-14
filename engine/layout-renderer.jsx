// layout-renderer.jsx — interpretador de layout declarativo (Fase 6).
// Carregado DEPOIS de animations.jsx e reel-kit.jsx (usa Sprite/useSprite/
// Easing/clamp/VideoSprite + BRAND/absAsset/BrowserFrame/PhoneFrame do window).
//
// Um template de cena (templates/scenes/<id>/manifest.yaml) pode trazer uma
// chave `layout:` — uma lista de NÓS que descrevem a moldura visual. Quando
// existe, o tutorial.jsx desenha a cena com <SceneRenderer> em vez do JSX
// embutido. Assim, acrescentar uma moldura nova = só um arquivo YAML.
//
// Nó: { type, x, y, w, h, if, anim, style, ...específicos }
//   type: text | image | video | rect | row | col | frame
//   x/y/w/h: posição absoluta no canvas 1920x1080 (px). Sem x/y = filho flex.
//   if: <campo> — só renderiza se scene[campo] for verdadeiro.
//   anim: pop | fade | none (default none) — animação de entrada/saída.
//   style: {} — mapeado para CSS (ver resolveStyle). Valores com $token vêm do tema.
// Bindings: em text/src/url, {campo} e {campo|fallback} viram scene[campo].

// Resolve $token (ex.: "$red", "1px solid $line") para valores do tema (BRAND).
function _tok(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/\$([a-zA-Z_]\w*)/g, (m, name) => (BRAND[name] != null ? BRAND[name] : m));
}

// Substitui {campo} e {campo|fallback} pelo valor da cena.
function resolveText(str, scene) {
  if (str == null) return '';
  return String(str).replace(/\{([^}|]+)(?:\|([^}]*))?\}/g, (m, key, fallback) => {
    const v = scene[key.trim()];
    return (v == null || v === '') ? (fallback != null ? fallback : '') : String(v);
  });
}

// Mapeia o objeto `style` do DSL para propriedades CSS, resolvendo tokens.
// Chaves conhecidas têm apelidos amigáveis; qualquer outra passa direto (CSS cru).
function resolveStyle(style = {}, extra = {}) {
  const s = {};
  const alias = {
    size: 'fontSize', weight: 'fontWeight', lineHeight: 'lineHeight',
    letterSpacing: 'letterSpacing', maxWidth: 'maxWidth', radius: 'borderRadius', padding: 'padding',
  };
  for (const k of Object.keys(style)) {
    const v = style[k];
    if (k === 'color') s.color = _tok(v);
    else if (k === 'bg') s.background = _tok(v);
    else if (k === 'border') s.border = _tok(v);
    else if (k === 'shadow') s.boxShadow = _tok(v);
    else if (k === 'font') s.fontFamily = v === 'sans' ? BRAND.sans : v === 'mono' ? BRAND.mono : _tok(v);
    else if (k === 'uppercase') { if (v) s.textTransform = 'uppercase'; }
    else if (k === 'align') s.textAlign = v;
    else if (k === 'fit') s.objectFit = v;
    else if (alias[k]) s[alias[k]] = _tok(v);
    else s[k] = _tok(v);
  }
  return Object.assign(s, extra);
}

// Animação de entrada/saída a partir do estado do Sprite (não é hook — recebe
// o contexto já lido). Reusa a mesma curva do Pop do reel-kit.
function entryStyle(anim, sprite) {
  if (!anim || anim === 'none') return {};
  const { localTime, duration } = sprite;
  const inDur = 0.42, exit = 0.28;
  const exitStart = Math.max(0, duration - exit);
  let o = clamp(localTime / (inDur * 0.6), 0, 1);
  if (localTime > exitStart) o *= 1 - clamp((localTime - exitStart) / exit, 0, 1);
  if (anim === 'fade') return { opacity: o, willChange: 'opacity' };
  // pop (default para qualquer valor não-none reconhecido)
  const inT = Easing.easeOutBack(clamp(localTime / inDur, 0, 1));
  return { opacity: o, transform: `scale(${0.7 + 0.3 * inT})`, transformOrigin: 'center', willChange: 'transform, opacity' };
}

// Caixa de posicionamento comum a todos os nós.
function boxStyle(node) {
  const b = {};
  if (node.x != null || node.y != null) {
    b.position = 'absolute';
    if (node.x != null) b.left = node.x;
    if (node.y != null) b.top = node.y;
  }
  if (node.w != null) b.width = node.w;
  if (node.h != null) b.height = node.h;
  return b;
}

// Renderiza um nó do layout. `start`/`end` são segundos absolutos do Stage
// (herdados da cena) — necessários para VideoSprite sincronizar com a janela.
function LayoutNode({ node, scene, start, end }) {
  const sprite = useSprite(); // sempre chamado (regra dos hooks), mesmo se não animar
  if (!node || typeof node !== 'object') return null;
  if (node.if && !scene[node.if]) return null;

  const entry = entryStyle(node.anim, sprite);
  const box = boxStyle(node);
  const kids = (node.children || []).map((c, i) => (
    <LayoutNode key={i} node={c} scene={scene} start={start} end={end} />
  ));

  switch (node.type) {
    case 'text': {
      const st = resolveStyle(node.style, box);
      return (
        <div style={{ fontFamily: BRAND.sans, color: BRAND.fg, whiteSpace: 'pre-wrap', ...st, ...entry }}>
          {resolveText(node.text, scene)}
        </div>
      );
    }
    case 'rect':
      return <div style={{ ...resolveStyle(node.style, box), ...entry }} />;
    case 'image': {
      const src = absAsset(resolveText(node.src, scene));
      const kb = node.kenBurns ? 1 + 0.06 * (sprite.progress || 0) : 1;
      return (
        <div style={{ overflow: 'hidden', borderRadius: node.radius || 0, ...resolveStyle(node.style, box), ...entry }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: node.fit || 'cover', display: 'block', transform: `scale(${kb})`, transformOrigin: 'center' }} />
        </div>
      );
    }
    case 'video': {
      const src = absAsset(resolveText(node.src, scene));
      return (
        <div style={{ overflow: 'hidden', borderRadius: node.radius || 0, ...resolveStyle(node.style, box), ...entry }}>
          <VideoSprite src={src} start={start} end={end} trimStart={node.trimStart || 0} loop={!!node.loop}
            style={{ width: '100%', height: '100%', objectFit: node.fit || 'cover' }} />
        </div>
      );
    }
    case 'row':
    case 'col': {
      const flex = {
        display: 'flex', flexDirection: node.type === 'row' ? 'row' : 'column',
        gap: node.gap != null ? node.gap : 0,
        alignItems: node.align || 'stretch',
        justifyContent: node.justify || 'flex-start',
      };
      return <div style={{ ...flex, ...resolveStyle(node.style, box), ...entry }}>{kids}</div>;
    }
    case 'frame': {
      if (node.kind === 'phone') {
        return (
          <div style={{ position: 'absolute', left: node.x || 0, top: node.y || 0, ...entry }}>
            <PhoneFrame>{kids}</PhoneFrame>
          </div>
        );
      }
      // browser (default): BrowserFrame já se posiciona sozinho (absoluto).
      return (
        <BrowserFrame url={resolveText(node.url, scene) || undefined}
          x={node.x != null ? node.x : undefined} y={node.y != null ? node.y : undefined}
          w={node.w != null ? node.w : undefined} h={node.h != null ? node.h : undefined}>
          {kids}
        </BrowserFrame>
      );
    }
    default:
      return null; // nó desconhecido: ignora silenciosamente (fallback seguro)
  }
}

// Ponto de entrada: envolve o layout num Sprite (janela [start,end] da cena) e
// desenha cada nó de topo. `scene` são os dados da cena (project.json).
function SceneRenderer({ layout, scene, start, end }) {
  return (
    <Sprite start={start} end={end}>
      {(layout || []).map((node, i) => (
        <LayoutNode key={i} node={node} scene={scene} start={start} end={end} />
      ))}
    </Sprite>
  );
}

Object.assign(window, { SceneRenderer, LayoutNode, resolveText, resolveStyle });
