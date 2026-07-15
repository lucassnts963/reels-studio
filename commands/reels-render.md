---
description: Renderiza um projeto reels-studio (não bloqueia) e acompanha o progresso
argument-hint: "<slug>"
---

Renderize o projeto **$ARGUMENTS** usando as tools MCP do reels-studio:

1. `render_start { slug: "$ARGUMENTS" }` — dispara (retorna na hora).
2. Acompanhe com `render_status { slug: "$ARGUMENTS" }` de tempos em tempos, reportando o
   progresso (%). Pare quando o estado for `done` (informe o caminho do mp4:
   `projects/$ARGUMENTS/render/video.mp4`) ou `error` (mostre o erro).

Se `$ARGUMENTS` estiver vazio, peça o slug ou sugira `/reels-status` para listar os projetos.
