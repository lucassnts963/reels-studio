// quiz-renderer.jsx — interpretador de layout TEMPORAL para o formato quiz.
// Carregado DEPOIS de animations.jsx, reel-kit.jsx e layout-renderer.jsx (usa
// Stage/Sprite/useSprite/Easing/clamp + BRAND/Backdrop/TopBar/Handle/Eyebrow +
// LayoutNode/resolveText/resolveStyle da Fase 6).
//
// Um template de quiz (templates/quiz/<id>/manifest.yaml) traz uma lista `layout`
// de nós, cada um numa FASE (hook, question, options, countdown, reveal, cta). A
// fase vira uma janela [start,end] no tempo, calculada a partir de `timeline` +
// nº de opções — a mesma matemática do templates/quiz.jsx. Nós genéricos (text/
// image/rect/row/col) reusam o LayoutNode; nós especiais (options/countdown/
// handle) portam o comportamento do quiz.jsx. Assim, um layout novo = só YAML.

// Ritmo padrão (idêntico ao quiz.jsx). O manifesto pode sobrescrever qualquer knob.
const QUIZ_TIMELINE_DEFAULT = {
  hookIn: 0.1, hookOut: 2.3, hookSubIn: 0.6,
  questionEyebrow: 2.4, question: 2.5,
  options: 3.0, optStagger: 0.4, optAppear: 0.2, read: 1.0,
  countdown: 2.8, revealHold: 2.1, cta: 2.0,
};

// Geometria das opções (idêntica ao quiz.jsx): altura 150 + gap 34 = 184/opção.
const OPT_RH = 150, OPT_GAP = 34, OPT_STEP = OPT_RH + OPT_GAP; // 184
const OPT_Y = 865;

// Calcula as janelas de fase e âncoras dinâmicas a partir do timeline + nº opções.
// Espelha os T_* do quiz.jsx para manter o ritmo (e a paridade do template classico).
function computeQuiz(cfg, tl, optionsTop = OPT_Y) {
  const nOpts = Math.min(4, (cfg.options || []).length);
  const T_OPTS = tl.options;                                   // início das opções
  const T_COUNT = T_OPTS + tl.read + nOpts * tl.optStagger + 3.2; // fim opções + leitura
  const T_REVEAL = T_COUNT + tl.countdown;                     // após a contagem 3-2-1
  const T_CAPTION = T_REVEAL + 0.2;
  const T_CTA = T_CAPTION + tl.revealHold;
  const DUR = +(T_CTA + tl.cta).toFixed(2);
  const endMain = DUR - 0.2;

  const phases = {
    hook: [tl.hookIn, tl.hookOut],
    question: [tl.question, endMain],
    options: [T_OPTS, endMain],
    countdown: [T_COUNT, T_COUNT + tl.countdown],
    reveal: [T_CAPTION, T_CTA - 0.1],
    cta: [T_CTA, DUR],
  };
  // reveal das opções (relativo ao início da fase options), usado pelo nó options.
  const optionsRevealAt = T_REVEAL - T_OPTS;

  const afterOptions = optionsTop + nOpts * OPT_STEP;
  const anchors = {
    centerX: 540, optionsY: optionsTop, afterOptions,
    captionY: afterOptions + 70, countdownY: afterOptions + 130,
    ctaY: afterOptions + 120, handleY: afterOptions + 250,
  };
  return { nOpts, phases, anchors, optionsRevealAt, DUR, T_OPTS };
}

// Resolve uma coordenada: número → número; "nome" → âncora; "nome+N"/"nome-N" →
// âncora com deslocamento; número-string → número.
function resolveCoord(v, anchors) {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const m = s.match(/^([a-zA-Z_]\w*)\s*([+-]\s*\d+(?:\.\d+)?)?$/);
  if (m && anchors[m[1]] != null) {
    const base = anchors[m[1]];
    return m[2] ? base + parseFloat(m[2].replace(/\s+/g, '')) : base;
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
}

// ── Nós especiais ────────────────────────────────────────────────────────────

// Opções: aparição escalonada + destaque da correta + esmaecer as outras no reveal.
// Portado de QuizOptions (quiz.jsx); posição/largura vêm do nó, cores do tema.
function QuizOptionsNode({ cfg, node, revealAt }) {
  const { localTime: rl } = useSprite(); // a fase options começa em T_OPTS
  const tl = node._tl;
  const opts = (cfg.options || []).slice(0, 4);
  const revealed = rl >= revealAt;
  const X = node._x != null ? node._x : 150, Y = node._y != null ? node._y : OPT_Y;
  const W = node._w != null ? node._w : 780;
  const letters = ['A', 'B', 'C', 'D'];
  return (
    <div style={{ position: 'absolute', left: X, top: Y, width: W, display: 'flex', flexDirection: 'column', gap: OPT_GAP }}>
      {opts.map((o, i) => {
        const appear = tl.optAppear + i * tl.optStagger;
        const inP = clamp((rl - appear) / 0.45, 0, 1);
        const x = (1 - Easing.easeOutCubic(inP)) * 60;
        let bg = BRAND.card, border = BRAND.line, letterColor = BRAND.red, textColor = BRAND.fg, opacity = inP;
        if (revealed) {
          if (o.correct) { bg = BRAND.tint; border = BRAND.tintBorder; letterColor = '#fff'; }
          else { opacity = inP * 0.32; }
        }
        const pulse = revealed && o.correct ? 1 + 0.02 * Math.sin((rl - revealAt) * 6) : 1;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 30, height: OPT_RH, padding: '0 34px', boxSizing: 'border-box',
            background: bg, border: '1px solid ' + border, borderRadius: 18,
            opacity, transform: `translateX(${x}px) scale(${pulse})`, transformOrigin: 'left center',
          }}>
            <div style={{ fontFamily: BRAND.mono, fontSize: 54, fontWeight: 700, color: letterColor, width: 60 }}>{letters[i]}</div>
            <div style={{ fontFamily: BRAND.sans, fontSize: 60, fontWeight: 600, color: textColor, flex: 1 }}>{o.text}</div>
            {revealed && o.correct && <div style={{ fontFamily: BRAND.sans, fontSize: 64, color: BRAND.red, fontWeight: 700 }}>✓</div>}
          </div>
        );
      })}
    </div>
  );
}

// Contagem 3-2-1 (portado de Countdown). Posição vem do nó (default centro/âncora).
function QuizCountdownNode({ node }) {
  const { localTime } = useSprite();
  const n = Math.max(1, 3 - Math.floor(localTime / 0.9));
  const within = (localTime % 0.9) / 0.9;
  const s = 1.3 - 0.3 * Easing.easeOutCubic(clamp(within * 2, 0, 1));
  const o = 1 - clamp((within - 0.7) / 0.3, 0, 1);
  if (localTime > 2.7) return null;
  const X = node._x != null ? node._x : 540, Y = node._y != null ? node._y : 1200;
  return (
    <div style={{ position: 'absolute', left: X, top: Y, transform: `translate(-50%,-50%) scale(${s})`, opacity: o, fontFamily: BRAND.mono, fontSize: 150, fontWeight: 700, color: BRAND.red }}>{n}</div>
  );
}

// ── Renderer ─────────────────────────────────────────────────────────────────

// Um nó do layout, já com fase → janela [start,end] e coords resolvidas.
function QuizNode({ cfg, node, start, end, optionsRevealAt }) {
  const delay = +node.delay || 0;
  const s = start + delay;
  if (node.type === 'options') {
    return <Sprite start={s} end={end}><QuizOptionsNode cfg={cfg} node={node} revealAt={optionsRevealAt} /></Sprite>;
  }
  if (node.type === 'countdown') {
    return <Sprite start={s} end={end}><QuizCountdownNode node={node} /></Sprite>;
  }
  if (node.type === 'handle') {
    return <Sprite start={s} end={end}><Handle sub={cfg.handleSub} y={node._y != null ? node._y : 1690} /></Sprite>;
  }
  if (node.type === 'eyebrow') {
    return <Sprite start={s} end={end}><Eyebrow text={resolveText(node.text, cfg)} x={node._x != null ? node._x : 540} y={node._y != null ? node._y : 560} align={node.align || 'left'} /></Sprite>;
  }
  // nós genéricos (text/image/rect/row/col): reusa o LayoutNode da Fase 6.
  const gnode = { ...node, x: node._x, y: node._y, w: node._w, h: node._h };
  return <Sprite start={s} end={end}><LayoutNode node={gnode} scene={cfg} start={s} end={end} /></Sprite>;
}

// Componente-topo: monta o Stage do quiz a partir do template declarativo.
function QuizFromTemplate({ cfg, template }) {
  const tl = Object.assign({}, QUIZ_TIMELINE_DEFAULT, template.timeline || {});
  // âncoras (reveal/cta/countdown) seguem o topo real das opções, se o template
  // mover o bloco `options`. y numérico direto; senão o default OPT_Y.
  const optNode = (template.layout || []).find(n => n.type === 'options');
  const optionsTop = optNode && isFinite(+optNode.y) ? +optNode.y : OPT_Y;
  const { phases, anchors, optionsRevealAt, DUR } = computeQuiz(cfg, tl, optionsTop);
  const nodes = (template.layout || []).map((node) => {
    const [start, end] = phases[node.phase] || phases.question;
    return {
      node: { ...node, _tl: tl, _x: resolveCoord(node.x, anchors), _y: resolveCoord(node.y, anchors), _w: resolveCoord(node.w, anchors), _h: resolveCoord(node.h, anchors) },
      start, end,
    };
  });
  return (
    <Stage width={1080} height={1920} duration={DUR} background={BRAND.ink} persistKey="reel-quiz">
      {template.backdrop !== false && <Backdrop />}
      {template.topbar !== false && <TopBar tag={cfg.tag} />}
      {nodes.map((n, i) => (
        <QuizNode key={i} cfg={cfg} node={n.node} start={n.start} end={n.end} optionsRevealAt={optionsRevealAt} />
      ))}
    </Stage>
  );
}

Object.assign(window, { QuizFromTemplate, computeQuiz });
