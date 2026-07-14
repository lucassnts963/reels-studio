# Prompt: Gerador de estrutura JSON — reels-studio CLI

> Cole este prompt inteiro em uma conversa nova, e no final adicione a sua
> ideia (pode ser só um parágrafo solto, ou uma das ideias que saiu do
> `gerar-ideias.md`). O resultado é um JSON pronto para salvar em
> `content/<slug>.json` e renderizar com `node cli.mjs render <slug>`.

---

Você vai transformar uma ideia de vídeo em um arquivo JSON que o `reels-studio`
(um CLI que renderiza vídeos automaticamente a partir de JSON) consegue ler.
Siga **exatamente** os schemas abaixo — o CLI valida os campos e limites de
caracteres, então formato errado quebra o vídeo.

## Regras gerais

- Responda **só com o JSON**, em um bloco de código, sem explicação antes ou
  depois (a menos que eu peça uma explicação à parte).
- Escolha o `formato` mais adequado à ideia (`quiz`, `lista`, `historia` ou
  `tutorial`) — se eu já disse qual formato usar, use esse.
- O `slug` (nome do arquivo, ex.: `content/docker-em-5-min.json`) não vai
  dentro do JSON — me diga o slug sugerido **antes** do bloco de código, em
  uma linha separada, formato `slug: meu-slug-aqui` (kebab-case, sem acento).
- Textos em português, sem emoji dentro do JSON (o layout já tem ícones/cores
  próprios).
- Respeite os limites de caracteres por linha — eles existem porque o texto
  precisa caber no cartão sem cortar. Se o texto natural ficar maior, corte
  para o essencial, não abrevie de forma estranha.

## Formato `quiz` (curto, ~15s, vertical 1080x1920)

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
  "reveal": "Explicação curta da resposta (~34 chars/linha).",
  "ctaTitle": "Acertou? Comenta aí.",
  "handleSub": "tech · produtividade · IA"
}
```
Limites: `question` ≤24 chars/linha · `options[].text` ≤18 chars/linha ·
`reveal` ≤34 chars/linha. 2 a 4 `options`, **exatamente uma** com
`correct: true`.

## Formato `lista` (curto, ~15-20s, vertical)

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
Limites: `hook1`/`hook2` ≤22 chars/linha · `items[].badge` ≤12 chars ·
`items[].text` ≤28 chars/linha. 3 a 7 `items`.

## Formato `historia` (curto, ~20-25s, vertical)

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
Limites: `hook.line1`/`hook.line2` ≤16 chars/linha · `hook.punch` ≤30 ·
`sections[].title` ≤24 chars/linha · `sections[].body` ≤38 chars/linha ·
`sections[].punch` ≤30 · `cta.title` ≤24 chars/linha. 2 a 4 `sections`
(cada seção pode ter `body`+`punch` OU um `widget` do tipo `stats`, não
precisa dos dois).

## Formato `tutorial` (longo, 1-5 min, **paisagem** 1920x1080)

```json
{
  "formato": "tutorial",
  "tag": "Docker",
  "titulo": "Docker do zero em 5 minutos",
  "intro": { "titulo": "Lucas Santos", "subtitulo": "tutoriais de tech, direto ao ponto", "duracao": 2.4 },
  "outro": { "cta": "INSCREVA-SE", "sub": "toda semana, um tutorial novo", "duracao": 3.2 },
  "narracao": { "raw": "", "limpo": "", "duracaoSegundos": 10 },
  "scenes": [
    { "type": "video", "layout": "desktop", "src": "gravacoes/<slug>/passo1.mp4", "duration": 5, "start": 0, "end": 5, "trimStart": 0, "numero": 1, "caption": "Passo 1: instale o Docker", "roteiro": "Fala completa que eu vou narrar enquanto gravo essa cena, frase a frase." },
    { "type": "image", "layout": "celular", "src": "prints/<slug>/tela2.png", "duration": 4, "start": 5, "end": 9, "badge": "RESPONSIVO", "titulo": "Também no celular", "texto": "O mesmo app rodando em mobile.", "roteiro": "Fala completa da segunda cena." }
  ],
  "camera": {
    "src": "gravacoes/<slug>/camera.mp4",
    "position": "bottom-right",
    "size": 280,
    "trimStart": 0
  }
}
```
`camera` é **opcional** — só inclua se eu disser que vou gravar webcam. Quando
presente, vira uma bolha circular (PiP) sobreposta às cenas durante todo o
corpo do vídeo. `position` é um de `bottom-right`/`bottom-left`/`top-right`/
`top-left`. Se eu gravar rosto+voz juntos na câmera (em vez de narração
separada), a mesma gravação de câmera pode virar a narração também — nesse
caso oriente a colocar uma cópia (ou o mesmo arquivo) em
`narracao/raw/<slug>.mp4`; o comando `audio` extrai só o áudio dela.

### Layouts de cena (`scenes[].layout`)

Cada cena de `type: "video"` ou `"image"` escolhe uma moldura visual. **Pergunte
sempre se a gravação daquela cena foi feita no computador ou no celular** — a
moldura certa depende disso, não são intercambiáveis:

- **`"desktop"`** (padrão se omitido) — janela de navegador (barra de título +
  URL) emoldurando a gravação. Use quando a cena foi **gravada no PC** (tela
  do computador, navegador, editor de código visual). Campos extras: `url`
  (texto da barra de endereço, opcional), `numero` (mostra badge "PASSO NN" —
  omita se não quiser o número), `caption` (legenda no rodapé).
- **`"celular"`** — mockup de telefone ao lado de um painel de texto. Use
  quando a cena foi **gravada no celular** (app mobile, site responsivo no
  navegador do celular). Campos extras: `badge` (pílula pequena em cima, ex.
  "RESPONSIVO"), `titulo` (título grande), `texto` (parágrafo de apoio),
  `comando` (linha estilo terminal, opcional).
- **`"callout"`** — print/gravação em tela cheia com uma caixa de destaque +
  cartão de anotação apontando pra um ponto específico. Use pra chamar atenção
  a um botão/elemento específico. Campos extras: `highlight: {x,y,w,h}`
  (posição da caixa em pixels do canvas 1920×1080), `title`, `body`.
- **`"raw"`** — mídia em tela cheia sem moldura nenhuma, só `caption` embaixo
  (o comportamento mais simples, sem chrome de dispositivo).

Além disso, tipos de cena **sem mídia de tela anexada**:
- **`type: "camera-intro"`** — abertura talking-head: você grande na tela
  (câmera) + título ao lado. Campos: `badge` (pílula pequena, opcional),
  `titulo`, `subtitulo`. O vídeo grande é a própria gravação de câmera desta
  cena (o take, gravado com câmera no Studio); o áudio do take vira a narração.
  Bom como primeira cena do tutorial.
- **`type: "passo"`** — cartão de transição com número grande + título. Campos:
  `numero`, `total`, `titulo`, `subtitulo`.
- **`type: "codigo"`** — janela de terminal com comandos/saída pré-escritos
  (não precisa gravar nada). Campo `linhas`: lista de
  `{ "prompt": "$", "texto": "docker build -t app .", "cor": "#B4B4BC" }`
  (prompt e cor são opcionais).

Regras importantes:
- `narracao.duracaoSegundos` **não invente um número final** — isso é medido
  automaticamente pelo comando `node cli.mjs audio <slug>` depois que eu gravar
  a narração. Pode deixar um valor provisório (ex. `10`) só pra não travar a
  validação antes de eu gravar.
- `scenes[].duration` — duração estimada da cena em segundos; a **fonte de
  verdade** do timing. `start`/`end` são derivados dela em sequência (segundos
  relativos ao início da narração; 0 = quando a fala começa) — preencha os três
  de forma consistente (`start` = soma das durações anteriores,
  `end = start + duration`). O Studio recalcula tudo automaticamente depois.
- Campos que **você não deve gerar** (são criados pelo Studio): `scenes[].id`
  (identificador do take de áudio) e `scenes[].audio` (take de narração por
  cena, gravado e limpo pela interface).
- `outro.media` (opcional): mostra o resultado final na tela de fechamento —
  `{ "tipo": "celular"|"desktop"|"ambos", "srcCelular": "...", "srcDesktop": "..." }`
  com prints/gravações do projeto. Sugira quando o tutorial termina com algo
  visual (app pronto, site no ar), especialmente `"ambos"` em projetos
  responsivos.
- `scenes[].src` aponta para arquivos que **eu ainda vou gravar/printar** e
  colocar em `gravacoes/<slug>/` (vídeo, gravação de tela) ou `prints/<slug>/`
  (imagem estática). Use nomes de arquivo descritivos (`passo1.mp4`,
  `tela-config.png`), não precisa existir ainda.
- `scenes[].caption` ≤60 chars/linha, opcional.
- `scenes[].roteiro` — **sempre preencha**, com a fala completa (em português,
  do jeito que eu vou narrar) daquela cena específica. Esse texto **aparece na
  tela como teleprompter** quando eu gravo pelo app móvel — é o que me ajuda a
  falar no ritmo certo pra bater com o tempo da cena (`end - start`). Não sai
  no vídeo final, é só apoio de leitura.
- Pelo menos 1 cena. Roteirize as cenas na ordem que eu preciso gravar a tela.

## Depois de gerar

Ao final, me lembre em uma linha dos próximos comandos (adapte ao slug e
formato reais):
```
node cli.mjs new <slug> --formato <formato>   # se ainda não existir o arquivo
node cli.mjs validate <slug>
node cli.mjs render <slug>
```
Para `tutorial`, lembre também de gravar os assets nas pastas certas e rodar
`node cli.mjs audio <slug>` antes do render (ou usar a interface `node cli.mjs
serve` → `/studio/`).

---

**Minha ideia:**
[cole aqui a ideia — pode ser um parágrafo solto ou uma linha do lote de ideias]
