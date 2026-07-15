# reels-studio — schemas, limites e colunas de planilha

Fonte de verdade dos campos. Respeite os limites (o texto precisa caber no cartão).
Português, sem emoji dentro do JSON. Slug em kebab-case sem acento, fora do JSON.

## quiz (curto, ~15s, vertical 1080×1920)

```json
{
  "formato": "quiz",
  "tag": "Excel",
  "hook1": "VOCÊ SABIA?",
  "hookSub": "Teste rápido",
  "question": "Pergunta em até\ntrês linhas\nde ~24 chars cada",
  "options": [
    { "text": "Opção A", "correct": false },
    { "text": "Opção B", "correct": true },
    { "text": "Opção C", "correct": false }
  ],
  "reveal": "Explicação curta da resposta.",
  "ctaTitle": "Acertou? Comenta aí.",
  "handleSub": "tech · produtividade · IA"
}
```
Limites: `question` ≤24 chars/linha (use `\n`) · `options[].text` ≤18 · `reveal` ≤34.
2 a 4 `options`, **exatamente uma** `correct: true`. Opcional: `theme`, `template`
(`classico`/`cartoes`).

## lista (curto, ~15-20s, vertical)

```json
{
  "formato": "lista",
  "tag": "Atalhos",
  "hook1": "Gancho linha 1",
  "hook2": "linha 2 (vermelha)",
  "hookSub": "salva pra não esquecer ↓",
  "items": [
    { "badge": "Ctrl + Z", "text": "O que esse item faz" },
    { "badge": "", "text": "badge vazio vira número" }
  ],
  "ctaTitle": "Pergunta de fechamento?",
  "ctaSub": "Comenta aí e salva o post.",
  "handleSub": "tech · produtividade · IA"
}
```
Limites: `hook1`/`hook2` ≤22 chars/linha · `items[].badge` ≤12 · `items[].text` ≤28.
3 a 7 `items`. Opcional: `theme`.

## historia (curto, ~20-25s, vertical)

```json
{
  "formato": "historia",
  "tag": "Case",
  "hook": { "line1": "Linha um", "line2": "linha dois.", "punch": "Punch em vermelho." },
  "sections": [
    { "eyebrow": "// O problema", "title": "Título da seção\nem até 3 linhas.", "body": "linha de apoio.", "punch": "Punch da seção." },
    { "eyebrow": "// Resultado", "widget": { "type": "stats", "rows": [["Nº", "descrição"], ["Nº", "descrição"]] } }
  ],
  "cta": { "top": "linha mono em cima", "title": "fechamento forte\nem duas linhas." },
  "handleSub": "tech · produtividade · IA"
}
```
Limites: `hook.line1`/`line2` ≤16 · `hook.punch` ≤30 · `sections[].title` ≤24/linha ·
`sections[].body` ≤38 · `sections[].punch` ≤30 · `cta.title` ≤24/linha. 2 a 4 `sections`
(cada uma: `body`+`punch` de texto, OU um `widget` `stats`/`flow`). Opcional: `theme`.
Widget `flow`: `{ "type": "flow", "chips": ["a", "b", "c"] }`.

## tutorial (longo, 1-5 min, paisagem 1920×1080)

```json
{
  "formato": "tutorial",
  "tag": "Docker",
  "titulo": "Docker do zero em 5 minutos",
  "intro": { "titulo": "Lucas Santos", "subtitulo": "tutoriais de tech, direto ao ponto", "duracao": 2.4 },
  "outro": { "cta": "INSCREVA-SE", "sub": "toda semana, um tutorial novo", "duracao": 3.2 },
  "narracao": { "raw": "", "limpo": "", "duracaoSegundos": 10 },
  "scenes": [
    { "type": "video", "layout": "desktop", "src": "assets/gravacoes/passo1.mp4", "duration": 5, "start": 0, "end": 5, "numero": 1, "caption": "Passo 1: instale o Docker", "roteiro": "Fala completa da cena." },
    { "type": "image", "layout": "celular", "src": "assets/prints/tela2.png", "duration": 4, "start": 5, "end": 9, "badge": "RESPONSIVO", "titulo": "Também no celular", "texto": "O mesmo app no mobile.", "roteiro": "Fala da segunda cena." }
  ]
}
```
- `narracao.duracaoSegundos`: provisório (ex. 10); medido por `node cli.mjs audio <slug>`.
- `scenes[].duration` é a fonte de verdade do timing; `start`/`end` derivam em sequência
  (relativos ao início da narração). `roteiro`: **sempre** preencha (vira teleprompter).
- Layouts de cena (`video`/`image`): `desktop` (tela de PC, janela de navegador — campos
  `url`/`numero`/`caption`), `celular` (tela de celular, mockup — `badge`/`titulo`/
  `texto`/`comando`), `callout` (destaque num ponto — `highlight:{x,y,w,h}`/`title`/
  `body`), `raw` (tela cheia — só `caption`).
- Cenas sem mídia: `camera-intro` (abertura talking-head — `badge`/`titulo`/`subtitulo`),
  `passo` (`numero`/`total`/`titulo`/`subtitulo`), `codigo` (`titulo`/`linhas:[{prompt,texto,cor}]`/`caption`).
- `camera` (opcional): `{ "src": "assets/gravacoes/camera.mp4", "position": "bottom-right", "size": 280 }`.
- Não gere `scenes[].id` nem `scenes[].audio` (o Studio cria).

## Planilha de importação em lote (uma aba por formato)

`node cli.mjs import <arquivo>.xlsx` — uma linha vira um projeto. Nomeie as abas
**`quizzes`**, **`listas`**, **`historias`** (pelo prefixo). Cada linha precisa de `slug`.

Colunas **comuns**: `slug`, `tag`, `handleSub`, `theme`, `fonte`, `dificuldade`, `dia`,
`hora`, `yt_titulo`, `yt_descricao`, `yt_tags`.

- **quizzes**: `hook1`, `hookSub`, `question` (linhas separadas por `|`), `optionA`,
  `optionB`, `optionC`, `optionD`, `correta` (A/B/C/D), `reveal`, `template`.
- **listas**: `hook1`, `hook2`, `hookSub`, `items` (itens por `|`, cada item
  `badge :: texto` — badge vazio vira número), `ctaTitle`, `ctaSub`.
- **historias**: `hook_line1`, `hook_line2`, `hook_punch`, `sections` (seções por `|`,
  cada seção `eyebrow :: titulo :: body :: punch`; quebra de linha no título com `/`),
  `cta_top`, `cta_title` (quebra de linha com `/`).

Exemplo de célula `items`: `Ctrl + Z :: Desfaz a ação | Ctrl + C :: Copia`.
Exemplo de célula `sections`: `// O erro :: Um DROP sem/o WHERE :: rodou na prod. | // A virada :: Backup salvou`.
