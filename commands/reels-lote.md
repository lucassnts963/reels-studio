---
description: Renderiza em lote (fila sequencial, não bloqueia) — pendentes/desatualizados ou por formato
argument-hint: "[formato|pendentes|todos]"
---

Renderize em lote com as tools MCP do reels-studio. Interprete `$ARGUMENTS`:

- vazio ou `pendentes` → `render_batch { status: "pendentes+desatualizados" }`
- `todos` → `render_batch { status: "todos" }`
- um formato (`quiz`/`lista`/`historia`/`tutorial`) → `render_batch { formato: "<f>", status: "pendentes+desatualizados" }`

Depois de enfileirar, acompanhe com `render_status` (sem slug) periodicamente e vá
reportando o progresso (quantos feitos / na fila / renderizando agora com %). O render é
**um por vez**; pode levar bastante tempo no lote — avise. Use `render_stop` se o usuário pedir.
