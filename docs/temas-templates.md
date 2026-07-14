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
`callout` ou `raw`. Para **uma moldura visual NOVA** (um desenho de cena inédito)
você não precisa mais de JS: descreva o layout no próprio manifesto com a chave
`layout` (ver abaixo).

Empacotar: `node cli.mjs export-template <id>` → `<id>.rvtemplate`; importar:
`node cli.mjs import <arquivo>.rvtemplate --id <novo-id>` ou **importar ▾ → template**.

## Layout declarativo (moldura nova só com YAML)

Um template de cena de **tutorial** pode trazer uma chave `layout`: uma lista de
**nós** que descrevem a moldura visual. Quando existe, o render desenha a cena com o
interpretador (`engine/layout-renderer.jsx`) em vez das molduras JSX embutidas.
Acrescentar um layout inédito passa a ser **só um arquivo** — nenhum JS.

Cada nó tem um `type` e, quando posicionado no canvas 1920×1080, `x`/`y`/`w`/`h` (px):

- `type: text` — `text` (string). Ex.: `text: "“{frase}”"`.
- `type: image` — `src` (binding), `fit` (`cover`/`contain`), `radius`, `kenBurns: true`.
- `type: video` — `src`, `trimStart`, `loop`, `fit`, `radius` — **herda a janela de
  tempo da cena** (start/end automáticos, sem repetir o vídeo à mão).
- `type: rect` — caixa só de estilo (fundo/borda/gradiente).
- `type: row` / `type: col` — flexbox com `gap`, `align`, `justify` e `children: []`.
- `type: frame` — moldura reutilizável: `kind: browser` (com `url`) ou `kind: phone`,
  e `children` no conteúdo.

Extras de qualquer nó: `if: <campo>` (só renderiza se `scene[campo]` for verdadeiro),
`anim: pop | fade | none` (entrada/saída animada) e `style: {}`.

**Bindings**: em `text`/`src`/`url`, `{campo}` vira `scene[campo]`; `{campo|fallback}`
usa o fallback quando vazio. **Tokens do tema**: em qualquer valor de `style`, `$token`
(ex.: `$fg`, `$red`, `$card`, `$mono`) é resolvido pelo tema atual — então a moldura
acompanha a troca de tema automaticamente.

Chaves de `style` (apelidos → CSS): `size`→fontSize, `weight`, `color`, `bg`→background,
`border`, `shadow`, `radius`, `padding`, `lineHeight`, `letterSpacing`, `maxWidth`,
`align`→textAlign, `uppercase`, `fit`→objectFit, `font` (`sans`/`mono`/família CSS).
Qualquer outra chave passa direto como CSS.

```yaml
id: citacao
name: "Citação"
formato: tutorial
order: 15
scene: { type: citacao, duration: 5 }
fields:
  - { name: frase, label: "frase", type: textarea, rows: 3, default: "Sua frase aqui." }
  - { name: autor, label: "autor", type: text }
layout:
  - type: text
    x: 200
    y: 380
    w: 1520
    anim: pop
    text: "“{frase}”"
    style: { size: 84, weight: 700, color: $fg, lineHeight: 1.15 }
  - type: text
    if: autor
    x: 200
    y: 760
    w: 1520
    anim: fade
    text: "— {autor}"
    style: { size: 36, color: $red, font: mono }
thumb: thumb.svg
```

Templates de exemplo já inclusos: `templates/scenes/citacao` (texto puro) e
`templates/scenes/destaque-imagem` (imagem full-bleed + vinheta + título). As 9
molduras built-in (sem `layout`) continuam desenhadas pelo JSX — o interpretador é
**aditivo**, então elas não mudam.

## Como funciona por dentro

- O servidor (`cli.mjs`) parseia o YAML e serve JSON: `GET /api/themes`,
  `GET /api/theme/<id>`, `GET /api/scene-templates`. O navegador nunca vê YAML.
- No render/preview, o player injeta `window.__THEME` antes do `reel-kit.jsx`, que
  lê os tokens (com o tema `elucas` como fallback embutido — sem tema, nada muda).
- O Studio monta a galeria e o inspector a partir de `/api/scene-templates`
  (com um catálogo embutido de fallback se estiver offline).
