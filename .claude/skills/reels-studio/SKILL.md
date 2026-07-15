---
name: reels-studio
description: Gera ideias de vídeo para o canal elucas.dev e transforma uma ideia em arquivos prontos do reels-studio (project.json de quiz/lista/historia/tutorial, ou uma planilha .xlsx de importação em lote). Use quando o usuário pedir "ideias de vídeo/reel/short", "cria o JSON do reel", "monta o projeto", "gera a planilha de import", ou nomear um formato (quiz, lista, historia, tutorial) do elucas.dev.
---

# reels-studio — ideias e arquivos

O reels-studio transforma **um arquivo de conteúdo (JSON)** em vídeo. Este skill faz
as duas pontas do trabalho manual: (1) **brainstorm de ideias** e (2) **gerar os
arquivos** que o CLI renderiza. Formatos: `quiz`, `lista`, `historia` (verticais curtos)
e `tutorial` (longo horizontal).

Leia `reference/formatos.md` (bundle deste skill) para o schema exato, os limites de
caracteres e as colunas da planilha antes de gerar qualquer arquivo — não invente campos.

## Descobrir o modo

- Pediu **ideias** ("me dá ideias", "brainstorm", "o que gravar essa semana") → **Modo A**.
- Deu uma ideia/tema e quer o **arquivo** ("faz o JSON", "cria o projeto", "monta o reel")
  → **Modo B**.
- Quer produzir **vários de uma vez** ("um lote", "a planilha", "30 quizzes") → **Modo C**.

Se ambíguo, pergunte em uma linha qual dos três.

## Modo A — gerar ideias

Você é roteirista do **elucas.dev** (canal de tecnologia p/ devs e gente de TI). Tom
direto, sem clickbait vazio — o gancho promete algo específico e o conteúdo entrega.
Temas que rendem: Excel/planilhas, atalhos, hardware, história da tecnologia, IA, redes,
segurança, Windows, Docker, Git, terminal, produtividade dev.

Gere a quantidade pedida (padrão **8**). Varie formatos e temas. Para cada ideia:
1. **Formato** (`quiz`/`lista`/`historia`/`tutorial`) · 2. **Tema/tag** · 3. **Gancho**
(a frase de abertura) · 4. **Resumo** (1-2 frases + a virada/payoff) · 5. **Confiança**
(o fato é verificável ou precisa checar fonte antes de gravar).

Numere as ideias e marque com ⭐ as 2-3 mais fortes, dizendo por quê. Não gere JSON aqui.

## Modo B — gerar o arquivo (project.json)

Para a ideia escolhida:
1. Escolha o `formato` e um **slug** kebab-case sem acento (ex.: `docker-em-5-min`).
2. Monte o JSON **exatamente** no schema de `reference/formatos.md`, respeitando os
   limites de caracteres (o texto precisa caber no cartão). Português, sem emoji.
3. **Entregue o arquivo:**
   - **No repositório reels-studio** (existe `cli.mjs`): crie de fato —
     `node cli.mjs new <slug> --formato <formato>` e então escreva o JSON em
     `projects/<slug>/project.json`; rode `node cli.mjs validate <slug>` e conserte o
     que ele apontar. Diga como pré-visualizar (`node cli.mjs serve`) e renderizar
     (`node cli.mjs render <slug>`).
   - **Fora do repo** (Cowork sem o projeto): entregue o slug numa linha e o JSON num
     bloco de código, com a instrução de salvar em `projects/<slug>/project.json`.

Campos opcionais (todos os formatos): `theme` (id do tema — `elucas` padrão, `oceano`
azul). Só no `quiz`: `template` (layout de canal — `classico` padrão, `cartoes`). Só
inclua se o usuário pedir um visual/layout específico.

Para `tutorial`, lembre que `narracao.duracaoSegundos` **não é chutado** — é medido por
`node cli.mjs audio <slug>` depois de gravar; e os assets (`assets/gravacoes/`,
`assets/prints/`, `assets/narracao/raw/`) o usuário grava depois.

## Modo C — planilha de importação em lote (.xlsx)

Gere um `.xlsx` com uma aba por formato — **`quizzes`**, **`listas`**, **`historias`**
(uma linha = um vídeo) — nas colunas de `reference/formatos.md`. Depois:
`node cli.mjs import <planilha>.xlsx` cria todos os `projects/<slug>/`. Requer a lib
`xlsx` (`pnpm add xlsx`, já é dependência do repo). Para escrever o arquivo, use a lib
`xlsx` (`XLSX.utils.json_to_sheet` / `book_append_sheet` / `writeFile`).

Ao final de qualquer modo, lembre em uma linha os próximos comandos (`validate` →
`serve`/`render`, ou `import` no modo lote), adaptados aos slugs reais.
