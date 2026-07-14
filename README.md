# reels-studio

Automação da produção de vídeos elucas.dev: você escreve **um JSON de
conteúdo**, a ferramenta cuida do resto — layout, animação, marca e o **MP4
final**, renderizado localmente (Chrome headless + ffmpeg), sem depender de
nenhum host. Cobre tanto **Shorts/Reels curtos** (1080×1920) quanto
**tutoriais longos** (1920×1080, com narração e gravações de tela).

Baseado no pacote-guia original (motor `animations.jsx` + kit de marca
`reel-kit.jsx`).

## Fluxo (vídeos curtos)

Cada projeto vive numa pasta única **`projects/<slug>/`** (`project.json` +
`assets/` + `render/`). Um projeto também pode ser empacotado num arquivo
único **`.rvs`** (um zip com o projeto na raiz — estilo `.docx`) para backup,
mover entre máquinas ou compartilhar.

```
projects/meu-reel/
  project.json                 # a definição do vídeo (o antigo content/<slug>.json)
  assets/{gravacoes,prints,narracao}/...   # mídia do projeto (caminhos no JSON são relativos: "assets/...")
  render/video.mp4 + thumb.jpg # saída do render
```

```bash
node cli.mjs new meu-reel --formato lista   # cria projects/meu-reel/project.json
#  → edite o JSON (só texto)
node cli.mjs validate meu-reel              # confere limites de caracteres
node cli.mjs serve                          # preview: http://127.0.0.1:5173/player/player.html?reel=meu-reel
node cli.mjs render meu-reel                # gera projects/meu-reel/render/video.mp4
node cli.mjs render --all                   # renderiza todos
node cli.mjs list                           # lista reels + status
node cli.mjs export meu-reel                # empacota em meu-reel.rvs (portátil)
node cli.mjs import meu-reel.rvs            # importa um .rvs de volta para projects/
```

Vindo da estrutura antiga (pastas `content/`, `gravacoes/`, `prints/`,
`narracao/`, `out/` por-tipo)? Rode **`node cli.mjs migrate`** uma vez
(`--dry-run` para pré-visualizar) — move tudo para `projects/<slug>/` e
reescreve os caminhos no JSON.

## Produção em lote (YouTube Shorts)

```bash
node lotes/dia01.mjs                        # gera os 24 JSONs do dia 1 (exemplo de lote)
node cli.mjs import quiz-shorts-30dias.xlsx # OU importa planilha (aba "quizzes") -> content/*.json
node cli.mjs render --all                   # renderiza tudo
node cli.mjs planilha                       # out/publicacao.xlsx: dia, hora, título, descrição, tags
node cli.mjs musica --all                   # embute trilha (faixas em musica/) -> out-com-musica/
```

Colunas da planilha de import: `slug, tag, hook1, hookSub, question` (linhas separadas por `|`), `optionA..C, correta (A/B/C), reveal, fonte, dificuldade, dia, hora, yt_titulo, yt_descricao, yt_tags`.

**Música:** baixe faixas liberadas na YouTube Audio Library (studio.youtube.com → Biblioteca de áudio, filtro "Sem atribuição obrigatória") para a pasta `musica/`. O `musica --all` rotaciona as faixas entre os vídeos, com fade-out no final. Upload manual: use `out-com-musica/`; a planilha `out/publicacao.xlsx` tem título/descrição/tags prontos pra copiar e colar, na ordem de publicação (1/hora).

## Formatos

| formato    | canvas    | estrutura                                            | exemplo                    |
|------------|-----------|-------------------------------------------------------|----------------------------|
| `lista`    | 1080×1920 | gancho → N itens (keycap + frase) → CTA              | `projects/exemplo-lista/`  |
| `quiz`     | 1080×1920 | gancho → pergunta → opções → contagem → resposta → CTA | `projects/exemplo-quiz/` |
| `historia` | 1080×1920 | gancho → seções (texto / chips-fluxo / stats) → CTA  | `projects/exemplo-historia/` |
| `custom`   | 1080×1920 | JSX livre em `custom/` (cenas sob medida)            | `projects/exemplo-custom/` |
| `tutorial` | 1920×1080 | intro → cenas (câmera/tela/print/passo/código) → outro, com narração | `projects/exemplo-tutorial/` |

Duração se ajusta sozinha ao conteúdo (ex.: lista com 5 itens ≈ 14s; tutorial = intro + duração real da narração + outro).

`projects/` é gitignored (é conteúdo de produção) — só os `projects/exemplo-*/` acima ficam versionados como modelo de cada formato.

## Limites de texto (pra não quebrar o layout)

- **lista**: gancho ~22 chars/linha · item ~28 · badge ~12 · 3 a 7 itens
- **quiz**: pergunta ~24 chars/linha (use `\n`) · 2 a 4 opções (1 `correct`) · opção ~18
- **historia**: hook ~16/linha · título de seção ~24/linha · 2 a 4 seções
- **tutorial**: pelo menos 1 cena · `caption` ~60/linha

`validate`/`render` avisam quando algo passa do limite.

## Regras da marca (não mexer)

Só o vermelho `#E5484D` como destaque · fundo escuro sempre · IBM Plex Sans/Mono · nada de azul/verde/laranja. Tudo isso já está em `engine/reel-kit.jsx`.

## Como o render funciona

`cli.mjs render` sobe um servidor local, abre o player no Chrome headless (viewport em escala 1:1 com o canvas — 1080×1964 pros formatos curtos, 1920×1124 pro `tutorial`), avança o timeline frame a frame pelo evento síncrono `data-om-seek-to-time-frame` do Stage, captura cada frame e monta o MP4 (H.264, 30fps, yuv420p) com `tools/ffmpeg.exe`. ~45s para um reel de 14s.

Requisitos: Node 18+, Google Chrome instalado, `pnpm install` (puppeteer-core), `tools/ffmpeg.exe` (já incluso; se faltar: release `b6.0` de eugeneware/ffmpeg-static, `ffmpeg-win32-x64.gz`).

O vídeo de formatos curtos sai **sem áudio** — adicione a trilha no próprio Instagram (melhor pro alcance, aliás), ou use `musica --all`. O formato `tutorial` já sai **com áudio** (narração + música de fundo opcional).

---

## Tutorial (vídeos longos)

Formato `tutorial`: vídeos de 1-5 min, paisagem 1920×1080, combinando
gravações de tela, prints, narração e câmera opcional.

```bash
node cli.mjs new meu-tutorial --formato tutorial
#  → grave a narração em narracao/raw/meu-tutorial.wav (ou .mp4/.mov/.webm — ver abaixo)
#  → coloque as gravações de tela em gravacoes/meu-tutorial/ e prints em prints/meu-tutorial/
#  → edite content/meu-tutorial.json (scenes[], intro, outro, camera)
node cli.mjs audio meu-tutorial             # limpa a narração, mede a duração real
node cli.mjs validate meu-tutorial
node cli.mjs render meu-tutorial            # gera out/meu-tutorial.mp4 (com áudio)
```

`narracao.duracaoSegundos` nunca é chutado à mão em produção — é medido pelo
comando `audio` depois da limpeza, e é essa duração que define o tamanho do
vídeo final (`scenes[].start`/`end` são relativos ao início da narração).

### Cenas: layouts disponíveis

Cada cena de `type: "video"` ou `"image"` escolhe uma moldura (`layout`) —
**a moldura certa depende de onde a tela foi gravada**:

| layout | pra quê | preview |
|---|---|---|
| `desktop` (padrão) | gravação/print de **tela do computador** — janela de navegador com barra de URL | badge "PASSO NN" + legenda no rodapé |
| `celular` | gravação/print de **tela do celular** — mockup de telefone | painel de texto (badge/título/comando) ao lado do aparelho |
| `callout` | print em tela cheia destacando um ponto específico | caixa de destaque + cartão de anotação |
| `raw` | mídia em tela cheia, sem moldura | só legenda embaixo |

Dois tipos de cena **sem mídia** (cartões de texto puro, pra separar seções):

| type | pra quê |
|---|---|
| `passo` | cartão de transição — número grande + título + subtítulo |
| `codigo` | terminal com comandos/saída pré-escritos (`linhas: [{prompt,texto,cor}]`) |

Ver `prompts/gerar-estrutura.md` pra o schema JSON completo de cada layout.

### Câmera (webcam) opcional

```json
"camera": { "src": "gravacoes/<slug>/camera.mp4", "position": "bottom-right", "size": 280 }
```

Sobrepõe uma bolha circular (PiP) num canto durante todo o corpo do vídeo.
`position`: `bottom-right` / `bottom-left` / `top-right` / `top-left`.

### Áudio

`node cli.mjs audio <slug>` limpa `narracao/raw/<slug>.*` (corte de silêncio
nas pontas, noise gate, highpass, normalização — tudo via ffmpeg nativo, sem
dependência de perfil de ruído) e grava `narracao/limpo/<slug>.m4a`. Aceita
tanto áudio puro (`wav/mp3/m4a/aac/ogg`) quanto um **vídeo com áudio
embutido** (`mp4/mov/webm`) — por exemplo, a própria gravação de câmera: nesse
caso só a trilha de áudio é aproveitada, então rosto+voz podem ser gravados
juntos e a mesma gravação vira narração e câmera ao mesmo tempo.

No render, a narração entra sincronizada logo após a intro, e a música de
fundo (se houver faixa em `musica/`) passa a tocar baixinho por baixo dela
(`amix`) em vez de substituir o áudio.

### Studio (app único, PC + celular)

`node cli.mjs serve` serve o **Studio** em `/studio/` — um único app,
instalável como PWA no PC e no Android, com cara de editor de vídeo. A tela
inicial lista **todos os formatos** (tutorial/lista/quiz/historia) com filtro e
busca; cada formato abre no seu editor:

- **tutorial** → editor de linha do tempo (NLE, abaixo);
- **lista/quiz/historia** (reels verticais) → formulário dedicado do formato +
  preview retrato tocando a animação.

Editor de tutorial:

- **timeline** com blocos proporcionais à duração de cada cena (a duração
  total é sempre a soma das cenas — nada de timing manual);
- **preview congelado** no primeiro frame da cena selecionada (pixel-perfect,
  é o próprio player), com toggle de proporção 16:9/9:16;
- **tudo do JSON editável na UI**: todos os tipos de cena (`video`, `image`,
  `passo`, `codigo`, `camera-intro`) e layouts (`desktop`, `celular`,
  `callout`, `raw`), intro, outro (inclusive com mídia de fechamento em
  moldura de celular, PC ou ambos), galeria visual de layouts ao criar cena;
- **abertura talking-head** (`camera-intro`): você grande na tela + título ao
  lado, como primeira cena — o vídeo é o próprio take de câmera daquela cena;
- **takes por cena**: grave a narração cena a cena (com o roteiro na tela e
  teleprompter karaokê no modo gravação guiada); errou, regrava só aquela
  cena. O take pode incluir **câmera** — vira a bolha PiP daquela cena (ou o
  vídeo grande, na cena de abertura);
- **local-first**: tudo é salvo no aparelho (IndexedDB) antes de ir pro
  servidor. No PC o sync é invisível; no celular o app funciona 100% offline
  (gravar, anexar, editar) e sincroniza sozinho quando encontra o PC na rede
  — incluindo a limpeza ffmpeg dos takes gravados offline. Exportação em zip
  continua como alternativa manual.

Setup pro celular (uma vez, precisa da rede local — depois o app abre sem PC):

```bash
mkcert -install                                    # cria uma CA local confiável
mkcert -cert-file certs/cert.pem -key-file certs/key.pem <IP-da-sua-LAN> localhost 127.0.0.1
node cli.mjs serve                                  # mostra a URL pro celular
#  → no celular, mesma Wi-Fi: https://<IP-da-LAN>:5173/studio/
#  → "Adicionar à tela inicial" pra instalar como app
```

Gravações de tela **não** são feitas pelo app (Android não permite captura de
tela do sistema de dentro de uma PWA) — grave com o gravador nativo do
celular e anexe o arquivo no app (funciona offline; sobe no próximo sync).

### Gerar conteúdo com IA

`prompts/gerar-ideias.md` e `prompts/gerar-estrutura.md` são prompts prontos
pra colar numa conversa de IA: o primeiro gera um lote de ideias de vídeo
(qualquer formato), o segundo transforma uma ideia escolhida no JSON completo
pra colar em `content/<slug>.json` — já sabe os limites de caracteres e o
schema de cada formato, incluindo os layouts de cena do `tutorial`.
