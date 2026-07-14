# Roadmap: reels-studio como SaaS (com IA)

> Documento de planejamento. Nada aqui está implementado — o produto hoje é
> local (CLI + Studio servidos por `node cli.mjs serve`). Este é o caminho
> para transformá-lo num serviço para outros criadores.

## Ponto de partida (o que já ajuda)

- **Tudo é file-driven**: cada vídeo é um `content/<slug>.json` validado por
  `validate()` (cli.mjs). Esse schema já é, na prática, a **API pública** do
  produto — o SaaS expõe exatamente ele.
- **Render headless e portável**: `renderOne()` usa Chrome headless + ffmpeg,
  frame a frame. Roda em container sem mudança de arquitetura — só precisa de
  fila/worker.
- **Studio é estático + REST**: o front (`studio/`) é React sem build servido
  como arquivos; conversa com o servidor por rotas REST simples
  (`/api/tutorial/:slug`, `/api/assets/*`, `/api/render/:slug`, `/api/projects`).
  Trocar o backend local por um multi-tenant não exige reescrever o front.
- **Local-first no cliente**: o Studio já guarda tudo em IndexedDB e sincroniza
  (`store.jsx`/`sync.js`). Num SaaS, o "PC na rede" vira "a nuvem" — o mesmo
  padrão de sync serve, trocando o host local pela API hospedada.

## Camada de IA (o pedido principal desta fase)

Todos os endpoints rodam **no servidor**, com a chave da Claude API guardada lá
— **nunca no cliente**. Usam os prompts já existentes (`prompts/gerar-ideias.md`,
`prompts/gerar-estrutura.md`) como system prompts, e validam a saída contra
`validate()` antes de devolver.

### Endpoints

- `POST /api/ai/ideias` `{ tema, formato? }` → lista de ideias de vídeo. Base:
  `prompts/gerar-ideias.md`.
- `POST /api/ai/estrutura` `{ ideia, formato }` → **primeiro JSON completo** do
  formato, já validado (regenera se `validate()` acusar erro). Base:
  `prompts/gerar-estrutura.md`. É o "gerar do zero → projeto preenchido".
- `POST /api/ai/melhorar-campo` `{ formato, campo, valorAtual, contexto }` →
  versão melhorada de **um** campo (streaming). Para `scenes[].roteiro`, o
  `contexto` inclui **a cena anterior e a seguinte** (título + roteiro), a ideia
  digitada da cena atual e o tipo/layout — para o roteiro fluir com as vizinhas.
- `POST /api/ai/prompt-campo` `{ formato, campo, valorAtual, contexto }` →
  devolve um **prompt pronto** (texto) que o usuário pode copiar/editar/rodar,
  em vez de já aplicar a mudança. É o "criar prompt para melhorar aquele campo".

### UI no Studio (por campo)

Cada campo do inspector/editor ganha dois botões pequenos, atrás de um flag de
conta SaaS (ocultos no uso local):

- ✨ **melhorar** — 1 clique → `melhorar-campo`, com o texto voltando em
  streaming direto no campo (com desfazer).
- **criar prompt** — abre um modal com o resultado de `prompt-campo` para
  copiar. Útil quando o usuário quer ajustar o prompt antes de rodar em outra
  ferramenta.

Fluxo de cena (o pedido específico): o usuário **digita a ideia da cena** num
campo "ideia" e a IA gera `roteiro` (e, opcionalmente, `titulo`/`caption`/
`badge` conforme o tipo/layout) usando as cenas vizinhas como contexto.

Além disso, um botão global **gerar do zero**: tema → `ideias` → o usuário
escolhe → `estrutura` → o projeto abre já preenchido no editor certo do
formato.

### Custos e limites

- Rate-limit e cota por conta (as chamadas de IA são o maior custo variável).
- Cache de ideias por tema; `estrutura` e `melhorar-campo` não são cacheáveis
  (dependem do input do usuário).
- Modelos: usar o Claude mais capaz para `estrutura` (decisão de schema) e um
  mais barato/rápido para `melhorar-campo` de campos curtos.

## O resto do SaaS (fora da IA)

- **Auth + multi-tenant**: projetos por usuário; `content/<slug>.json` vira uma
  linha por usuário (Postgres/objeto em bucket). O front já é agnóstico disso.
- **Render como serviço**: fila de jobs (ex.: Redis/BullMQ) + workers
  headless-Chrome/ffmpeg em containers; `POST /api/render` enfileira e o status
  (já polado hoje) reporta progresso. Cobrança por **minuto renderizado**.
- **Storage de assets**: S3-compatível no lugar de `gravacoes/`/`prints/`/
  `narracao/`; URLs assinadas. O `assetUrl()` do `store.jsx` já abstrai origem.
- **Cliente de captura**: o PWA (Studio) já é local-first — no SaaS ele grava
  offline e sincroniza para a nuvem em vez da LAN. Zero reescrita do fluxo de
  gravação por cena.
- **Planos**: free (marca d'água + limite de minutos), pago (sem marca, mais
  minutos, IA liberada). Alternativa intermediária antes do SaaS hospedado:
  **self-hosted para criadores** (docker-compose com o CLI + Studio + worker),
  que já é quase o estado atual.

## Ordem sugerida (quando esta fase começar)

1. Extrair `BRAND`/coordenadas para `themes/<nome>/theme.json` (file-driven de
   tema — pré-requisito para multi-criador com identidade própria).
2. Auth + storage multi-tenant + fila de render (o "SaaS base", sem IA).
3. Endpoints de IA + botões no Studio (a camada que este documento detalha).
4. Billing + planos.
