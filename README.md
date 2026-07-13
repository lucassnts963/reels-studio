# reels-studio

Automação da produção de Reels elucas.dev (1080×1920): você escreve **um JSON de conteúdo**, a ferramenta cuida do resto — layout, animação, marca e o **MP4 final**, renderizado localmente (Chrome headless + ffmpeg), sem depender de nenhum host.

Baseado no pacote-guia original (motor `animations.jsx` + kit de marca `reel-kit.jsx`).

## Fluxo

```bash
node cli.mjs new meu-reel --formato lista   # cria content/meu-reel.json
#  → edite o JSON (só texto)
node cli.mjs validate meu-reel              # confere limites de caracteres
node cli.mjs serve                          # preview: http://127.0.0.1:5173/player/player.html?reel=meu-reel
node cli.mjs render meu-reel                # gera out/meu-reel.mp4 (pronto pro Instagram)
node cli.mjs render --all                   # renderiza todos
node cli.mjs list                           # lista reels + status
```

## Produção em lote (YouTube Shorts)

```bash
node lotes/dia01.mjs                        # gera os 24 JSONs do dia 1 (exemplo de lote)
node cli.mjs import quiz-shorts-30dias.xlsx # OU importa planilha (aba "quizzes") -> content/*.json
node cli.mjs render --all                   # renderiza tudo
node cli.mjs planilha                       # out/publicacao.xlsx: dia, hora, título, descrição, tags
node cli.mjs musica --all                   # embute trilha (faixas em musica/) -> out-com-musica/
```

Colunas da planilha de import: `slug, tag, hook1, hookSub, question` (linhas separadas por `|`), `optionA..C, correta (A/B/C), reveal, fonte, dificuldade, dia, hora, yt_titulo, yt_descricao, yt_tags`.

**Música:** baixe faixas liberadas na YouTube Audio Library (studio.youtube.com → Biblioteca de áudio, filtro "Sem atribuição obrigatória") para a pasta `musica/`. O `musica --all` rotaciona as faixas entre os vídeos, com fade-out no final. Upload manual: use `out-com-musica/`; a planilha `out/publicacao.xlsx` tem título/descrição/tags prontos pra copiar e colar, na ordem de publicação (1/hora).

## Formatos

| formato    | estrutura                                            | exemplo em content/    |
|------------|------------------------------------------------------|------------------------|
| `lista`    | gancho → N itens (keycap + frase) → CTA              | `atalhos-excel.json`   |
| `quiz`     | gancho → pergunta → opções → contagem → resposta → CTA | `quiz-binario.json`  |
| `historia` | gancho → seções (texto / chips-fluxo / stats) → CTA  | `case-em-dia.json`     |
| `custom`   | JSX livre em `custom/` (cenas sob medida)            | `dica-flash-fill.json` |

Duração se ajusta sozinha ao conteúdo (ex.: lista com 5 itens ≈ 14s).

## Limites de texto (pra não quebrar o layout)

- **lista**: gancho ~22 chars/linha · item ~28 · badge ~12 · 3 a 7 itens
- **quiz**: pergunta ~24 chars/linha (use `\n`) · 2 a 4 opções (1 `correct`) · opção ~18
- **historia**: hook ~16/linha · título de seção ~24/linha · 2 a 4 seções

`validate`/`render` avisam quando algo passa do limite.

## Regras da marca (não mexer)

Só o vermelho `#E5484D` como destaque · fundo escuro sempre · IBM Plex Sans/Mono · nada de azul/verde/laranja. Tudo isso já está em `engine/reel-kit.jsx`.

## Como o render funciona

`cli.mjs render` sobe um servidor local, abre o player no Chrome headless (viewport 1080×1964 ⇒ canvas em escala 1:1), avança o timeline frame a frame pelo evento síncrono `data-om-seek-to-time-frame` do Stage, captura cada frame e monta o MP4 (H.264, 30fps, yuv420p) com `tools/ffmpeg.exe`. ~45s para um reel de 14s.

Requisitos: Node 18+, Google Chrome instalado, `pnpm install` (puppeteer-core), `tools/ffmpeg.exe` (já incluso; se faltar: release `b6.0` de eugeneware/ffmpeg-static, `ffmpeg-win32-x64.gz`).

O vídeo sai **sem áudio** — adicione a trilha no próprio Instagram (melhor pro alcance, aliás).
