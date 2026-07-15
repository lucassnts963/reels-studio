// studio/store.jsx — camada de dados unificada do Studio (local-first).
// Tudo passa por aqui: IndexedDB (db.js) é sempre a primeira escrita;
// quando o servidor (cli.mjs) está acessível, as mudanças sobem na hora.
// No PC o servidor está sempre acessível e o sync é invisível; no celular
// offline o app funciona 100% local e sincroniza quando encontrar o PC.

function useOnline() {
  const [online, setOnline] = React.useState(null); // null = checando
  const check = React.useCallback(async () => {
    const r = await Sync.ping();
    setOnline(r !== null);
    return r !== null;
  }, []);
  React.useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(check, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [check]);
  return [online, check];
}

const Store = {
  // lista unificada (todos os formatos): locais (com status) + só-no-PC.
  async listAll() {
    const local = await DB.listProjects();
    // /api/projects traz {slug, formato} de tudo; se offline, remote = null.
    let remote = null;
    try {
      const r = await fetch(Sync.getHost() + '/api/projects', { signal: AbortSignal.timeout(2500) });
      if (r.ok) remote = await r.json();
    } catch {}
    const remoteBySlug = new Map((remote || []).map((x) => [x.slug, x.formato]));
    const items = local.map((p) => ({
      slug: p.slug,
      formato: p.cfg?.formato || remoteBySlug.get(p.slug) || '?',
      status: p.updatedAt && (!p.syncedAt || p.updatedAt > p.syncedAt) ? 'pendente'
        : p.syncedAt ? 'sincronizado' : 'local',
    }));
    if (remote) {
      const localSet = new Set(local.map((p) => p.slug));
      for (const x of remote) if (!localSet.has(x.slug)) items.push({ slug: x.slug, formato: x.formato, status: 'remoto' });
    }
    items.sort((a, b) => a.slug.localeCompare(b.slug));
    return { items, online: remote !== null };
  },

  // exclui o projeto: apaga no servidor (projects/<slug>/) e no aparelho (IndexedDB).
  async deleteProject(slug, online) {
    if (online) {
      try { await fetch(Sync.getHost() + '/api/project/' + encodeURIComponent(slug), { method: 'DELETE' }); }
      catch (e) { throw new Error('não deu pra excluir no PC: ' + (e.message || e)); }
    }
    await DB.deleteProject(slug);
    await DB.deleteAssets(slug);
  },

  // regra v1 de conflito: local com pendência ganha (e é empurrado);
  // senão o servidor é a fonte e é espelhado no DB.
  async loadProject(slug) {
    const local = await DB.getProject(slug);
    const pending = local && local.updatedAt && (!local.syncedAt || local.updatedAt > local.syncedAt);
    if (pending) {
      Sync.syncProject(slug).catch(() => {});
      return { cfg: local.cfg, source: 'local-pendente' };
    }
    // online: o servidor é a fonte (GET /api/tutorial/:slug lê qualquer formato).
    if (await Sync.ping() !== null) {
      try {
        const cfg = await Sync.pullProject(slug);
        return { cfg, source: 'servidor' };
      } catch { /* não existe no servidor — cai no local */ }
    }
    if (local) return { cfg: local.cfg, source: 'local' };
    throw new Error('projeto não encontrado (nem local, nem no PC)');
  },

  // DB primeiro, sempre; servidor quando online. Devolve warns do validate.
  async saveProject(slug, cfg, online) {
    await DB.saveProject(slug, cfg);
    if (!online) return { ok: true, offline: true, warns: [] };
    try {
      const res = await Sync.pushProject(slug);
      return { ok: true, warns: (res && res.warns) || [] };
    } catch {
      return { ok: true, offline: true, warns: [] };
    }
  },

  kindFromFile(file) {
    const name = file.name || '';
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if ((file.type || '').startsWith('video')) return 'gravacao';
    if ((file.type || '').startsWith('image')) return 'print';
    // MIME vazio (alguns pickers do Android): decide pela extensão.
    if (/\.(mp4|mov|webm)$/.test(ext)) return 'gravacao';
    if (/\.(png|jpe?g|webp)$/.test(ext)) return 'print';
    return null;
  },

  // caminho RELATIVO ao projeto (o mesmo gravado em scene.src e usado como
  // chave de URL local). O slug já é a pasta do projeto, não entra no caminho.
  pathFor(slug, kind, filename) {
    const dir = kind === 'gravacao' ? 'assets/gravacoes'
      : kind === 'print' ? 'assets/prints'
      : kind === 'audioCena' ? 'assets/narracao/cenas'
      : 'assets/narracao/raw';
    return `${dir}/${filename}`;
  },

  // anexa um arquivo: DB primeiro; sobe imediatamente se online.
  async attach(slug, file, online, { kind: kindOverride, filename: nameOverride } = {}) {
    const kind = kindOverride || Store.kindFromFile(file);
    if (!kind) throw new Error(`tipo de arquivo não reconhecido: ${file.name}`);
    const filename = nameOverride || (file.name || 'arquivo').replace(/[^\w.\-]+/g, '-');
    const rec = await DB.addAsset(slug, kind, filename, file);
    if (online) {
      try {
        const res = await fetch(`${Sync.getHost()}/api/assets/${encodeURIComponent(slug)}/${kind}/${encodeURIComponent(filename)}`, { method: 'PUT', body: file });
        if (res.ok) await DB.markAssetSynced(rec.id);
      } catch {}
    }
    return { kind, filename, path: Store.pathFor(slug, kind, filename) };
  },

  // grava o take de uma cena. comCamera => webm com vídeo: limpeza sem trim
  // (áudio mantém a duração do vídeo) e o próprio webm vira a bolha PiP.
  async recordTake(slug, scene, blob, { comCamera, online }) {
    const filename = `${scene.id}.webm`;
    await DB.addAsset(slug, 'audioCena', filename, blob, { trim: !comCamera });
    const rawPath = Store.pathFor(slug, 'audioCena', filename);
    const camera = comCamera ? { src: rawPath } : undefined;
    if (online) {
      try {
        const host = Sync.getHost();
        const put = await fetch(`${host}/api/assets/${encodeURIComponent(slug)}/audioCena/${encodeURIComponent(filename)}`, { method: 'PUT', body: blob });
        if (put.ok) {
          const res = await fetch(`${host}/api/audio-cena/${encodeURIComponent(slug)}/${encodeURIComponent(scene.id)}${comCamera ? '?trim=0' : ''}`, { method: 'POST' });
          if (res.ok) {
            const audio = await res.json();
            const a = (await DB.listAssets(slug)).find((x) => x.kind === 'audioCena' && x.filename === filename);
            if (a) await DB.markAssetSynced(a.id);
            return { audio: { src: audio.src, duracaoSegundos: audio.duracaoSegundos }, camera };
          }
        }
      } catch {}
    }
    // offline (ou falha): duração medida do blob cru; o sync limpa depois e
    // substitui por valores reais (flag pendente some).
    const dur = await readMediaDuration(blob);
    return { audio: { src: Store.pathFor(slug, 'audioCena', `${scene.id}.m4a`), duracaoSegundos: dur || 3, pendente: true }, camera };
  },

  // mapa path -> objectURL dos blobs locais (para thumbnails/preview offline
  // e assets ainda não sincronizados). Quem consome revoga na troca de projeto.
  async localUrlMap(slug) {
    const assets = await DB.listAssets(slug);
    const map = {};
    for (const a of assets) {
      map[Store.pathFor(slug, a.kind, a.filename)] = URL.createObjectURL(a.blob);
    }
    return map;
  },

  // assets "visíveis" na UI: servidor (se online) + pendentes locais.
  async listAssets(slug, online) {
    let server = { gravacoes: [], prints: [], audioCenas: [], narracaoRaw: null, narracaoLimpo: null };
    if (online) {
      try { server = await (await fetch(`${Sync.getHost()}/api/assets/${encodeURIComponent(slug)}`)).json(); } catch {}
    }
    const local = await DB.listAssets(slug);
    const add = (list, p) => { if (!list.includes(p)) list.push(p); };
    for (const a of local.filter((x) => !x.synced)) {
      const p = Store.pathFor(slug, a.kind, a.filename);
      if (a.kind === 'gravacao') add(server.gravacoes, p);
      else if (a.kind === 'print') add(server.prints, p);
      else if (a.kind === 'audioCena') add(server.audioCenas, p);
      else if (a.kind === 'narracao' && !server.narracaoRaw) server.narracaoRaw = p;
    }
    server.gravacoes.sort(); server.prints.sort();
    return server;
  },
};

Object.assign(window, { Store, useOnline });
