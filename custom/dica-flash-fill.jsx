// reel3.jsx — "Dica do dia": Preenchimento Relâmpago (Ctrl+E). 15s, with a mini demo.

function FlashFillDemo() {
  const { localTime: dt } = useSprite();
  const rows = [['João Silva', 'João', 3.0], ['Maria Souza', 'Maria', 3.3], ['Ana Lima', 'Ana', 3.6]];
  const AW = 470, BW = 300, RH = 108, X = 155, Y = 720;

  const typed = (full, s, e) => full.slice(0, Math.round(full.length * clamp((dt - s) / (e - s), 0, 1)));
  const b1 = typed('João', 0.7, 1.9);
  const caretOn = dt >= 0.7 && dt < 2.1 && Math.floor(dt * 2) % 2 === 0;
  const flash = dt >= 2.2 && dt <= 3.1;

  const headerCell = (label, w, accent) => (
    <div style={{ width: w, height: 74, display: 'flex', alignItems: 'center', paddingLeft: 26, boxSizing: 'border-box', fontFamily: BRAND.mono, fontSize: 30, fontWeight: 600, color: accent ? BRAND.redSoft : BRAND.mute, background: accent ? BRAND.tint : '#101014', borderBottom: '1px solid ' + BRAND.line, borderRight: '1px solid ' + BRAND.line }}>{label}</div>
  );
  const cell = (text, w, opts = {}) => (
    <div style={{ width: w, height: RH, display: 'flex', alignItems: 'center', paddingLeft: 26, boxSizing: 'border-box', fontFamily: BRAND.sans, fontSize: 42, color: BRAND.fg, background: opts.bg || 'transparent', borderBottom: '1px solid ' + BRAND.line, borderRight: '1px solid ' + BRAND.line, transition: 'none' }}>
      {text}{opts.caret ? <span style={{ display: 'inline-block', width: 3, height: 46, background: BRAND.red, marginLeft: 4 }} /> : null}
    </div>
  );

  return (
    <div style={{ position: 'absolute', left: X, top: Y, width: AW + BW, borderTop: '1px solid ' + BRAND.line, borderLeft: '1px solid ' + BRAND.line, borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
      <div style={{ display: 'flex' }}>{headerCell('Nome completo', AW)}{headerCell('Nome', BW, true)}</div>
      {rows.map((r, i) => {
        const appear = r[2];
        let bText = '', bg = 'transparent';
        if (i === 0) { bText = b1; if (caretOn) return (<div key={i} style={{ display: 'flex' }}>{cell(r[0], AW)}{cell(b1, BW, { caret: true })}</div>); }
        else {
          const p = clamp((dt - appear) / 0.35, 0, 1);
          bText = p > 0.15 ? r[1] : '';
          const hl = 1 - clamp((dt - appear) / 1.1, 0, 1);
          bg = `rgba(229,72,77,${0.22 * hl})`;
        }
        return (<div key={i} style={{ display: 'flex' }}>{cell(r[0], AW)}{cell(bText, BW, { bg })}</div>);
      })}
      {flash && (
        <div style={{ position: 'absolute', right: -30, top: RH + 40, transform: 'translateX(100%)' }} />
      )}
    </div>
  );
}

function Reel3() {
  const W = 1080, H = 1920;
  return (
    <Stage width={W} height={H} duration={15} background={BRAND.ink} persistKey="reel3">
      <Backdrop grid="cells" />
      <TopBar tag="Dica do dia" />

      {/* HOOK 0–2.4 */}
      <Sprite start={0.1} end={14.8}><Eyebrow text="// Excel · atalho Ctrl+E" x={155} y={470} align="left" /></Sprite>
      <Sprite start={0.35} end={14.8}>
        <TextSprite text={"O Excel adivinha\no que você quer."} x={155} y={540} size={78} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>

      {/* DEMO 2.4–10.2 */}
      <Sprite start={2.4} end={10.2}><FlashFillDemo /></Sprite>
      <Sprite start={2.3} end={3.3}>
        <Pop x={720} y={1120}><Keycap label="Ctrl + E" size={64} /></Pop>
      </Sprite>
      <Sprite start={2.5} end={3.4}>
        <TextSprite text="digite o 1º e aperte →" x={720} y={1240} align="center" size={34} weight={500} color={BRAND.mute} font={BRAND.mono} />
      </Sprite>
      <Sprite start={4.2} end={10.2}>
        <TextSprite text="Ele completa o resto sozinho." x={540} y={1230} align="center" size={46} weight={600} color={BRAND.redSoft} font={BRAND.sans} />
      </Sprite>

      {/* PAYOFF 10.4–12.6 */}
      <Sprite start={10.4} end={12.7}>
        <TextSprite text="Separar nome, e-mail, telefone…" x={540} y={840} align="center" size={48} weight={500} color={BRAND.body} font={BRAND.sans} />
      </Sprite>
      <Sprite start={10.6} end={12.7}>
        <TextSprite text="tudo em 1 segundo." x={540} y={930} align="center" size={72} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>

      {/* CTA 12.8–15 */}
      <Sprite start={12.9} end={15}>
        <TextSprite text="Salva pra usar hoje." x={540} y={870} align="center" size={70} weight={700} color={BRAND.fg} font={BRAND.sans} />
      </Sprite>
      <Sprite start={13.2} end={15}><Handle sub="1 dica de informática por dia." /></Sprite>
    </Stage>
  );
}
window.Reel3 = Reel3;

window.__ReelComponent = Reel3;
