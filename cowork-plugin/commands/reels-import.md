---
description: Importa uma planilha .xlsx (abas quizzes/listas/historias) criando vários projetos
argument-hint: "<caminho da planilha .xlsx>"
---

Importe a planilha **$ARGUMENTS** com a tool MCP `import_spreadsheet { path: "$ARGUMENTS" }`.

- Reporte quantos projetos foram criados e quantos vieram com avisos (revisar antes de renderizar).
- Se `$ARGUMENTS` estiver vazio, explique o formato esperado: uma aba por formato
  (`quizzes`, `listas`, `historias`), colunas em `skills/reels-studio/reference/formatos.md`.
- Depois, sugira `/reels-lote` para renderizar os importados, ou `/reels-status` para conferir.
