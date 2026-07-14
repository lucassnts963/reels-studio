// reel-kit.jsx — shared brand kit for the elucas.dev Reels.
// Loads AFTER animations.jsx, so Stage/Sprite/useSprite/Easing/clamp are on window.
// Assigns brand tokens + small presentational helpers to window.

// Tokens da marca. Os valores abaixo são o DEFAULT (tema "elucas"); o player
// injeta window.__THEME (JSON de themes/<id>/theme.yaml) e sobrescreve o que
// vier — sem tema, nada muda. handle/handleAt são as strings de rodapé/topo.
const THEME_DEFAULT = {
  ink: '#0C0C0F', card: '#16161A', red: '#E5484D', redSoft: '#F08A8D',
  tint: 'rgba(229,72,77,0.12)', tintBorder: 'rgba(229,72,77,0.30)',
  fg: '#ECECEF', body: '#B4B4BC', mute: '#87878F', line: 'rgba(255,255,255,0.09)',
  glow: 'rgba(229,72,77,0.18)',
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  handle: 'elucas.dev', handleAt: '@elucas.dev', grid: 'dots',
};
const _T = (typeof window !== 'undefined' && window.__THEME) || {};
const BRAND = Object.assign({}, THEME_DEFAULT, _T.colors, _T.fonts, {
  handle: _T.brand?.handle ?? THEME_DEFAULT.handle,
  handleAt: _T.brand?.handleAt ?? THEME_DEFAULT.handleAt,
  grid: _T.backdrop?.grid ?? THEME_DEFAULT.grid,
});

// Resolve um caminho de asset para URL do servidor. Caminhos novos são
// relativos ao projeto ("assets/gravacoes/foo.mp4") e usam __ASSET_BASE
// (/projects/<slug>/, injetado pelo player). Caminhos legados por-tipo
// ("gravacoes/<slug>/...", "out/...") continuam servidos da raiz.
function absAsset(src) {
  if (!src) return src;
  if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('http')) return src;
  if (/^(gravacoes|prints|narracao|out)\//.test(src)) return '/' + src; // legado
  return (window.__ASSET_BASE || '/') + src;
}

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
        background: `radial-gradient(circle, ${BRAND.glow}, transparent 70%)`,
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
        <span style={{ width: 17, height: 17, borderRadius: '50%', background: BRAND.red, display: 'inline-block' }} />{BRAND.handle}
      </div>
      <div style={{ color: BRAND.red, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 26 }}>{tag}</div>
    </div>
  );
}

// Bottom handle / CTA line. Untimed or timed.
function Handle({ sub, y = 1690 }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: BRAND.mono }}>
      <div style={{ color: BRAND.fg, fontSize: 40, fontWeight: 600 }}>{BRAND.handleAt}</div>
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

// Tela de abertura de vídeos longos (tutorial, canvas paisagem 1920x1080).
// Use como Sprite start=0 end=intro.duracao.
function Intro({ titulo = 'elucas.dev', subtitulo = '' }) {
  return (
    <>
      <Pop x={960} y={490} align="center" vAlign="middle">
        <div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 96, color: BRAND.fg, textAlign: 'center', lineHeight: 1.05 }}>{titulo}</div>
      </Pop>
      {subtitulo && (
        <Pop x={960} y={600} align="center" vAlign="top" inDur={0.5}>
          <div style={{ fontFamily: BRAND.mono, fontWeight: 600, fontSize: 32, color: BRAND.red, letterSpacing: '.02em', textAlign: 'center' }}>{subtitulo}</div>
        </Pop>
      )}
    </>
  );
}

// Bolha de câmera (PiP) opcional para vídeos longos: círculo com a gravação
// da webcam sobreposto num canto, por cima das cenas de tela/print. `start`/
// `end` são segundos absolutos do Stage (mesma convenção do VideoSprite).
const CAMERA_MARGIN = 56;
function CameraBubble({ src, start, end, trimStart = 0, position = 'bottom-right', size = 280 }) {
  const corner = {
    'bottom-right': { right: CAMERA_MARGIN, bottom: CAMERA_MARGIN },
    'bottom-left': { left: CAMERA_MARGIN, bottom: CAMERA_MARGIN },
    'top-right': { right: CAMERA_MARGIN, top: CAMERA_MARGIN },
    'top-left': { left: CAMERA_MARGIN, top: CAMERA_MARGIN },
  }[position] || { right: CAMERA_MARGIN, bottom: CAMERA_MARGIN };
  return (
    <VideoSprite
      src={src}
      start={start}
      end={end}
      trimStart={trimStart}
      loop={false}
      style={{
        position: 'absolute', ...corner, width: size, height: size, borderRadius: '50%',
        border: `3px solid ${BRAND.red}`, boxShadow: '0 12px 30px rgba(0,0,0,.5)', zIndex: 5,
      }}
    />
  );
}

// ── Molduras de cena de tutorial (canvas paisagem 1920x1080) ────────────────
// Baseadas no kit de artes "Cenas Tutorial" (elucas.dev): desktop = janela de
// navegador; celular = mockup de telefone; callout = destaque sobre print;
// StepCard/TerminalCard = cartões só de texto (sem mídia anexada).

// Janela de navegador que emoldura uma gravação/print de tela de computador.
// `children` preenche a área de conteúdo (abaixo da barra de título).
function DesktopFrame({ children, url = 'localhost:3000' }) {
  return (
    <div style={{
      position: 'absolute', top: 96, left: 200, width: 1520, height: 790,
      background: BRAND.card, border: '1px solid rgba(255,255,255,.10)', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,.55)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.08)', background: '#111114' }}>
        <span style={{ width: 15, height: 15, borderRadius: 9999, background: BRAND.red, display: 'inline-block' }} />
        <span style={{ width: 15, height: 15, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
        <span style={{ width: 15, height: 15, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
        <div style={{ marginLeft: 22, flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: BRAND.ink, border: '1px solid rgba(255,255,255,.08)', borderRadius: 9999, padding: '10px 22px', fontFamily: BRAND.mono, fontSize: 22, color: BRAND.mute }}>
          <span style={{ color: BRAND.red }}>▸</span> {url}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 73, left: 0, right: 0, bottom: 0 }}>{children}</div>
    </div>
  );
}

// Badge "PASSO NN" + legenda, ancorados no rodapé — combina com DesktopFrame.
function SceneCaption({ n, text }) {
  if (!text) return null;
  return (
    <div style={{ position: 'absolute', bottom: 64, left: 200, display: 'flex', alignItems: 'center', gap: 20, maxWidth: 1520 }}>
      {n != null && (
        <span style={{ fontFamily: BRAND.mono, fontSize: 24, fontWeight: 600, color: '#fff', background: BRAND.red, borderRadius: 8, padding: '12px 20px', flex: 'none' }}>
          PASSO {String(n).padStart(2, '0')}
        </span>
      )}
      <span style={{ fontSize: 38, fontWeight: 600, color: BRAND.fg, background: 'rgba(12,12,15,.85)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 26px' }}>{text}</span>
    </div>
  );
}

// Mockup de telefone que emoldura uma gravação/print de tela de celular.
function PhoneFrame({ children }) {
  return (
    <div style={{ position: 'relative', width: 440, height: 900, flex: 'none', background: '#050506', border: '12px solid #1a1a1f', borderRadius: 56, boxShadow: '0 40px 100px rgba(0,0,0,.6)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 150, height: 34, background: '#050506', borderBottomLeftRadius: 18, borderBottomRightRadius: 18, zIndex: 2 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 44, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// Cena completa "tela do celular": painel de texto + PhoneFrame lado a lado.
function CelularScene({ badge, titulo, texto, comando, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '0 160px', display: 'flex', alignItems: 'center', gap: 120 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {badge && (
          <div style={{ fontFamily: BRAND.mono, fontSize: 24, fontWeight: 600, letterSpacing: '.2em', color: BRAND.redSoft, background: BRAND.tint, border: `1px solid ${BRAND.tintBorder}`, borderRadius: 9999, padding: '10px 22px', width: 'max-content' }}>{badge}</div>
        )}
        {titulo && <div style={{ fontSize: 68, fontWeight: 700, color: BRAND.fg, lineHeight: 1.05 }}>{titulo}</div>}
        {texto && <div style={{ fontSize: 30, color: BRAND.body, lineHeight: 1.4, maxWidth: 560 }}>{texto}</div>}
        {comando && (
          <div style={{ marginTop: 6, background: BRAND.card, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '20px 24px', fontFamily: BRAND.mono, fontSize: 26, color: BRAND.fg, width: 'max-content' }}>
            <span style={{ color: BRAND.red }}>$</span> {comando}
          </div>
        )}
      </div>
      <PhoneFrame>{children}</PhoneFrame>
    </div>
  );
}

// Abertura talking-head: você grande na tela (câmera) + título ao lado.
// children = o VideoSprite da câmera (ou nada, virando um cartão só-texto).
// Molde de duas colunas do CelularScene, mas com a mídia em retângulo grande.
function CameraIntroScene({ badge, titulo = '', subtitulo = '', children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '0 120px', display: 'flex', alignItems: 'center', gap: 90 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {badge && (
          <div style={{ fontFamily: BRAND.mono, fontSize: 24, fontWeight: 600, letterSpacing: '.2em', color: BRAND.redSoft, background: BRAND.tint, border: `1px solid ${BRAND.tintBorder}`, borderRadius: 9999, padding: '10px 22px', width: 'max-content' }}>{badge}</div>
        )}
        {titulo && <div style={{ fontSize: 92, fontWeight: 700, color: BRAND.fg, lineHeight: 1.03 }}>{titulo}</div>}
        {subtitulo && <div style={{ fontFamily: BRAND.mono, fontSize: 30, color: BRAND.red, lineHeight: 1.4, maxWidth: 620 }}>{subtitulo}</div>}
      </div>
      <div style={{ position: 'relative', width: 760, height: 820, flex: 'none', marginTop: 40, background: '#050506', border: `4px solid ${BRAND.red}`, borderRadius: 32, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,.6)' }}>
        {children || (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.mute, fontFamily: BRAND.mono, fontSize: 26 }}>câmera</div>
        )}
      </div>
    </div>
  );
}

// Cartão de transição entre passos (sem mídia): número grande + título.
function StepCard({ numero = 1, total = 1, titulo = '', subtitulo = '' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '0 120px', display: 'flex', alignItems: 'center', gap: 70 }}>
      <div style={{ fontFamily: BRAND.mono, fontSize: 260, fontWeight: 700, color: BRAND.red, lineHeight: .8, letterSpacing: '-.04em' }}>{String(numero).padStart(2, '0')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, borderLeft: '2px solid rgba(229,72,77,.4)', paddingLeft: 56 }}>
        <div style={{ fontFamily: BRAND.mono, fontSize: 26, color: BRAND.mute, letterSpacing: '.14em', textTransform: 'uppercase' }}>passo {String(numero).padStart(2, '0')} de {String(total).padStart(2, '0')}</div>
        <div style={{ fontSize: 76, fontWeight: 700, color: BRAND.fg, lineHeight: 1.0 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 28, color: BRAND.body, lineHeight: 1.4, maxWidth: 620 }}>{subtitulo}</div>}
      </div>
    </div>
  );
}

// Cartão de terminal (sem mídia): linhas de comando/saída pré-definidas.
// linhas: [{ prompt: '$', texto: 'docker build -t app .' , cor }]. `caption`
// opcional mostra uma legenda explicativa embaixo do terminal.
function TerminalCard({ titulo = 'bash', linhas = [], caption }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 168, left: 160, fontFamily: BRAND.mono, fontSize: 26, color: BRAND.mute, letterSpacing: '.14em', textTransform: 'uppercase' }}>
        <span style={{ color: BRAND.red }}>//</span> os comandos
      </div>
      <div style={{ position: 'absolute', top: 228, left: 160, width: 1600, height: 620, background: BRAND.card, border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ width: 14, height: 14, borderRadius: 9999, background: BRAND.red, display: 'inline-block' }} />
          <span style={{ width: 14, height: 14, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
          <span style={{ width: 14, height: 14, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
          <span style={{ marginLeft: 16, fontFamily: BRAND.mono, fontSize: 22, color: BRAND.mute }}>{titulo}</span>
        </div>
        <div style={{ padding: '40px 48px', fontFamily: BRAND.mono, fontSize: 32, lineHeight: 1.75 }}>
          {linhas.map((l, i) => (
            <div key={i} style={{ color: l.cor || BRAND.body, marginTop: i ? 10 : 0 }}>
              {l.prompt && <span style={{ color: BRAND.red }}>{l.prompt} </span>}{l.texto}
            </div>
          ))}
        </div>
      </div>
      {caption && (
        <div style={{ position: 'absolute', top: 878, left: 160, width: 1600, fontSize: 32, fontWeight: 600, color: BRAND.fg, background: 'rgba(12,12,15,.85)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '18px 26px' }}>{caption}</div>
      )}
    </div>
  );
}

// Print/gravação em tela cheia com uma caixa de destaque + anotação ao lado.
function Callout({ children, highlight, title, body }) {
  const h = Object.assign({ x: 1180, y: 250, w: 520, h: 300 }, highlight);
  const cardLeft = Math.max(64, h.x - 540);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,10,.35) 0%, transparent 30%, transparent 62%, rgba(8,8,10,.85) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: h.y, left: h.x, width: h.w, height: h.h, border: `4px solid ${BRAND.red}`, borderRadius: 12, boxShadow: '0 0 0 9999px rgba(8,8,10,.55)' }} />
      {(title || body) && (
        <div style={{ position: 'absolute', top: h.y, left: cardLeft, width: 480, display: 'flex', flexDirection: 'column', gap: 14, background: BRAND.card, border: `1px solid ${BRAND.tintBorder}`, borderRadius: 12, padding: '28px 30px', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
          <div style={{ fontFamily: BRAND.mono, fontSize: 22, color: BRAND.red, letterSpacing: '.16em', textTransform: 'uppercase' }}>// atenção aqui</div>
          {title && <div style={{ fontSize: 34, fontWeight: 600, color: BRAND.fg, lineHeight: 1.2 }}>{title}</div>}
          {body && <div style={{ fontSize: 24, color: BRAND.body, lineHeight: 1.4 }}>{body}</div>}
        </div>
      )}
    </>
  );
}

// Caixa auxiliar: renderiza um filho em tamanho nativo (w×h) escalado — o box
// externo tem as dimensões JÁ escaladas, então flex/gap medem certo.
function Scaled({ scale, w, h, children }) {
  return (
    <div style={{ width: w * scale, height: h * scale, flex: 'none', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

// Janela de app minimalista (variante relativa/parametrizável do DesktopFrame)
// usada pela mídia do outro. DesktopFrame continua intocado (coordenadas fixas).
function OutroWindow({ width = 1100, height = 620, children }) {
  return (
    <div style={{ position: 'relative', width, height, flex: 'none', background: BRAND.card, border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', background: '#111114' }}>
        <span style={{ width: 12, height: 12, borderRadius: 9999, background: BRAND.red, display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: 9999, background: '#3a3a40', display: 'inline-block' }} />
      </div>
      <div style={{ position: 'absolute', top: 41, left: 0, right: 0, bottom: 0 }}>{children}</div>
    </div>
  );
}

// Mídia do outro: vídeo (sincronizado ao Stage) ou imagem, preenchendo a moldura.
function OutroMedia({ src, start, end }) {
  if (!src) return null;
  const abs = absAsset(src);
  const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  return /\.(mp4|mov|webm)$/i.test(src)
    ? <VideoSprite src={abs} start={start} end={end} loop={true} style={fill} />
    : <img src={abs} alt="" style={fill} />;
}

// Tela final de inscreva-se (canvas paisagem 1920x1080).
// Use como Sprite start=DUR-outro.duracao end=DUR.
// media (opcional): { tipo: 'celular'|'desktop'|'ambos', srcCelular, srcDesktop }
// — mostra o resultado final (print/vídeo) emoldurado; com media o CTA sobe
// para o terço superior. start/end (tempos absolutos do Stage) sincronizam
// vídeos dentro da mídia.
function Outro({ cta = 'INSCREVA-SE', sub = '', media = null, start, end }) {
  if (!media || !media.tipo) {
    return (
      <>
        <Pop x={960} y={470} align="center" vAlign="middle">
          <div style={{
            fontFamily: BRAND.mono, fontWeight: 700, fontSize: 38, letterSpacing: '.08em',
            color: BRAND.fg, background: BRAND.red, borderRadius: 999, padding: '26px 56px',
            boxShadow: '0 10px 0 rgba(0,0,0,.35)',
          }}>{cta}</div>
        </Pop>
        <Handle sub={sub} y={600} />
      </>
    );
  }
  const ambos = media.tipo === 'ambos';
  const showPhone = media.tipo === 'celular' || ambos;
  const showDesk = media.tipo === 'desktop' || ambos;
  // PhoneFrame: 440x900 + 12px de borda → caixa externa 464x924.
  const phoneScale = ambos ? 0.56 : 0.62;
  const winW = ambos ? 1000 : 1200, winH = ambos ? 580 : 620;
  return (
    <>
      <Pop x={960} y={170} align="center" vAlign="middle">
        <div style={{
          fontFamily: BRAND.mono, fontWeight: 700, fontSize: 34, letterSpacing: '.08em',
          color: BRAND.fg, background: BRAND.red, borderRadius: 999, padding: '20px 46px',
          boxShadow: '0 10px 0 rgba(0,0,0,.35)',
        }}>{cta}</div>
      </Pop>
      <Handle sub={sub} y={278} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, bottom: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90 }}>
        {showPhone && (
          <Scaled scale={phoneScale} w={464} h={924}>
            <PhoneFrame><OutroMedia src={media.srcCelular} start={start} end={end} /></PhoneFrame>
          </Scaled>
        )}
        {showDesk && (
          <OutroWindow width={winW} height={winH}>
            <OutroMedia src={media.srcDesktop} start={start} end={end} />
          </OutroWindow>
        )}
      </div>
    </>
  );
}

Object.assign(window, {
  BRAND, absAsset, Backdrop, TopBar, Handle, Keycap, Pop, Eyebrow, Intro, Outro, CameraBubble,
  DesktopFrame, SceneCaption, PhoneFrame, CelularScene, CameraIntroScene, StepCard, TerminalCard, Callout,
});
