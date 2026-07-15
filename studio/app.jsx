// studio/app.jsx — raiz do Studio unificado (desktop + mobile, local-first).
// Depende de lib.jsx, store.jsx e components.jsx (escopo global compartilhado).

// tela estreita (celular) → navegação por abas em vez do grid NLE.
function useNarrow() {
  const [narrow, setNarrow] = React.useState(() => window.matchMedia('(max-width: 900px)').matches);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function StudioApp() {
  const [online] = useOnline();
  const narrow = useNarrow();
  const [catalog, setCatalog] = React.useState(SCENE_CATALOG_FALLBACK);
  React.useEffect(() => { loadSceneCatalog().then(setCatalog); }, [online]);
  const [slug, setSlug] = React.useState('');
  const [cfg, setCfg] = React.useState(null);
  const [assets, setAssets] = React.useState({ gravacoes: [], prints: [], audioCenas: [], narracaoRaw: null, narracaoLimpo: null });
  const [localUrls, setLocalUrls] = React.useState({});
  const [selection, setSelection] = React.useState({ kind: 'project' });
  const [format, setFormat] = React.useState('landscape');
  const [saveState, setSaveState] = React.useState('—'); // — | dirty | saving | saved | local | erro
  const [warns, setWarns] = React.useState([]);
  const [nonce, setNonce] = React.useState(1);
  const [render, setRender] = React.useState({ state: 'idle' });
  const [gallery, setGallery] = React.useState(false);
  const [jsonView, setJsonView] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState('');
  const [overlay, setOverlay] = React.useState(null); // narrow: null | 'preview' | 'gravar'
  const [gravarWide, setGravarWide] = React.useState(false); // wide: painel central = gravar
  const [homeView, setHomeView] = React.useState('projects'); // home: 'projects' | 'lote'

  const iframeRef = React.useRef(null);
  const saveTimer = React.useRef(null);
  const cfgRef = React.useRef(null);
  cfgRef.current = cfg;
  const onlineRef = React.useRef(online);
  onlineRef.current = online;

  // ── assets/URLs locais ──
  const refreshAssets = async (s) => {
    const sl = s || slug;
    if (!sl) return;
    setAssets(await Store.listAssets(sl, onlineRef.current));
    setLocalUrls((old) => {
      Object.values(old).forEach((u) => URL.revokeObjectURL(u));
      return old; // substituído logo abaixo (fora do setter, valor novo async)
    });
    setLocalUrls(await Store.localUrlMap(sl));
  };
  // p é project-relative (assets/...); serve de /projects/<slug>/<p> quando online,
  // ou do blob local (chave = mesmo p) quando offline/não-sincronizado.
  const assetUrl = React.useCallback(
    (p) => {
      if (!p) return null;
      if (localUrls[p]) return localUrls[p];
      if (!onlineRef.current) return null;
      if (p.startsWith('/') || p.startsWith('http')) return p;
      return '/projects/' + slug + '/' + p;
    },
    [localUrls, slug]
  );

  // ── projeto ──
  const openProject = async (s) => {
    try {
      const { cfg: raw } = await Store.loadProject(s);
      setSlug(s);
      setCfg(hydrateCfg(raw));
      setSelection({ kind: 'project' });
      setSaveState('—');
      setWarns([]);
      setSyncMsg('');
      setNonce((n) => n + 1);
      setFormat('landscape');
      setOverlay(null);
      await refreshAssets(s);
    } catch (e) {
      alert(String(e.message || e));
    }
  };
  const closeProject = () => { setSlug(''); setCfg(null); setRender({ state: 'idle' }); };

  const newProject = async (formato = 'tutorial') => {
    const s = (prompt(`slug do novo ${formato} (ex.: meu-video):`) || '').trim();
    if (!s) return;
    if (!SLUG_RE_UI.test(s)) return alert('slug inválido — use letras minúsculas, números e hífens.');
    let cfg0;
    if (formato === 'tutorial') {
      cfg0 = deriveCfg({ ...DEFAULT_TUTORIAL, titulo: s.replace(/-/g, ' ') });
    } else {
      // semeia do skeleton do formato (rota já existente).
      cfg0 = await api('/api/skeleton/' + formato);
    }
    await Store.saveProject(s, cfg0, onlineRef.current);
    await openProject(s);
  };

  // ── mutação + save (DB primeiro, servidor debounced) ──
  // tutorial deriva timeline (deriveCfg); reels verticais salvam o cfg direto.
  const commit = (next) => {
    const derived = next.formato === 'tutorial' ? deriveCfg(next) : next;
    setCfg(derived);
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(derived), 800);
  };
  const saveNow = async (c) => {
    const toSave = c || cfgRef.current;
    if (!toSave || !slug) return;
    setSaveState('saving');
    try {
      const res = await Store.saveProject(slug, toSave, onlineRef.current);
      setWarns(res.warns || []);
      setSaveState(res.offline ? 'local' : 'saved');
      if (!res.offline) setNonce((n) => n + 1); // recarrega o preview congelado
    } catch (e) {
      setSaveState('erro');
      console.error(e);
    }
  };

  // ao reconectar com projeto aberto: sincroniza pendências (inclui limpeza
  // de takes gravados offline) e recarrega o cfg salvo pelo sync.
  React.useEffect(() => {
    if (!online || !slug) return;
    (async () => {
      const r = await Sync.syncProject(slug);
      if (r.ok && (r.assetsSent || r.takesCleaned)) {
        const p = await DB.getProject(slug);
        if (p) setCfg(hydrateCfg(p.cfg));
        setSyncMsg(`✓ sincronizado (${r.assetsSent} arquivo(s))`);
        setNonce((n) => n + 1);
        await refreshAssets();
      }
    })();
  }, [online, slug]);

  const patchCfg = (p) => commit({ ...cfg, ...p });
  const patchIntro = (p) => commit({ ...cfg, intro: { ...cfg.intro, ...p } });
  const patchOutro = (p) => {
    const outro = { ...cfg.outro, ...p };
    if (p.media === null) delete outro.media;
    commit({ ...cfg, outro });
  };
  const patchScene = (i, p) => {
    const scenes = cfg.scenes.map((s, si) => (si === i ? { ...s, ...p } : s));
    for (const k of Object.keys(p)) if (p[k] === undefined) delete scenes[i][k];
    commit({ ...cfg, scenes });
  };

  const addScene = (catalogItem) => {
    const scene = { id: newSceneId(), ...sceneFromTemplate(catalogItem) };
    commit({ ...cfg, scenes: [...cfg.scenes, scene] });
    setSelection({ kind: 'scene', index: cfg.scenes.length });
    setGallery(false);
  };
  const removeScene = (i) => {
    if (!confirm('excluir a cena ' + (i + 1) + '?')) return;
    commit({ ...cfg, scenes: cfg.scenes.filter((_, si) => si !== i) });
    setSelection({ kind: 'project' });
  };
  const moveScene = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= cfg.scenes.length) return;
    const scenes = [...cfg.scenes];
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    commit({ ...cfg, scenes });
    setSelection({ kind: 'scene', index: j });
  };

  // ── takes (áudio + câmera opcional) ──
  const takeForScene = async (scene, blob, comCamera) => {
    const { audio, camera } = await Store.recordTake(slug, scene, blob, { comCamera, online: onlineRef.current });
    commit({
      ...cfgRef.current,
      scenes: cfgRef.current.scenes.map((s) => {
        if (s.id !== scene.id) return s;
        const next = { ...s, audio };
        if (camera) next.camera = camera;
        else delete next.camera;
        return next;
      }),
    });
    await refreshAssets();
  };
  const removeSceneAudio = (sceneId) => {
    commit({ ...cfg, scenes: cfg.scenes.map((s) => { if (s.id !== sceneId) return s; const { audio, camera, ...rest } = s; return rest; }) });
  };
  const removeSceneCamera = (sceneId) => {
    commit({ ...cfg, scenes: cfg.scenes.map((s) => { if (s.id !== sceneId) return s; const { camera, ...rest } = s; return rest; }) });
  };

  // ── assets ──
  const upload = async (kind, file) => {
    try {
      await Store.attach(slug, file, onlineRef.current, { kind });
      await refreshAssets();
    } catch (e) { alert(String(e.message || e)); }
  };
  const uploadNarracao = async (file) => {
    try {
      await Store.attach(slug, file, onlineRef.current, { kind: 'narracao' });
      await refreshAssets();
    } catch (e) { alert(String(e.message || e)); }
  };
  const cleanGlobalAudio = async () => {
    setCleaning(true);
    try {
      const n = await api('/api/audio/' + slug, { method: 'POST' });
      commit({ ...cfg, narracao: { raw: n.raw, limpo: n.limpo, duracaoSegundos: n.duracaoSegundos } });
      await refreshAssets();
    } catch (e) { alert(String(e.message || e)); }
    setCleaning(false);
  };
  const assignAsset = async (src, kindGuess) => {
    if (selection.kind !== 'scene') return;
    const s = cfg.scenes[selection.index];
    if (!s || (s.type !== 'video' && s.type !== 'image')) return;
    const p = { src, type: kindGuess };
    if (kindGuess === 'video' && !s.audio?.src) {
      const d = await readMediaDuration(assetUrl(src) || src);
      if (d) p.duration = d;
    }
    patchScene(selection.index, p);
  };

  // ── sync manual + zip ──
  const doSync = async () => {
    setSyncMsg('sincronizando…');
    const r = await Sync.syncProject(slug, (done, total) => setSyncMsg(`enviando ${done}/${total}…`));
    if (r.ok) {
      const p = await DB.getProject(slug);
      if (p) setCfg(hydrateCfg(p.cfg));
      setSyncMsg(`✓ sincronizado (${r.assetsSent} arquivo(s))`);
      setNonce((n) => n + 1);
      await refreshAssets();
    } else {
      setSyncMsg('✗ ' + (r.reason === 'offline' ? 'sem conexão com o PC' : r.reason));
    }
  };
  // .rvs = zip com o projeto na raiz (project.json + assets/...), a partir do DB.
  const doExportRvs = async () => {
    const files = [{ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(cfg, null, 2) + '\n') }];
    for (const a of await DB.listAssets(slug)) {
      const name = a.kind === 'narracao'
        ? `assets/narracao/raw/${slug}${a.filename.slice(a.filename.lastIndexOf('.'))}`
        : Store.pathFor(slug, a.kind, a.filename); // já project-relative (assets/...)
      files.push({ name, data: a.blob });
    }
    const zip = await buildZip(files);
    const file = new File([zip], `${slug}.rvs`, { type: 'application/octet-stream' });
    const url = URL.createObjectURL(file);
    const aEl = document.createElement('a');
    aEl.href = url; aEl.download = `${slug}.rvs`; aEl.click();
    URL.revokeObjectURL(url);
    setSyncMsg('✓ .rvs baixado');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: slug }).catch(() => {});
    }
  };

  // ── preview ──
  const introDur = +cfg?.intro?.duracao || 2.4;
  const freezeAt = React.useMemo(() => {
    if (!cfg) return 0;
    if (selection.kind === 'intro') return Math.max(0, introDur * 0.5);
    if (selection.kind === 'outro') return introDur + bodyDuration(cfg.scenes) + 0.15;
    if (selection.kind === 'scene') {
      const s = cfg.scenes[selection.index];
      return s ? introDur + (+s.start || 0) + 0.05 : 0;
    }
    return 0.05;
  }, [cfg, selection, introDur]);

  React.useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'reel-seek', time: freezeAt }, '*');
  }, [freezeAt]);
  const togglePlay = () => iframeRef.current?.contentWindow?.postMessage({ type: 'reel-toggle-play' }, '*');

  // ── render ──
  const startRender = async () => {
    await saveNow();
    await api('/api/render/' + slug, { method: 'POST' });
    setRender({ state: 'running', frame: 0, total: 0 });
    const poll = setInterval(async () => {
      const st = await api(`/api/render/${slug}/status`).catch(() => null);
      if (!st) return;
      setRender(st);
      if (st.state !== 'running') clearInterval(poll);
    }, 1000);
  };

  const selLabel = selection.kind === 'scene'
    ? `cena ${selection.index + 1} · congelado em ${fmtClock(freezeAt)}`
    : selection.kind + (cfg ? ` · congelado em ${fmtClock(freezeAt)}` : '');

  // ── telas ──
  if (!slug || !cfg) {
    return (
      <div className="home-wrap">
        <div className="topbar">
          <div className="brand"><span className="dot" />Studio</div>
          <div className="home-tabs">
            <button className={'tab' + (homeView === 'projects' ? ' on' : '')} onClick={() => setHomeView('projects')}>projetos</button>
            <button className={'tab' + (homeView === 'lote' ? ' on' : '')} onClick={() => setHomeView('lote')}>render em lote</button>
          </div>
          <div className="grow" />
          <ConnStatus online={online} withLabel />
        </div>
        {homeView === 'projects'
          ? <ProjectHome online={online} onOpen={openProject} onNew={newProject} />
          : <BatchRender online={online} onOpen={openProject} />}
      </div>
    );
  }

  const inspector = (
    <React.Fragment>
      {selection.kind === 'project' && (
        <ProjectInspector slug={slug} cfg={cfg} assets={assets} patchCfg={patchCfg}
          onCleanGlobalAudio={cleanGlobalAudio} cleaning={cleaning} onUploadNarracao={uploadNarracao}
          online={!!online} onSync={doSync} syncMsg={syncMsg} onExportZip={doExportRvs} />
      )}
      {selection.kind === 'intro' && <IntroInspector cfg={cfg} patchIntro={patchIntro} />}
      {selection.kind === 'outro' && <OutroInspector cfg={cfg} assets={assets} patchOutro={patchOutro} />}
      {selection.kind === 'scene' && (
        <SceneInspector slug={slug} cfg={cfg} index={selection.index} assets={assets} assetUrl={assetUrl} catalog={catalog}
          patchScene={patchScene} onMove={moveScene} onRemove={removeScene}
          onTake={takeForScene} onRemoveAudio={removeSceneAudio} onRemoveCamera={removeSceneCamera} />
      )}
      {selection.kind !== 'project' && (
        <div style={{ padding: '0 14px 18px' }}>
          <button className="btn sm ghost" onClick={() => setSelection({ kind: 'project' })}><Ic.gear /> configurações do projeto</button>
        </div>
      )}
    </React.Fragment>
  );

  const topbar = (
    <div className="topbar">
      <div className="brand" onClick={closeProject} style={{ cursor: 'pointer' }} title="voltar aos projetos"><span className="dot" />Studio</div>
      <span className="top-sep" />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{slug}</span>
      <button className="btn sm ghost" onClick={closeProject}>trocar</button>
      <span className={'save-state ' + saveState}>{{ '—': '', dirty: '● alterado', saving: 'salvando…', saved: '✓ salvo', local: '✓ salvo no aparelho', erro: '✗ erro ao salvar' }[saveState] || ''}</span>
      {warns.length > 0 && <span className="warn-chip" title={warns.join('\n')}>⚠ {warns.length} aviso(s)</span>}
      <div className="grow" />
      <ConnStatus online={online} />
      {!narrow && cfg.formato === 'tutorial' && (
        <button className={'btn sm' + (gravarWide ? ' primary' : '')} onClick={() => setGravarWide(!gravarWide)}><Ic.mic /> gravar</button>
      )}
      {render.state === 'running' && (
        <span className="render-progress">
          <span className="bar"><div style={{ width: (render.total ? Math.round(100 * render.frame / render.total) : 0) + '%' }} /></span>
          {render.total ? Math.round(100 * render.frame / render.total) + '%' : '…'}
        </span>
      )}
      {render.state === 'done' && <a className="btn sm" href={'/projects/' + slug + '/render/video.mp4'} target="_blank">✓ abrir mp4</a>}
      {render.state === 'error' && <span className="warn-chip" title={render.error}>✗ render falhou</span>}
      <button className="icon-btn" title="ver JSON" onClick={() => setJsonView(true)}><Ic.json /></button>
      <button className="btn primary" disabled={!online || render.state === 'running'}
        title={online ? '' : 'renderização exige o PC'} onClick={startRender}>renderizar</button>
    </div>
  );

  // ── reel vertical (lista/quiz/historia): formulário + preview, sem timeline ──
  if (cfg.formato !== 'tutorial') {
    const reelPreviewSrc = online ? `/player/player.html?reel=${encodeURIComponent(slug)}&v=${nonce}` : 'about:blank';
    return (
      <div className={narrow ? 'narrow-wrap' : 'nle'}>
        {topbar}
        {narrow
          ? <div className="narrow-body"><ReelEditor slug={slug} cfg={cfg} nonce={nonce} online={!!online} patch={patchCfg} narrow onOpenPreview={() => setOverlay('preview')} /></div>
          : <ReelEditor slug={slug} cfg={cfg} nonce={nonce} online={!!online} patch={patchCfg} />}
        {narrow && overlay === 'preview' && (
          <div className="fs-overlay">
            <div className="fs-head"><span>preview</span><div className="grow" /><button className="btn sm" onClick={() => setOverlay(null)}>fechar</button></div>
            <div className="reel-preview" style={{ flex: 1 }}>
              <div className="preview-frame-wrap portrait">
                {online
                  ? <iframe key={slug + ':' + nonce} src={reelPreviewSrc} title="preview" />
                  : <div className="preview-offline"><Ic.phone /><div>preview disponível quando conectado ao PC</div></div>}
              </div>
            </div>
          </div>
        )}
        {jsonView && <JsonModal cfg={cfg} onClose={() => setJsonView(false)} />}
      </div>
    );
  }

  // ── layout estreito (celular): página única ──
  if (narrow) {
    return (
      <div className="narrow-wrap">
        {topbar}
        <div className="narrow-body">
          <div className="narrow-page">
            <div className="narrow-actions">
              <button className="btn" onClick={() => setOverlay('gravar')}><Ic.mic /> gravar cenas</button>
              <button className="btn" onClick={() => setOverlay('preview')} disabled={!online}><Ic.play /> preview</button>
            </div>
            <Timeline cfg={cfg} selection={selection} onSelect={setSelection} onAddScene={() => setGallery(true)} vertical />
            <div className="narrow-inspector">{inspector}</div>
            <AssetsPanel slug={slug} assets={assets} cfg={cfg} assetUrl={assetUrl} onUpload={upload} onAssign={assignAsset} />
          </div>
        </div>

        {overlay === 'gravar' && (
          <div className="fs-overlay">
            <div className="fs-head"><span>gravação guiada</span><div className="grow" /><button className="btn sm" onClick={() => setOverlay(null)}>fechar</button></div>
            <GravarPanel cfg={cfg} assetUrl={assetUrl} onTake={takeForScene} />
          </div>
        )}
        {overlay === 'preview' && (
          <div className="fs-overlay">
            <div className="fs-head"><span>preview</span><div className="grow" /><button className="btn sm" onClick={() => setOverlay(null)}>fechar</button></div>
            <PreviewArea slug={slug} nonce={nonce} freezeAt={freezeAt} format={format} onFormat={setFormat}
              onTogglePlay={togglePlay} iframeRef={iframeRef} label={selLabel} online={!!online} />
          </div>
        )}
        {gallery && <LayoutGallery catalog={catalog} onPick={addScene} onClose={() => setGallery(false)} />}
        {jsonView && <JsonModal cfg={cfg} onClose={() => setJsonView(false)} />}
      </div>
    );
  }

  // ── layout largo (desktop): grid NLE ──
  return (
    <div className="nle">
      {topbar}
      <AssetsPanel slug={slug} assets={assets} cfg={cfg} assetUrl={assetUrl} onUpload={upload} onAssign={assignAsset} />
      {gravarWide
        ? <div className="panel-preview"><GravarPanel cfg={cfg} assetUrl={assetUrl} onTake={takeForScene} /></div>
        : <PreviewArea slug={slug} nonce={nonce} freezeAt={freezeAt} format={format} onFormat={setFormat}
            onTogglePlay={togglePlay} iframeRef={iframeRef} label={selLabel} online={!!online} />}
      <div className="panel-inspector">{inspector}</div>
      <Timeline cfg={cfg} selection={selection} onSelect={setSelection} onAddScene={() => setGallery(true)} />
      {gallery && <LayoutGallery catalog={catalog} onPick={addScene} onClose={() => setGallery(false)} />}
      {jsonView && <JsonModal cfg={cfg} onClose={() => setJsonView(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StudioApp));
