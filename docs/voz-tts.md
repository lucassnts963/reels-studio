# Voz / narração (gravada + TTS)

A narração pode vir da **sua voz gravada** (como sempre foi no tutorial) ou de **TTS**
(texto → voz) por um provedor. O TTS entra no **mesmo pipeline** da voz gravada: gera um
áudio, normaliza (loudness/gate/highpass) e mede a duração — então o render e a timeline
funcionam igual, sem código novo.

## Provedores e chaves (só via env — nunca no código/UI)

- **ElevenLabs** (padrão): `ELEVENLABS_API_KEY` (obrigatória) e `ELEVENLABS_VOICE_ID`
  (id da voz; ou informe por chamada). Modelo padrão `eleven_multilingual_v2`.
- **OpenAI TTS**: `OPENAI_API_KEY`. Vozes fixas (`alloy`/`echo`/`fable`/`onyx`/`nova`/
  `shimmer`), modelo padrão `tts-1`.
- Padrão de provedor: `TTS_PROVIDER` (senão `elevenlabs`).

As chaves ficam **no ambiente** de quem roda o `cli.mjs`/servidor (nunca commitadas). Jeito
mais simples: **copie `.env.example` para `.env`** na raiz do repo e preencha — o `cli.mjs`
lê o `.env` automaticamente (vale para o CLI, o servidor e o `node cli.mjs` que o plugin do
Cowork dispara). O `.env` está no `.gitignore`. Alternativa: exportar as env vars no sistema.
**O texto da narração é enviado ao provedor externo** (ElevenLabs/OpenAI) para sintetizar.

## Uso

CLI:
```bash
# narração do projeto todo (usa a env de voz)
node cli.mjs tts <slug> --text "Seu texto aqui."
# narração de UMA cena (usa o roteiro da cena se --text for omitido)
node cli.mjs tts <slug> --scene s-passo1
# escolher provedor/voz na chamada
node cli.mjs tts <slug> --provider openai --voice nova --text "..."
# quiz: sem --text usa a própria question
node cli.mjs tts <slug-do-quiz>
# listar vozes
node cli.mjs voices --provider elevenlabs
```

Config por projeto (opcional) no `project.json`: `"voz": { "provider": "elevenlabs",
"voice": "<id>", "model": "..." }` — sobrescreve os defaults de env.

Rotas do Studio: `POST /api/tts/:slug` e `POST /api/tts-cena/:slug/:sceneId`
(body `{ text?, provider?, voice?, model? }`), `GET /api/voices?provider=`.

MCP (plugin Cowork): `tts_generate { slug, sceneId?, text?, provider?, voice? }` e
`list_voices { provider? }`.

## Onde a narração aparece

- **tutorial** e **noticias**: narração por cena (o take/TTS de cada cena define a duração).
- **quiz**: narração da pergunta — a cena da pergunta fica no ar pelo tempo da fala.
- lista/história: sem narração por enquanto (só música de fundo).
