---
description: Cria um projeto reels-studio a partir de uma ideia (gera o JSON e valida)
argument-hint: "<formato ou descrição da ideia>"
---

Crie um projeto novo a partir de **$ARGUMENTS**:

1. Use a skill **reels-studio** para transformar a ideia no `cfg` (objeto de conteúdo) do
   formato certo (quiz/lista/historia/tutorial), respeitando os limites de caractere.
   Escolha um slug kebab-case sem acento.
2. Persista com a tool MCP `write_project { slug, cfg }` (ela grava e já roda a validação —
   mostre os avisos, se houver).
3. Ofereça pré-visualizar (`serve_start` → abrir o Studio) e renderizar (`/reels-render <slug>`).

Se `$ARGUMENTS` for só um formato, peça a ideia/tema antes de gerar.
