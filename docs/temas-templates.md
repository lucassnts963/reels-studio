# Temas e templates de cena (file-driven, YAML)

O visual e os layouts de cena do reels-studio são **file-driven**: definidos por
arquivos YAML (fáceis de escrever à mão), não por código. O servidor Node lê o
YAML e entrega JSON pro navegador — você nunca precisa mexer em JS pra criar um
tema ou um template de cena que reusa uma moldura existente.

## Temas — `themes/<id>/theme.yaml`

Um tema define cores, fontes e a marca. Todo projeto sem `theme` no `project.json`
usa o tema `elucas` (padrão). Para criar um tema novo, copie `themes/elucas/` para
`themes/<seu-id>/`, edite as cores e selecione no Studio (inspector do projeto).

```yaml
id: meu-tema
name: Meu Tema
brand:
  handle: "meucanal"        # canto superior esquerdo das cenas
  handleAt: "@meucanal"     # rodapé
colors:
  ink: "#0C0C0F"            # fundo
  card: "#16161A"
  red: "#3B82F6"            # cor de acento (badges, bordas) — não precisa ser vermelho
  redSoft: "#93C5FD"
  tint: "rgba(59,130,246,0.12)"
  tintBorder: "rgba(59,130,246,0.30)"
  fg: "#ECECEF"            # texto principal
  body: "#B4B4BC"
  mute: "#87878F"
  line: "rgba(255,255,255,0.09)"
  glow: "rgba(59,130,246,0.18)"   # brilho radial de fundo
fonts:
  sans: "'Inter', system-ui, sans-serif"
  mono: "'JetBrains Mono', monospace"
fontFaces:                 # opcional: fontes próprias (arquivos em themes/<id>/assets/)
  - { family: "Inter", weight: 600, src: "assets/inter-600.woff2" }
backdrop:
  grid: dots               # "dots" | "cells"
```

Empacotar/compartilhar: `node cli.mjs export-theme <id>` gera `<id>.rvtheme`
(zip); importar: `node cli.mjs import <arquivo>.rvtheme --id <novo-id>` ou o botão
**importar ▾ → tema** no Studio.

## Templates de cena — `templates/scenes/<id>/manifest.yaml`

Cada template é um card na galeria "+ nova cena". O manifesto diz **o que a cena é**
(`scene`: type/layout + defaults) e **quais campos aparecem no inspector** (`fields`).
Um template que **reusa uma moldura existente** (desktop, celular, passo, etc.) é
só um arquivo YAML — sem tocar em JS.

```yaml
id: passo-simples
name: "Passo (simples)"
desc: "Cartão de passo só com título"
formato: tutorial
order: 25                  # posição na galeria
scene: { type: passo, numero: 1, total: 1, duration: 4 }
fields:
  - { name: titulo, label: "título", type: text, default: "Título" }
  - { name: subtitulo, label: "subtítulo", type: text }
thumb: thumb.svg           # miniatura da galeria (arquivo no mesmo dir)
```

Tipos de `field` suportados: `text` (com `mono: true`), `textarea` (`rows`),
`number` (`step`), `check`, `select` (`options`), `asset` (`kind: gravacao|print`),
`group` (com `fields:` aninhados — ex. `highlight` x/y/w/h), `list` (com `item:`,
um sub-schema — ex. as `linhas` do terminal). Cada field pode ter `default`.

As molduras existentes que os templates reusam (via `scene.type`/`scene.layout`):
`camera-intro`, `passo`, `codigo`, e `video`/`image` com layout `desktop`, `celular`,
`callout` ou `raw`. **Uma moldura visual NOVA** (um desenho de cena inédito) ainda
exige um componente no `engine/reel-kit.jsx` + branch no `templates/tutorial.jsx` —
o interpretador declarativo que elimina isso é uma fase futura.

Empacotar: `node cli.mjs export-template <id>` → `<id>.rvtemplate`; importar:
`node cli.mjs import <arquivo>.rvtemplate --id <novo-id>` ou **importar ▾ → template**.

## Como funciona por dentro

- O servidor (`cli.mjs`) parseia o YAML e serve JSON: `GET /api/themes`,
  `GET /api/theme/<id>`, `GET /api/scene-templates`. O navegador nunca vê YAML.
- No render/preview, o player injeta `window.__THEME` antes do `reel-kit.jsx`, que
  lê os tokens (com o tema `elucas` como fallback embutido — sem tema, nada muda).
- O Studio monta a galeria e o inspector a partir de `/api/scene-templates`
  (com um catálogo embutido de fallback se estiver offline).
