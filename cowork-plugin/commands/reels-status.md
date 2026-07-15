---
description: Resumo dos projetos reels-studio e do que está renderizando (feito/pendente/desatualizado)
---

Chame a tool MCP `list_projects` (do servidor reels-studio) e a `render_status` (sem slug)
e apresente um resumo:

1. `list_projects` → total por status (feito / desatualizado / pendente), por formato se útil.
2. `render_status` → jobs em andamento (slug + %) e a fila, se houver.

Se o usuário passou um argumento em `$ARGUMENTS`, trate como filtro de formato
(quiz/lista/historia/tutorial) e passe em `list_projects { formato }`.
