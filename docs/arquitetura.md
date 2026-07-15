# reels-studio — guia de operação e arquitetura

Documento único pra **qualquer pessoa operar o sistema**: o que cada arquivo/pasta
faz, os comandos, as rotas, os formatos e como estender (temas, templates de cena,
layouts de quiz por canal). Para o schema de conteúdo de cada formato veja
[prompts/gerar-estrutura.md](../prompts/gerar-estrutura.md); para temas e templates
file-driven veja [docs/temas-templates.md](temas-templates.md).

## O que é

CLI + app web local que transforma **um arquivo de conteúdo (JSON)** em **vídeo MP4**,
renderizando localmente com Chrome headless (puppeteer-core) + `tools/ffmpeg.exe`. Sem
build step: o JSX é transformado no navegador por um Babel vendorizado e avaliado com
`eval`. Dois tamanhos: reels verticais 1080×1920 (`lista`/`quiz`/`historia`/`custom`) e
tutoriais horizontais 1920×1080.

## Requisitos e setup

- **Node 18+**, **Google Chrome** instalado, **pnpm** (`pnpm install` → puppeteer-core, js-yaml).
- `tools/ffmpeg.exe` já vem no repo (se faltar: release `b6.0` de eugeneware/ffmpeg-static, `ffmpeg-win32-x64.gz`).
- Opcional (Studio no celular): `mkcert` para HTTPS na LAN (ver README).

## Mapa de arquivos

### Raiz
- **`cli.mjs`** — TODO o backend num arquivo: CLI (comandos abaixo), servidor HTTP(S)
  (player + Studio + API), pipeline de render (puppeteer → frames → ffmpeg), limpeza de
  áudio, import/export, validação. Sem dependências além de puppeteer-core/js-yaml.
- **`README.md`** — visão geral e receitas rápidas. **Este arquivo** — referência completa.
- **`package.json` / `pnpm-lock.yaml`** — deps (puppeteer-core, js-yaml).

### `engine/` — motor de render (JSX avaliado no navegador, compartilha escopo via `window`)
- **`animations.jsx`** — timeline engine: `Stage` (canvas exportável + playhead + protocolo
  de export frame-a-frame), `Sprite` (monta filhos só na janela `[start,end]`), primitivas
  `TextSprite`/`ImageSprite`/`RectSprite`/`VideoSprite`, `Easing`/`interpolate`/`animate`.
- **`reel-kit.jsx`** — kit de marca: monta `BRAND` a partir de `window.__THEME` (tema
  file-driven; default embutido = tema "elucas"). Componentes: `Backdrop`, `TopBar`,
  `Handle`, `Intro`, `Outro`, `CameraBubble`, `Eyebrow`, `Pop`, molduras de tutorial
  (`DesktopFrame`/`BrowserFrame`/`PhoneFrame`/`CelularScene`/`CameraIntroScene`/`StepCard`/
  `TerminalCard`/`Callout`), e `absAsset` (resolve caminhos relativos ao projeto).
- **`layout-renderer.jsx`** — interpretador de layout **declarativo de cena** (tutorial):
  `SceneRenderer`/`LayoutNode` + `resolveText` (bindings `{campo}`) + `resolveStyle`
  (tokens `$red`/`$fg`...). Nós: `text`/`image`/`video`/`rect`/`row`/`col`/`frame`.
- **`quiz-renderer.jsx`** — interpretador de layout **temporal do quiz** (por canal):
  `QuizFromTemplate` computa fases + âncoras; reusa `LayoutNode`; nós especiais
  `options`/`countdown`/`eyebrow`/`handle`.
- **`vendor/`** — `react.js`, `react-dom.js`, `babel.js` (standalone, para transformar JSX).

### `player/`
- **`player.html`** — carrega o `project.json`, injeta `window.__THEME`/`__SCENE_TEMPLATES`/
  `__QUIZ_TEMPLATES`, avalia `animations.jsx` → `reel-kit.jsx` → `layout-renderer.jsx` →
  `quiz-renderer.jsx` → `templates/<formato>.jsx`, e monta o componente. Aceita
  `?reel=<slug>` e `?freeze=<segundos>` (congela num frame — usado pelo render e preview).

### `templates/` — componentes de cada formato (definem `window.__ReelComponent`)
- **`lista.jsx`**, **`quiz.jsx`**, **`historia.jsx`** — reels verticais. `quiz.jsx` usa o
  interpretador file-driven quando `cfg.template` aponta um layout; senão o JSX embutido.
- **`tutorial.jsx`** — vídeo longo; usa `SceneRenderer` quando o manifesto da cena tem
  `layout`, senão as molduras JSX embutidas.
- **`scenes/<id>/manifest.yaml` + `thumb.svg`** — catálogo file-driven de **templates de
  cena** (tutorial): campos do inspector + `layout` declarativo opcional.
- **`quiz/<id>/manifest.yaml` + `thumb.svg`** — **layouts de quiz por canal** (`classico`,
  `cartoes`): `timeline` + `layout` temporal.

### `themes/<id>/theme.yaml` — temas file-driven
Tokens de cor, fontes, marca (handle), fundo. `elucas` (padrão) e `oceano` (azul). O tema
é escolhido por projeto (`cfg.theme`) ou no Studio.

### `studio/` — app web (desktop + celular), sem build step
- **`index.html`** — shell + CSS; carrega `lib.jsx`/`store.jsx`/`components.jsx`/`app.jsx`.
- **`lib.jsx`** — helpers puros (duração de cena, relayout da timeline, catálogo fallback).
- **`store.jsx`** — camada local-first (IndexedDB) + sincronização com o servidor.
- **`components.jsx`** — todos os componentes (timeline, inspector, galeria, editores de
  reel `ListaEditor`/`QuizEditor`/`HistoriaEditor`, `ThemeSelect`, `QuizTemplateSelect`, etc).
- **`app.jsx`** — a aplicação (roteamento de tela, formato → editor, save/sync).
- **`db.js` / `sync.js` / `zip.js`** — IndexedDB, sync HTTP, empacotamento zip no navegador.
- **`sw.js`** — service worker (network-first no app-shell; offline cai no cache).
- **`manifest.json` / `icon.svg`** — PWA (instalar como app).

### `projects/<slug>/` — um projeto = uma pasta (gitignored, exceto `exemplo-*`)
```
project.json                       # a definição do vídeo
assets/gravacoes/                  # vídeos/gravações de tela
assets/prints/                     # imagens/prints
assets/narracao/{raw,limpo,cenas}/ # narração crua, limpa e takes por cena
render/video.mp4 + thumb.jpg       # saída
```
Caminhos no JSON são **relativos ao projeto** (`"assets/gravacoes/x.mp4"`), resolvidos por
`absAsset` via `window.__ASSET_BASE` (`/projects/<slug>/`).

### Outras pastas
- **`prompts/`** — prompts de IA: `gerar-ideias.md` (lote de ideias), `gerar-estrutura.md`
  (ideia → JSON pronto).
- **`docs/`** — `arquitetura.md` (este), `temas-templates.md` (temas + templates file-driven),
  `saas.md` (roadmap futuro).
- **`lotes/`** — scripts de geração em lote (ex.: `dia01.mjs`).
- **`musica/`** — trilhas `.mp3/.m4a` embutidas no render (rotacionadas).
- **`certs/`** — cert/key do mkcert para HTTPS na LAN (Studio no celular).
- **`custom/`** — JSX livre para o formato `custom`.
- **`content/`, `gravacoes/`, `prints/`, `narracao/`, `out/`** — estrutura **legada**
  (pré-`projects/`); `node cli.mjs migrate` move tudo para `projects/`. Novos projetos não usam.

## Comandos (CLI)

```bash
node cli.mjs new <slug> --formato lista|quiz|historia|tutorial   # cria projects/<slug>/project.json
node cli.mjs list                       # lista projetos + status de render
node cli.mjs validate <slug>            # checa limites de texto e campos
node cli.mjs serve [--port 5173]        # sobe player + Studio + API (HTTPS se houver certs/)
node cli.mjs render <slug> [--fps 30]   # renderiza projects/<slug>/render/video.mp4
node cli.mjs render --all               # renderiza todos
node cli.mjs render <slug> --sem-musica # sem trilha de fundo
node cli.mjs audio <slug>               # limpa a narração crua e mede a duração real
node cli.mjs export <slug>              # empacota o projeto num <slug>.rvs (zip portátil)
node cli.mjs import <arquivo.rvs>       # importa um .rvs de volta para projects/
node cli.mjs import <planilha.xlsx>     # abas quizzes/listas/historias -> vários projetos (precisa da lib xlsx)
node cli.mjs export-theme <id>          # empacota um tema em <id>.rvtheme
node cli.mjs export-template <id>       # empacota um template de cena em <id>.rvtemplate
node cli.mjs import <arquivo.rvtheme|.rvtemplate> [--id <novo>]   # importa tema/template
node cli.mjs migrate [--dry-run]        # migra a estrutura legada -> projects/
node cli.mjs planilha                   # gera out/publicacao.xlsx (títulos/tags p/ upload)
node cli.mjs musica --all               # embute trilha (faixas em musica/)
```

## Rotas (API, usadas pelo Studio)

- `GET /api/projects` — lista `{slug, formato}` de todos os projetos.
- `GET /api/reels` / `GET /api/tutorials` — listas auxiliares de slugs.
- `GET /api/tutorial/:slug` — o `project.json`; **`POST`** salva (valida + grava).
- `GET /api/assets/:slug` — mídia do projeto; **`PUT /api/assets/:slug/:kind/:file`** envia
  um arquivo (`kind` = `gravacao|print|narracao|audioCena`).
- `POST /api/audio/:slug` — limpa a narração crua (mesmo que o comando `audio`).
- `POST /api/audio-cena/:slug/:sceneId` — limpa o take de áudio de uma cena.
- `POST /api/render/:slug` — dispara o render (progresso por streaming).
- `GET /api/themes` · `GET /api/theme/:id` — temas (lista / resolvido).
- `GET /api/scene-templates` — catálogo de templates de cena (manifests).
- `GET /api/quiz-templates` — layouts de quiz por canal (manifests).
- `POST /api/import` (.rvs) · `POST /api/import-planilha` (.xlsx) ·
  `POST /api/import-theme` (.rvtheme) · `POST /api/import-template` (.rvtemplate).

## Formatos

| formato    | canvas    | estrutura | editor no Studio |
|------------|-----------|-----------|------------------|
| `lista`    | 1080×1920 | gancho → N itens → CTA | formulário `ListaEditor` |
| `quiz`     | 1080×1920 | gancho → pergunta → opções → contagem → resposta → CTA | `QuizEditor` + seletor de layout (canal) |
| `historia` | 1080×1920 | gancho → seções (texto/stats/chips) → CTA | `HistoriaEditor` |
| `custom`   | 1080×1920 | JSX livre em `custom/` | — (edite o JSON) |
| `tutorial` | 1920×1080 | intro → cenas → outro, com narração/câmera | timeline (NLE) |

Schema de cada formato: [prompts/gerar-estrutura.md](../prompts/gerar-estrutura.md).
A duração se ajusta ao conteúdo. Campos comuns a todos: `theme` (id do tema, opcional).
Só `quiz` tem `template` (id do layout de canal, opcional).

## Como o render funciona

`render` sobe um servidor local, abre `player.html` no Chrome headless (viewport 1:1 com o
canvas), avança o timeline frame a frame pelo evento síncrono `data-om-seek-to-time-frame`
do `Stage`, captura cada frame e monta o MP4 (H.264, 30fps, yuv420p) com `ffmpeg`. Reels
saem **sem áudio** (adicione a trilha no Instagram, ou `musica --all`); `tutorial` sai **com
áudio** (narração + música de fundo por `amix`).

## Studio (app único, PC + celular)

`node cli.mjs serve` → `/studio/`. Tela inicial lista todos os formatos (filtro/busca);
cada um abre no seu editor. **local-first**: tudo salva no aparelho (IndexedDB) antes de ir
ao servidor; no celular funciona 100% offline e sincroniza sozinho na LAN. Instalável como
PWA. Setup do celular (HTTPS via mkcert) e limitações (gravação de tela é feita fora do app):
ver [README.md](../README.md).

## Como estender

- **Novo tema** — copie `themes/elucas/` para `themes/<id>/`, edite `theme.yaml`. Aparece no
  seletor de tema. Empacote com `export-theme <id>`.
- **Novo template de cena (tutorial)** — crie `templates/scenes/<id>/manifest.yaml` (+
  `thumb.svg`). Com `fields` só, reusa uma moldura existente; com `layout`, desenha uma
  moldura nova (só YAML). Detalhes e DSL: [docs/temas-templates.md](temas-templates.md).
- **Novo layout de quiz (canal)** — crie `templates/quiz/<id>/manifest.yaml` (+ `thumb.svg`)
  com `layout` temporal. Aparece no seletor "layout do quiz". DSL: mesma doc.
- **Novo formato** — `templates/<nome>.jsx` que define `window.__ReelComponent`, mais
  suporte no Studio (`app.jsx`/`components.jsx`) e no `SKELETONS`/`validate` do `cli.mjs`.

## Fluxo de desenvolvimento (git)

Implementações em branches `feat/*` → merge em `develop` → o autor testa em `develop` → o
merge `develop` → `main` só acontece com **aprovação explícita**.
