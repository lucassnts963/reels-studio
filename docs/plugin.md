# Plugin reels-studio (Claude Cowork / Claude Code)

Roda **todas as operações do reels-studio como ferramentas nativas** dentro do Claude
Cowork desktop (ou Claude Code): criar/validar/renderizar projetos, render em lote
(não-bloqueante), importar Excel/pacotes, limpar áudio, exportar, listar temas/templates.

O plugin é **pequeno e autocontido** (pasta `cowork-plugin/`) — o Cowork **copia** o plugin
para um cache ao instalar, então o servidor MCP **não tem dependências** (só Node built-ins)
e alcança o repositório real pela env **`REELS_ROOT`**. É lá (no repo) que ele roda o
`cli.mjs`, com `tools/ffmpeg.exe`, o Chrome e o `node_modules` do repo.

## Requisitos

- Este repo com `pnpm install` já rodado (para o `cli.mjs`: puppeteer-core, xlsx, js-yaml).
- Node 18+ e Google Chrome instalados (o render usa Chrome headless).
- `tools/ffmpeg.exe` presente (já vem no repo).
- No `cowork-plugin/.claude-plugin/plugin.json`, a env `REELS_ROOT` aponta para a **raiz
  deste repo** (padrão `C:\dev\reels-studio`). Ajuste se o repo estiver em outro caminho.

## Instalar (Claude Cowork desktop) — via marketplace (recomendado)

O repo traz um marketplace em `.claude-plugin/marketplace.json` que lista o plugin
`cowork-plugin/`. Em **Configurações → Plugins → Adicionar → Adicionar marketplace**,
aponte para a **raiz do repo** (`C:\dev\reels-studio`). Depois instale o plugin
**reels-studio** que aparece nesse marketplace. Assim o Cowork acompanha atualizações.

Alternativa — **Adicionar → Fazer upload de plugin**: selecione a pasta
**`cowork-plugin/`** (só ela; é pequena e autocontida). Funciona porque o MCP é sem
dependências e usa `REELS_ROOT` para achar o repo.

No **Claude Code** (CLI): `/plugin marketplace add C:\dev\reels-studio` e depois
`/plugin install reels-studio@reels-studio`.

Ao habilitar, o Cowork sobe o servidor MCP (`node ${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs`,
com `REELS_ROOT` no ambiente) e as ferramentas `reels-studio` ficam disponíveis, junto da
skill e dos comandos.

## Ferramentas (MCP)

| ferramenta | o que faz |
|---|---|
| `list_projects` | projetos + status (feito/desatualizado/pendente); filtro por formato |
| `read_project` / `write_project` | lê / grava `projects/<slug>/project.json` (write valida) |
| `create_project` | cria um projeto vazio de um formato |
| `validate` | valida um projeto (limites/campos) |
| `render_start` / `render_status` / `render_batch` / `render_stop` | render **não-bloqueante**: dispara e consulta o progresso; lote sequencial |
| `import_spreadsheet` | importa `.xlsx` (abas quizzes/listas/historias) |
| `import_package` | importa `.rvs` / `.rvtheme` / `.rvtemplate` |
| `clean_audio` | limpa a narração crua e mede a duração |
| `export_project` / `export_theme` / `export_template` | empacota `.rvs` / `.rvtheme` / `.rvtemplate` |
| `list_themes` / `list_quiz_templates` / `list_scene_templates` | catálogos |
| `publish_sheet` | gera `out/publicacao.xlsx` para upload manual |
| `serve_start` / `serve_stop` | sobe/derruba o Studio web (preview/edição) |

O render é **um por vez** (o `render_batch` enfileira); acompanhe com `render_status`.

## Comandos (slash)

- `/reels-ideias [tema]` — gera ideias de vídeo (skill).
- `/reels-novo [ideia]` — ideia → `project.json` (skill + `write_project` + validação).
- `/reels-render <slug>` — renderiza um e acompanha o progresso.
- `/reels-lote [formato|pendentes|todos]` — render em lote.
- `/reels-status [formato]` — resumo dos projetos + do que está renderizando.
- `/reels-import <planilha.xlsx>` — importa em lote.

## Estrutura do plugin

```
.claude-plugin/marketplace.json          # marketplace (lista o plugin)
cowork-plugin/                            # o plugin (pequeno, autocontido)
  .claude-plugin/plugin.json             #   manifesto + MCP (env REELS_ROOT)
  mcp/server.mjs                         #   servidor MCP sem dependências
  commands/*.md                          #   slash-commands
  skills/reels-studio/                   #   skill (ideias/arquivos)
```

## Skill

`cowork-plugin/skills/reels-studio/` — gera ideias e monta os arquivos (schema/limites/
colunas em `reference/formatos.md`). Outras skills (ex.: um gerenciador de calendário)
podem ser colocadas em `cowork-plugin/skills/<nome>/` e são descobertas automaticamente.

## Observações

- O servidor MCP escolhe a raiz do repo em `REELS_ROOT` (ou `CLAUDE_PLUGIN_ROOT`, ou o pai
  de `mcp/`) — o primeiro caminho que tiver `cli.mjs`. Como o Cowork copia o plugin para um
  cache, o `REELS_ROOT` (absoluto, no plugin.json) é o que garante achar o repo real.
- O render abre o Chrome e usa CPU/tempo reais (um quiz curto ~1–2 min); o lote de centenas
  leva horas — por isso é não-bloqueante e sequencial.
