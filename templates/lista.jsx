// templates/lista.jsx — formato "lista": gancho → itens → CTA.
// Conteúdo vem de window.REEL_CONFIG (JSON em content/<slug>.json).
// Limites: hook ~22 chars/linha · item.text ~28 chars · badge ~12 chars · 3 a 7 itens.

const C = Object.assign({
  tag: '',
  hook1: '',
  hook2: '',
  hookSub: '',
  items: [],
  ctaTitle: '',
  ctaSub: '',
  handleSub: '',
  grid: 'cells',
}, window.REEL_CONFIG);

function ListaItem({ start, n, total, badge, text }) {
  const end = start + 1.7;
  const size = badge.length > 10 ? 56 : badge.length > 7 ? 66 : 80;
  return (
    <React.Fragment>
      <Sprite start={start} end={end}>
        <Pop x={540} y={620} inDur={0.3}>
          <div style={{ fontFamily: BRAND.mono, fontSize: 30, fontWeight: 600, letterSpacing: '.2em', color: BRAND.red }}>{n} / {total}</div>
        </Pop>
      </Sprite>
      <Sprite start={start + 0.04} end={end}>
        <Pop x={540} y={880}><Keycap label={badge} size={size} /></Pop>
      </Sprite>
      <Sprite start={start + 0.22} end={end}>
        <TextSprite text={text} x={540} y={1060} align="center" size={52} weight={600} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>
    </React.Fragment>
  );
}

function ReelLista() {
  const W = 1080, H = 1920;
  const items = C.items.slice(0, 7);
  const t0 = 2.6, step = 1.7;
  const DUR = +(t0 + items.length * step + 2.5).toFixed(2);
  return (
    <Stage width={W} height={H} duration={DUR} background={BRAND.ink} persistKey="reel-lista">
      <Backdrop grid={C.grid} />
      <TopBar tag={C.tag} />

      {/* GANCHO */}
      <Sprite start={0.1} end={t0}>
        <TextSprite text={C.hook1} x={540} y={820} align="center" size={86} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>
      <Sprite start={0.5} end={t0}>
        <TextSprite text={C.hook2} x={540} y={940} align="center" size={64} weight={600} color={BRAND.red} font={BRAND.mono} />
      </Sprite>
      {C.hookSub && <Sprite start={1.0} end={t0}>
        <TextSprite text={C.hookSub} x={540} y={1080} align="center" size={36} weight={500} color={BRAND.mute} font={BRAND.mono} />
      </Sprite>}

      {/* ITENS */}
      {items.map((it, i) => (
        <ListaItem key={i} start={t0 + i * step} n={i + 1} total={items.length} badge={it.badge || String(i + 1)} text={it.text} />
      ))}

      {/* CTA */}
      <Sprite start={t0 + items.length * step + 0.1} end={DUR}>
        <TextSprite text={C.ctaTitle} x={540} y={830} align="center" size={70} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>
      <Sprite start={t0 + items.length * step + 0.4} end={DUR}>
        <TextSprite text={C.ctaSub} x={540} y={940} align="center" size={40} weight={500} color={BRAND.body} font={BRAND.sans} />
      </Sprite>
      <Sprite start={t0 + items.length * step + 0.6} end={DUR}><Handle sub={C.handleSub} /></Sprite>
    </Stage>
  );
}
window.__ReelComponent = ReelLista;
