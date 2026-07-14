// templates/tutorial.jsx — formato "tutorial": vídeos longos com gravações de
// tela, prints e narração. Duração = intro.duracao + narracao.duracaoSegundos
// + outro.duracao (o áudio limpo é a fonte de verdade da duração, medido pelo
// comando `node cli.mjs audio <slug>` — narracao.duracaoSegundos nunca deve
// ser adivinhado à mão em produção).
// Conteúdo vem de window.REEL_CONFIG (JSON em content/<slug>.json).
// scenes[].start/end são segundos relativos ao início da narração (0 = fala
// começa); este template soma intro.duracao internamente.

const C = Object.assign({
  tag: 'Tutorial',
  intro: {},
  outro: {},
  narracao: { duracaoSegundos: 10 },
  scenes: [],
  camera: null,
}, window.REEL_CONFIG);

const introDur = C.intro.duracao ?? 2.4;
const outroDur = C.outro.duracao ?? 3.2;
const bodyDur = C.narracao.duracaoSegundos || 10;
const DUR = +(introDur + bodyDur + outroDur).toFixed(2);

// scenes[].src são caminhos relativos ao projeto (ex.: "assets/gravacoes/a.mp4").
// absAsset (reel-kit) prefixa __ASSET_BASE (/projects/<slug>/) — e ainda entende
// os caminhos legados por-tipo ("gravacoes/<slug>/...") por compatibilidade.
const abs = absAsset;

// canvas paisagem 1920x1080. Cada cena escolhe um `layout` (a moldura visual)
// e um `type` (de onde vem o conteúdo):
//   type: 'video' | 'image'  -> mídia anexada (gravação de tela ou print)
//   type: 'passo' | 'codigo' -> cartão só de texto, sem mídia
//   layout: 'desktop' (padrão p/ video/image) -> janela de navegador,
//           gravação/print de TELA DE COMPUTADOR
//   layout: 'celular' -> mockup de telefone, gravação/print de TELA DE CELULAR
//   layout: 'callout' -> print em tela cheia + caixa de destaque/anotação
//   layout: 'raw'     -> full-bleed sem moldura (comportamento antigo)
// Ver prompts/gerar-estrutura.md para o schema completo de cada layout.
const DESKTOP_CONTENT = { width: 1520, height: 717 }; // 790 - 73 (barra de título)
const PHONE_CONTENT = { width: 440, height: 900 };
const RAW_BOX = { x: 96, y: 220, width: 1728, height: 600 };

function TutorialScene({ scene, start, end }) {
  const layout = scene.layout || (scene.type === 'video' || scene.type === 'image' ? 'desktop' : null);

  if (scene.type === 'camera-intro') {
    return (
      <Sprite start={start} end={end}>
        <CameraIntroScene badge={scene.badge} titulo={scene.titulo} subtitulo={scene.subtitulo}>
          {scene.camera?.src && (
            <VideoSprite src={abs(scene.camera.src)} start={start} end={end} trimStart={scene.camera.trimStart || 0} loop={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </CameraIntroScene>
      </Sprite>
    );
  }
  if (scene.type === 'passo') {
    return <Sprite start={start} end={end}><StepCard numero={scene.numero} total={scene.total} titulo={scene.titulo} subtitulo={scene.subtitulo} /></Sprite>;
  }
  if (scene.type === 'codigo') {
    return <Sprite start={start} end={end}><TerminalCard titulo={scene.titulo} linhas={scene.linhas || []} caption={scene.caption} /></Sprite>;
  }

  const media = scene.type === 'video'
    ? (dims) => <VideoSprite src={abs(scene.src)} start={start} end={end} trimStart={scene.trimStart || 0} loop={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    : (dims) => <ImageSprite src={abs(scene.src)} x={0} y={0} width={dims.width} height={dims.height} fit="cover" kenBurns={!!scene.kenBurns} />;

  if (layout === 'celular') {
    return (
      <Sprite start={start} end={end}>
        <CelularScene badge={scene.badge} titulo={scene.titulo} texto={scene.texto || scene.caption} comando={scene.comando}>
          {media(PHONE_CONTENT)}
        </CelularScene>
      </Sprite>
    );
  }

  if (layout === 'callout') {
    return (
      <Sprite start={start} end={end}>
        <Callout highlight={scene.highlight} title={scene.title} body={scene.body}>
          {media({ width: 1920, height: 1080 })}
        </Callout>
      </Sprite>
    );
  }

  if (layout === 'raw') {
    return (
      <React.Fragment>
        <Sprite start={start} end={end}>
          {scene.type === 'video'
            ? <VideoSprite src={abs(scene.src)} start={start} end={end} trimStart={scene.trimStart || 0} loop={false}
                style={{ position: 'absolute', left: RAW_BOX.x, top: RAW_BOX.y, width: RAW_BOX.width, height: RAW_BOX.height, overflow: 'hidden', borderRadius: 20, objectFit: 'cover' }} />
            : <ImageSprite src={abs(scene.src)} x={RAW_BOX.x} y={RAW_BOX.y} width={RAW_BOX.width} height={RAW_BOX.height} fit="cover" kenBurns={!!scene.kenBurns} />}
        </Sprite>
        {scene.caption && (
          <Sprite start={start} end={end}>
            <TextSprite text={scene.caption} x={960} y={RAW_BOX.y + RAW_BOX.height + 60} align="center" size={40} weight={600} color={BRAND.fg} font={BRAND.sans} />
          </Sprite>
        )}
      </React.Fragment>
    );
  }

  // desktop (padrão): janela de navegador + badge/legenda no rodapé.
  return (
    <Sprite start={start} end={end}>
      <DesktopFrame url={scene.url}>{media(DESKTOP_CONTENT)}</DesktopFrame>
      <SceneCaption n={scene.numero} text={scene.caption} />
    </Sprite>
  );
}

function ReelTutorial() {
  const W = 1920, H = 1080;
  return (
    <Stage width={W} height={H} duration={DUR} background={BRAND.ink} persistKey="reel-tutorial">
      <Backdrop grid="cells" />
      <TopBar tag={C.tag} />

      <Sprite start={0} end={introDur}>
        <Intro titulo={C.intro.titulo} subtitulo={C.intro.subtitulo} />
      </Sprite>

      {C.scenes.map((s, i) => (
        <TutorialScene
          key={i}
          scene={s}
          start={introDur + (+s.start || 0)}
          end={introDur + (+s.end || ((+s.start || 0) + 3))}
        />
      ))}

      {/* câmera POR CENA: take gravado com vídeo — bolha PiP só durante aquela
          cena. position/size da cena, com fallback na config global.
          camera-intro já mostra a câmera grande (não vira bolha). */}
      {C.scenes.map((s, i) => s.camera?.src && s.type !== 'camera-intro' && (
        <Sprite key={'cam' + i} start={introDur + (+s.start || 0)} end={introDur + (+s.end || 0)}>
          <CameraBubble
            src={abs(s.camera.src)}
            start={introDur + (+s.start || 0)}
            end={introDur + (+s.end || 0)}
            trimStart={s.camera.trimStart || 0}
            position={s.camera.position || C.camera?.position || 'bottom-right'}
            size={s.camera.size || C.camera?.size || 280}
          />
        </Sprite>
      ))}

      {/* câmera (webcam) opcional: bolha PiP sobreposta durante o corpo do vídeo */}
      {C.camera?.src && (
        <Sprite start={introDur} end={introDur + bodyDur}>
          <CameraBubble
            src={abs(C.camera.src)}
            start={introDur}
            end={introDur + bodyDur}
            trimStart={C.camera.trimStart || 0}
            position={C.camera.position || 'bottom-right'}
            size={C.camera.size || 280}
          />
        </Sprite>
      )}

      <Sprite start={introDur + bodyDur} end={DUR}>
        <Outro cta={C.outro.cta} sub={C.outro.sub} media={C.outro.media}
          start={introDur + bodyDur} end={DUR} />
      </Sprite>
    </Stage>
  );
}
window.__ReelComponent = ReelTutorial;
