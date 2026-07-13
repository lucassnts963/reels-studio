// reel-kit.jsx — shared brand kit for the elucas.dev Reels.
// Loads AFTER animations.jsx, so Stage/Sprite/useSprite/Easing/clamp are on window.
// Assigns brand tokens + small presentational helpers to window.

const BRAND = {
  ink: '#0C0C0F', card: '#16161A', red: '#E5484D', redSoft: '#F08A8D',
  tint: 'rgba(229,72,77,0.12)', tintBorder: 'rgba(229,72,77,0.30)',
  fg: '#ECECEF', body: '#B4B4BC', mute: '#87878F', line: 'rgba(255,255,255,0.09)',
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

// Persistent dark backdrop: dot grid + red glow. Place as a direct (untimed) child of Stage.
function Backdrop({ glow = true, grid = 'dots' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: grid === 'cells'
          ? 'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)'
          : 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)',
        backgroundSize: grid === 'cells' ? '120px 66px' : '42px 42px',
      }} />
      {glow && <div style={{
        position: 'absolute', left: '50%', top: -280, transform: 'translateX(-50%)',
        width: 940, height: 660, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(229,72,77,.18), transparent 70%)',
      }} />}
    </div>
  );
}

// Persistent top bar: brand mark (left) + section tag (right). Untimed child of Stage.
function TopBar({ tag }) {
  return (
    <div style={{
      position: 'absolute', top: 92, left: 96, right: 96,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontFamily: BRAND.mono,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, color: BRAND.fg, fontWeight: 600, fontSize: 32, letterSpacing: '.01em' }}>
        <span style={{ width: 17, height: 17, borderRadius: '50%', background: BRAND.red, display: 'inline-block' }} />elucas.dev
      </div>
      <div style={{ color: BRAND.red, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 26 }}>{tag}</div>
    </div>
  );
}

// Bottom handle / CTA line. Untimed or timed.
function Handle({ sub, y = 1690 }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: BRAND.mono }}>
      <div style={{ color: BRAND.fg, fontSize: 40, fontWeight: 600 }}>@elucas.dev</div>
      {sub && <div style={{ color: BRAND.mute, fontSize: 27, marginTop: 12 }}>{sub}</div>}
    </div>
  );
}

// A physical-looking keycap for shortcuts.
function Keycap({ label, size = 66 }) {
  return (
    <span style={{
      display: 'inline-block', fontFamily: BRAND.mono, fontWeight: 700, fontSize: size,
      color: BRAND.fg, background: BRAND.card, border: '1px solid rgba(255,255,255,.16)',
      borderRadius: 16, padding: '16px 30px',
      boxShadow: '0 8px 0 rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.06)',
    }}>{label}</span>
  );
}

// Pop: springy entry + fade-out near the sprite's end. Absolute-positioned; anchor via align/vAlign.
function Pop({ children, x, y, align = 'center', vAlign = 'middle', inDur = 0.42, exit = 0.28 }) {
  const { localTime, duration } = useSprite();
  const inT = Easing.easeOutBack(clamp(localTime / inDur, 0, 1));
  let o = clamp(localTime / (inDur * 0.6), 0, 1);
  const exitStart = Math.max(0, duration - exit);
  if (localTime > exitStart) o *= 1 - clamp((localTime - exitStart) / exit, 0, 1);
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  const ty = vAlign === 'middle' ? '-50%' : vAlign === 'bottom' ? '-100%' : '0';
  const s = 0.7 + 0.3 * inT;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tx}, ${ty}) scale(${s})`, transformOrigin: 'center', opacity: o, willChange: 'transform, opacity' }}>
      {children}
    </div>
  );
}

// Eyebrow label (mono, red, tracked). Use inside a Sprite.
function Eyebrow({ text, x = 540, y = 560, align = 'center' }) {
  return (
    <Pop x={x} y={y} align={align} vAlign="top">
      <div style={{ fontFamily: BRAND.mono, fontSize: 34, fontWeight: 600, letterSpacing: '.24em', textTransform: 'uppercase', color: BRAND.red, whiteSpace: 'nowrap' }}>{text}</div>
    </Pop>
  );
}

Object.assign(window, { BRAND, Backdrop, TopBar, Handle, Keycap, Pop, Eyebrow });
