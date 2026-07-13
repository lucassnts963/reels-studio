// templates/historia.jsx — formato "história": gancho → seções (problema → método → resultado) → CTA.
// Conteúdo em window.REEL_CONFIG:
//   hook: { line1, line2, punch }            — punch é a linha vermelha (mono)
//   sections: [{ eyebrow, title, body, punch, widget }]  — 2 a 4 seções
//     widget (opcional): { type: 'flow', chips: ['A','B','C'] }   — chips com setas
//                        { type: 'stats', rows: [['PWA','no ar'], ...] } — linhas número+texto
//     (seção com widget 'stats' não usa title/body)
//   cta: { top, title }                        — top é a linha mono acima do título
//   handleSub

const C = Object.assign({
  tag: '',
  hook: {},
  sections: [],
  cta: {},
  handleSub: '',
}, window.REEL_CONFIG);

const SECTIONS = C.sections.slice(0, 4);
const T_HOOK = 3.7, STEP = 3.9;
const T_CTA = T_HOOK + SECTIONS.length * STEP;
const DUR = +(T_CTA + 2.3).toFixed(2);

function FlowWidget({ chips }) {
  const { localTime } = useSprite();
  const chip = (label, appear) => {
    const o = clamp((localTime - appear) / 0.4, 0, 1);
    const s = Easing.easeOutBack(clamp((localTime - appear) / 0.45, 0, 1));
    return (
      <div style={{
        fontFamily: BRAND.mono, fontSize: 40, fontWeight: 600, color: BRAND.fg,
        background: BRAND.card, border: '1px solid ' + BRAND.line, borderRadius: 14,
        padding: '22px 30px', opacity: o, transform: `scale(${0.8 + 0.2 * s})`, transformOrigin: 'center',
      }}>{label}</div>
    );
  };
  const arrow = (appear) => {
    const o = clamp((localTime - appear) / 0.3, 0, 1);
    return <div style={{ color: BRAND.red, fontSize: 44, fontWeight: 700, opacity: o }}>→</div>;
  };
  return (
    <div style={{ position: 'absolute', left: 96, right: 96, top: 1080, display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      {chips.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && arrow(i * 0.5 - 0.15)}
          {chip(c, i * 0.5)}
        </React.Fragment>
      ))}
    </div>
  );
}

function StatsWidget({ rows }) {
  const { localTime } = useSprite();
  return (
    <div style={{ position: 'absolute', left: 96, right: 96, top: 760, display: 'flex', flexDirection: 'column', gap: 26 }}>
      {rows.map((r, i) => {
        const appear = 0.25 + i * 0.55;
        const o = clamp((localTime - appear) / 0.4, 0, 1);
        const x = (1 - Easing.easeOutCubic(clamp((localTime - appear) / 0.5, 0, 1))) * 40;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'baseline', gap: 26, opacity: o, transform: `translateX(${x}px)`,
            borderBottom: '1px solid ' + BRAND.line, paddingBottom: 22,
          }}>
            <div style={{ fontFamily: BRAND.mono, fontSize: 76, fontWeight: 700, color: BRAND.red, lineHeight: 1, minWidth: 320 }}>{r[0]}</div>
            <div style={{ fontFamily: BRAND.sans, fontSize: 38, color: BRAND.body }}>{r[1]}</div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ start, end, s }) {
  const titleLines = s.title ? s.title.split('\n').length : 0;
  const bodyY = 740 + titleLines * 80 + 30;
  const punchY = s.body ? bodyY + 90 : bodyY;
  return (
    <React.Fragment>
      {s.eyebrow && <Sprite start={start + 0.1} end={end}><Eyebrow text={s.eyebrow} x={120} y={640} align="left" /></Sprite>}
      {s.title && <Sprite start={start + 0.3} end={end}>
        <TextSprite text={s.title} x={120} y={740} size={72} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>}
      {s.body && <Sprite start={start + 1.4} end={end}>
        <TextSprite text={s.body} x={120} y={bodyY} size={44} weight={500} color={BRAND.body} font={BRAND.sans} />
      </Sprite>}
      {s.punch && <Sprite start={start + 2.2} end={end}>
        <TextSprite text={s.punch} x={120} y={punchY} size={50} weight={600} color={BRAND.red} font={BRAND.mono} />
      </Sprite>}
      {s.widget && s.widget.type === 'flow' && <Sprite start={start + 1.6} end={end}><FlowWidget chips={s.widget.chips} /></Sprite>}
      {s.widget && s.widget.type === 'stats' && <Sprite start={start + 0.3} end={end}><StatsWidget rows={s.widget.rows} /></Sprite>}
    </React.Fragment>
  );
}

function ReelHistoria() {
  const W = 1080, H = 1920;
  const ctaLines = (C.cta.title || '').split('\n').length;
  return (
    <Stage width={W} height={H} duration={DUR} background={BRAND.ink} persistKey="reel-historia">
      <Backdrop />
      <TopBar tag={C.tag} />

      {/* GANCHO */}
      {C.hook.line1 && <Sprite start={0.1} end={T_HOOK}>
        <TextSprite text={C.hook.line1} x={120} y={740} size={112} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>}
      {C.hook.line2 && <Sprite start={0.65} end={T_HOOK}>
        <TextSprite text={C.hook.line2} x={120} y={868} size={112} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>}
      {C.hook.punch && <Sprite start={1.9} end={T_HOOK}>
        <TextSprite text={C.hook.punch} x={120} y={1040} size={48} weight={600} color={BRAND.red} font={BRAND.mono} />
      </Sprite>}

      {/* SEÇÕES */}
      {SECTIONS.map((s, i) => (
        <Section key={i} s={s} start={T_HOOK + i * STEP} end={T_HOOK + (i + 1) * STEP - 0.1} />
      ))}

      {/* CTA */}
      {C.cta.top && <Sprite start={T_CTA + 0.1} end={DUR}>
        <TextSprite text={C.cta.top} x={540} y={780} size={64} weight={700} color={BRAND.mute} font={BRAND.mono} align="center" />
      </Sprite>}
      {C.cta.title && <Sprite start={T_CTA + 0.4} end={DUR}>
        <TextSprite text={C.cta.title} x={540} y={880} size={72} weight={700} color={BRAND.fg} font={BRAND.sans} align="center" />
      </Sprite>}
      <Sprite start={T_CTA + 1.1} end={DUR}><Handle sub={C.handleSub} /></Sprite>
    </Stage>
  );
}
window.__ReelComponent = ReelHistoria;
