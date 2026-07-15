// templates/quiz.jsx — formato "quiz": gancho → pergunta → opções → contagem → resposta → CTA.
// Conteúdo em window.REEL_CONFIG. 2 a 4 opções (exatamente 1 com "correct": true).
// A pergunta aceita quebras de linha (\n no JSON); ~24 chars por linha.

const C = Object.assign({
  tag: 'Quiz',
  hook1: 'VOCÊ SABIA?',
  hookSub: '',
  question: '',
  options: [],
  reveal: '',
  ctaTitle: 'Acertou? Comenta aí.',
  handleSub: '',
}, window.REEL_CONFIG);

const OPTS = C.options.slice(0, 4);
const N_OPTS = OPTS.length;
// Linha do tempo (adapta ao nº de opções mantendo o ritmo do original de 3):
const T_OPTS = 3.0;
const T_COUNT = T_OPTS + 1.0 + N_OPTS * 0.4 + 3.2;   // fim das opções + tempo de leitura
const T_REVEAL = T_COUNT + 2.8;                        // contagem 3-2-1 (0.9s cada)
const T_CAPTION = T_REVEAL + 0.2;
const T_CTA = T_CAPTION + 2.1;
const DUR = +(T_CTA + 2.0).toFixed(2);

function QuizOptions() {
  const { localTime: rl } = useSprite(); // sprite começa em T_OPTS
  const revealAt = T_REVEAL - T_OPTS;
  const revealed = rl >= revealAt;
  const X = 150, W0 = 780, RH = 150, GAP = 34, Y = 865;
  const letters = ['A', 'B', 'C', 'D'];
  return (
    <div style={{ position: 'absolute', left: X, top: Y, width: W0, display: 'flex', flexDirection: 'column', gap: GAP }}>
      {OPTS.map((o, i) => {
        const appear = 0.2 + i * 0.4;
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
            display: 'flex', alignItems: 'center', gap: 30, height: RH, padding: '0 34px', boxSizing: 'border-box',
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

function Countdown() {
  const { localTime } = useSprite(); // dura ~2.8
  const n = Math.max(1, 3 - Math.floor(localTime / 0.9));
  const within = (localTime % 0.9) / 0.9;
  const s = 1.3 - 0.3 * Easing.easeOutCubic(clamp(within * 2, 0, 1));
  const o = 1 - clamp((within - 0.7) / 0.3, 0, 1);
  if (localTime > 2.7) return null;
  const y = 865 + N_OPTS * 184 + 130; // abaixo das opções
  return (
    <div style={{ position: 'absolute', left: 540, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity: o, fontFamily: BRAND.mono, fontSize: 150, fontWeight: 700, color: BRAND.red }}>{n}</div>
  );
}

function ReelQuiz() {
  const W = 1080, H = 1920;
  const endMain = DUR - 0.2;
  const capY = 865 + N_OPTS * 184 + 70;
  return (
    <Stage width={W} height={H} duration={DUR} background={BRAND.ink} persistKey="reel-quiz">
      <Backdrop />
      <TopBar tag={C.tag} />

      {/* GANCHO */}
      <Sprite start={0.1} end={2.3}>
        <TextSprite text={C.hook1} x={540} y={860} align="center" size={104} weight={700} color={BRAND.red} font={BRAND.mono} />
      </Sprite>
      {C.hookSub && <Sprite start={0.6} end={2.3}>
        <TextSprite text={C.hookSub} x={540} y={980} align="center" size={44} weight={500} color={BRAND.body} font={BRAND.sans} />
      </Sprite>}

      {/* PERGUNTA (persiste) */}
      <Sprite start={2.4} end={endMain}><Eyebrow text="// Pergunta" x={150} y={520} align="left" /></Sprite>
      <Sprite start={2.5} end={endMain}>
        <TextSprite text={C.question} x={150} y={555} size={74} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>

      {/* OPÇÕES + REVEAL */}
      <Sprite start={T_OPTS} end={endMain}><QuizOptions /></Sprite>

      {/* CONTAGEM */}
      <Sprite start={T_COUNT} end={T_COUNT + 2.8}><Countdown /></Sprite>

      {/* LEGENDA DA RESPOSTA */}
      {C.reveal && <Sprite start={T_CAPTION} end={T_CTA - 0.1}>
        <TextSprite text={C.reveal} x={540} y={capY} align="center" size={46} weight={600} color={BRAND.redSoft} font={BRAND.sans} />
      </Sprite>}

      {/* CTA */}
      <Sprite start={T_CTA} end={DUR}>
        <TextSprite text={C.ctaTitle} x={540} y={capY + 50} align="center" size={52} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>
      <Sprite start={T_CTA} end={DUR}><Handle sub={C.handleSub} y={capY + 180} /></Sprite>
    </Stage>
  );
}
// File-driven (por canal): se o projeto aponta um template de quiz e ele traz um
// `layout`, renderiza pelo interpretador temporal (engine/quiz-renderer.jsx). Sem
// `template`, cai no ReelQuiz inline acima — quizzes existentes ficam intactos.
const _quizTpl = C.template && (window.__QUIZ_TEMPLATES || []).find(t => t.id === C.template);
if (_quizTpl && Array.isArray(_quizTpl.layout) && _quizTpl.layout.length && typeof QuizFromTemplate === 'function') {
  window.__ReelComponent = () => <QuizFromTemplate cfg={C} template={_quizTpl} />;
} else {
  window.__ReelComponent = ReelQuiz;
}
