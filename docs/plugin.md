# Plugin reels-studio (Claude Cowork / Claude Code)

Roda **todas as operações do reels-studio como ferramentas nativas** dentro do Claude
Cowork desktop (ou Claude Code): criar/validar/renderizar projetos, render em lote
(não-bloqueante), importar Excel/pacotes, limpar áudio, exportar, listar temas/templates.
O repositório **é** o plugin — o servidor MCP roda daqui e usa o `cli.mjs`, o
`tools/ffmpeg.exe`, o Chrome e o `node_modules` deste repo.

## Requisitos

- `pnpm install` já rodado neste repo (traz `@modelcontextprotocol/sdk`, puppeteer-core, etc).
- Node 18+ e Google Chrome instalados (o render usa Chrome headless).
- `tools/ffmpeg.exe` presente (já vem no repo).

## Instalar como plugin local

O plugin é este diretório (tem `.claude-plugin/plugin.json`). Para habilitar:

- **Claude Code**: `claude plugin install --local .` (na raiz do repo) — ou adicione ao
  `.claude/settings.json`:
  ```json
  { "enabledPlugins": { "reels-studio": true } }
  ```
- **Claude Cowork desktop**: aponte o Cowork para este diretório como plugin local
  (Configurações → Plugins → instalar de pasta local), selecionando a raiz do repo.

Ao habilitar, o Cowork sobe o servidor MCP (`node ${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs`) e
as ferramentas `reels-studio` ficam disponíveis, junto da skill e dos comandos.

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

## Skill

`skills/reels-studio/` — gera ideias e monta os arquivos (schema/limites/colunas em
`reference/formatos.md`). Outras skills (ex.: um gerenciador de calendário) podem ser
colocadas em `skills/<nome>/` e são descobertas automaticamente.

## Observações

- O servidor MCP resolve a raiz por `CLAUDE_PLUGIN_ROOT` (a pasta do plugin = este repo);
  em teste fora do Cowork, cai no diretório pai de `mcp/`. Dá para forçar com a env
  `REELS_ROOT`.
- O render abre o Chrome e usa CPU/tempo reais (um quiz curto ~1–2 min); o lote de centenas
  leva horas — por isso é não-bloqueante e sequencial.
