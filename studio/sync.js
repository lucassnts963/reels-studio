// studio/sync.js — sincronização local-first com o cli.mjs. Host padrão = a
// própria origem (o app É servido pelo cli.mjs, então fetch relativo funciona
// no PC e no celular); localStorage 'reels-studio-host' permite override.
// Se o PC não estiver acessível, tudo falha silenciosamente e a UI segue offline.

const HOST_KEY = 'reels-studio-host';

const Sync = {
  getHost() {
    return localStorage.getItem(HOST_KEY) || '';
  },
  setHost(url) {
    if (!url) localStorage.removeItem(HOST_KEY);
    else localStorage.setItem(HOST_KEY, url.replace(/\/$/, ''));
  },

  // GET rápido (timeout curto) pra saber se o servidor está acessível agora.
  // Retorna a lista de slugs tutorial, ou null se inacessível.
  async ping(timeoutMs) {
    const host = Sync.getHost();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 2000);
    try {
      const res = await fetch(host + '/api/tutorials', { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(t);
      return null;
    }
  },

  async pullProject(slug) {
    const host = Sync.getHost();
    const res = await fetch(host + '/api/tutorial/' + encodeURIComponent(slug));
    if (!res.ok) throw new Error('projeto não encontrado no PC');
    const cfg = await res.json();
    await DB.saveProject(slug, cfg);
    await DB.markProjectSynced(slug);
    return cfg;
  },

  async pushProject(slug) {
    const host = Sync.getHost();
    const project = await DB.getProject(slug);
    if (!project) return;
    const res = await fetch(host + '/api/tutorial/' + encodeURIComponent(slug), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(project.cfg),
    });
    if (!res.ok) throw new Error('falha ao enviar JSON do projeto');
    await DB.markProjectSynced(slug);
    return res.json();
  },

  async pushPendingAssets(slug, onProgress) {
    const host = Sync.getHost();
    const assets = (await DB.listAssets(slug)).filter((a) => !a.synced);
    const pushed = [];
    for (const [i, a] of assets.entries()) {
      const res = await fetch(
        `${host}/api/assets/${encodeURIComponent(slug)}/${a.kind}/${encodeURIComponent(a.filename)}`,
        { method: 'PUT', body: a.blob }
      );
      if (!res.ok) throw new Error(`falha ao enviar ${a.filename}`);
      await DB.markAssetSynced(a.id);
      pushed.push(a);
      if (onProgress) onProgress(i + 1, assets.length);
    }
    return pushed;
  },

  // Fecha o ciclo dos takes gravados offline: depois que um asset audioCena
  // sobe, manda o servidor limpá-lo (ffmpeg) e aplica {src, duracaoSegundos}
  // reais na cena correspondente (match pelo id = nome do arquivo sem ext).
  // meta.trim === false (take com câmera) vira ?trim=0 — sem silenceremove,
  // pro áudio limpo manter a duração exata do vídeo.
  async cleanPushedTakes(slug, pushedAssets) {
    const host = Sync.getHost();
    const takes = pushedAssets.filter((a) => a.kind === 'audioCena');
    if (!takes.length) return false;
    const project = await DB.getProject(slug);
    if (!project) return false;
    let changed = false;
    for (const a of takes) {
      const sceneId = a.filename.replace(/\.[^.]+$/, '');
      const trim = a.meta && a.meta.trim === false ? '?trim=0' : '';
      const res = await fetch(`${host}/api/audio-cena/${encodeURIComponent(slug)}/${encodeURIComponent(sceneId)}${trim}`, { method: 'POST' });
      if (!res.ok) continue; // take sem cena correspondente não trava o sync
      const audio = await res.json();
      const scene = (project.cfg.scenes || []).find((s) => s.id === sceneId);
      if (!scene) continue;
      scene.audio = { src: audio.src, duracaoSegundos: audio.duracaoSegundos };
      changed = true;
    }
    if (changed && typeof relayoutScenes === 'function') {
      project.cfg.scenes = relayoutScenes(project.cfg.scenes);
      project.cfg.narracao = { ...(project.cfg.narracao || {}), duracaoSegundos: bodyDuration(project.cfg.scenes) };
      await DB.saveProject(slug, project.cfg);
      await Sync.pushProject(slug);
    }
    return changed;
  },

  // Sincroniza um projeto inteiro: JSON + assets pendentes + limpeza de takes.
  // Não lança se o host estiver inacessível — resolve com { ok: false }.
  async syncProject(slug, onProgress) {
    const reachable = await Sync.ping();
    if (reachable === null) return { ok: false, reason: 'offline' };
    try {
      await Sync.pushProject(slug);
      const pushed = await Sync.pushPendingAssets(slug, onProgress);
      const cleaned = await Sync.cleanPushedTakes(slug, pushed);
      return { ok: true, assetsSent: pushed.length, takesCleaned: cleaned };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  },

  // Lista projetos remotos (tutorial) que ainda não existem localmente.
  async remoteOnlyProjects() {
    const remoteSlugs = await Sync.ping();
    if (!remoteSlugs) return [];
    const local = await DB.listProjects();
    const localSlugs = new Set(local.map((p) => p.slug));
    return remoteSlugs.filter((s) => !localSlugs.has(s));
  },
};

window.Sync = Sync;
