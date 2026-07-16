// studio/components.jsx — componentes de apresentação do Studio desktop.
// Depende de lib.jsx (helpers globais). app.jsx monta tudo.

// ── ícones (SVG inline, stroke = currentColor) ───────────────────────────────
const Ic = {
  monitor: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>),
  phone: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 5h3" /></svg>),
  video: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="M15.5 10.5 21 7.5v9l-5.5-3" /></svg>),
  image: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="m3 17 5-4.5 4 3.5 4-3 5 4" /></svg>),
  step: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M4 19V5M4 12h10M14 5v14" /><path d="m17 9 3 3-3 3" /></svg>),
  code: () => (<svg className="ic" viewBox="0 0 24 24"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></svg>),
  callout: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="7" y="8" width="7" height="5" rx="1" /></svg>),
  raw: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2" strokeDasharray="3 3" /></svg>),
  mic: () => (<svg className="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></svg>),
  play: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M7 4.8v14.4L19.2 12 7 4.8Z" /></svg>),
  plus: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>),
  trash: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></svg>),
  left: () => (<svg className="ic" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>),
  right: () => (<svg className="ic" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg>),
  intro: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M20 12H7M11 6l-6 6 6 6" /></svg>),
  outro: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M4 12h13M13 6l6 6-6 6" /></svg>),
  gear: () => (<svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg>),
  json: () => (<svg className="ic" viewBox="0 0 24 24"><path d="M8 4c-2 0-2 2-2 3s.5 3-2 3c2.5 0 2 2 2 3s0 3 2 3M16 4c2 0 2 2 2 3s-.5 3 2 3c-2.5 0-2 2-2 3s0 3-2 3" /></svg>),
};

const TYPE_META = {
  video: { icon: Ic.video, color: '#9db4ff', label: 'vídeo' },
  image: { icon: Ic.image, color: '#6bd48a', label: 'print' },
  passo: { icon: Ic.step, color: '#f0c674', label: 'passo' },
  codigo: { icon: Ic.code, color: '#c39ac9', label: 'código' },
  'camera-intro': { icon: Ic.mic, color: '#E5484D', label: 'abertura' },
};

// status de conexão: verde quando conectado, cinza quando offline.
function ConnStatus({ online, withLabel }) {
  const cls = online === null ? 'checking' : online ? 'online' : 'offline';
  const label = online === null ? '…' : online ? 'conectado' : 'offline';
  return (
    <span className={'conn ' + cls} title={online ? 'servidor acessível' : 'sem conexão com o PC — modo offline'}>
      <span className="conn-dot" />{withLabel ? label : (online ? '' : label)}
    </span>
  );
}

// ── campos de formulário ─────────────────────────────────────────────────────
function F({ label, children }) {
  return (<div><label className="f">{label}</label>{children}</div>);
}
function TextField({ label, value, onChange, placeholder, mono }) {
  return (
    <F label={label}>
      <input type="text" value={value ?? ''} placeholder={placeholder || ''}
        style={mono ? { fontFamily: 'var(--mono)' } : null}
        onChange={(e) => onChange(e.target.value)} />
    </F>
  );
}
function NumField({ label, value, onChange, step = 0.1, min = 0, disabled, title }) {
  return (
    <F label={label}>
      <input type="number" value={value ?? ''} step={step} min={min} disabled={!!disabled} title={title || ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : +e.target.value)} />
    </F>
  );
}
function AreaField({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <F label={label}>
      <textarea rows={rows} value={value ?? ''} placeholder={placeholder || ''}
        onChange={(e) => onChange(e.target.value)} />
    </F>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <F label={label}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </F>
  );
}
function AssetSelect({ label, value, onChange, options, allowEmpty = true }) {
  return (
    <F label={label}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
        {allowEmpty && <option value="">—</option>}
        {options.map((p) => <option key={p} value={p}>{p.split('/').pop()}</option>)}
      </select>
    </F>
  );
}
function Group({ title, children, right }) {
  return (
    <div className="f-group">
      <div className="g-title"><span>{title}</span>{right}</div>
      {children}
    </div>
  );
}

// ── preview ──────────────────────────────────────────────────────────────────
function PreviewArea({ slug, nonce, freezeAt, format, onFormat, onTogglePlay, iframeRef, label, online }) {
  const src = slug
    ? `/player/player.html?reel=${encodeURIComponent(slug)}&freeze=${(+freezeAt || 0).toFixed(2)}&v=${nonce}`
    : 'about:blank';
  return (
    <div className="panel-preview">
      <div className="preview-head">
        <span className="preview-title">{label || 'preview'}</span>
        <div className="grow" />
        <button className="btn sm ghost" onClick={onTogglePlay} title="tocar/pausar (o player também aceita espaço)"><Ic.play /> play</button>
        <span className="top-sep" />
        <button className={'icon-btn' + (format === 'landscape' ? ' active' : '')} title="preview paisagem 16:9 (PC)"
          onClick={() => onFormat('landscape')}><Ic.monitor /></button>
        <button className={'icon-btn' + (format === 'portrait' ? ' active' : '')} title="preview retrato 9:16 (celular)"
          onClick={() => onFormat('portrait')}><Ic.phone /></button>
      </div>
      <div className="preview-stage">
        <div className={'preview-frame-wrap ' + format}>
          {slug && online && <iframe ref={iframeRef} key={slug + ':' + nonce} src={src} title="preview" />}
          {slug && !online && (
            <div className="preview-offline">
              <Ic.monitor />
              <div>preview disponível quando conectado ao PC</div>
              <div className="hint">offline você pode editar cenas, anexar arquivos e gravar takes — tudo sincroniza depois.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── timeline ─────────────────────────────────────────────────────────────────
function Timeline({ cfg, selection, onSelect, onAddScene, vertical }) {
  const scenes = cfg.scenes || [];
  const introDur = +cfg.intro?.duracao || 2.4;
  const outroDur = +cfg.outro?.duracao || 3.2;
  const total = introDur + bodyDuration(scenes) + outroDur;
  const pxPerSec = 14;
  const blockW = (d) => (vertical ? undefined : Math.max(64, Math.round(d * pxPerSec)));
  const sel = (k, i) => selection.kind === k && (k !== 'scene' || selection.index === i);

  return (
    <div className={'panel-timeline' + (vertical ? ' vertical' : '')}>
      <div className="tl-head">
        <span className="tl-total">duração total <b>{fmtClock(total)}</b> · intro {fmtSecs(introDur)} + cenas {fmtSecs(bodyDuration(scenes))} + outro {fmtSecs(outroDur)}</span>
        <div className="grow" />
        <button className="btn sm primary" onClick={onAddScene}><Ic.plus /> nova cena</button>
      </div>
      <div className={'tl-track' + (vertical ? ' vertical' : '')}>
        <div className={'tl-block fixed' + (sel('intro') ? ' selected' : '')} style={{ width: blockW(introDur) }}
          onClick={() => onSelect({ kind: 'intro' })}>
          <span className="tl-kind"><Ic.intro /> intro</span>
          <span className="tl-dur">{fmtSecs(introDur)}</span>
        </div>
        {scenes.map((s, i) => {
          const meta = TYPE_META[s.type] || TYPE_META.video;
          const label = s.titulo || s.caption || s.texto || (s.src ? s.src.split('/').pop() : meta.label);
          return (
            <div key={s.id || i} className={'tl-block' + (sel('scene', i) ? ' selected' : '')}
              style={{ width: blockW(s.duration || 3) }} onClick={() => onSelect({ kind: 'scene', index: i })}>
              <span className="tl-color" style={{ background: meta.color }} />
              <span className="tl-kind"><meta.icon /> {meta.label}{s.layout && s.layout !== 'desktop' ? ' · ' + s.layout : ''}</span>
              <span className="tl-label">{label}</span>
              <span className="tl-dur">{fmtSecs(s.duration || 3)}</span>
              {s.audio?.src && <span className="tl-badges" title="cena com áudio gravado"><Ic.mic /></span>}
            </div>
          );
        })}
        <div className={'tl-block fixed' + (sel('outro') ? ' selected' : '')} style={{ width: blockW(outroDur) }}
          onClick={() => onSelect({ kind: 'outro' })}>
          <span className="tl-kind"><Ic.outro /> outro</span>
          <span className="tl-label">{cfg.outro?.cta || ''}</span>
          <span className="tl-dur">{fmtSecs(outroDur)}</span>
        </div>
      </div>
    </div>
  );
}

// ── assets ───────────────────────────────────────────────────────────────────
function AssetCard({ path, url, isVideo, inUse, onClick }) {
  return (
    <div className={'asset-card' + (inUse ? ' in-use' : '')} onClick={onClick} title={path}>
      {!url ? <div className="asset-thumb" />
        : isVideo
          ? <video className="asset-thumb" src={url + (url.startsWith('blob:') ? '' : '#t=0.4')} preload="metadata" muted />
          : <img className="asset-thumb" src={url} alt="" loading="lazy" />}
      <div className="asset-name">{path.split('/').pop()}</div>
    </div>
  );
}

function AssetsPanel({ slug, assets, cfg, assetUrl, onUpload, onAssign }) {
  const upRef = React.useRef(null);
  const upKindRef = React.useRef('gravacao');
  const inUse = new Set((cfg.scenes || []).map(s => s.src).filter(Boolean));
  if (cfg.camera?.src) inUse.add(cfg.camera.src);
  const pick = (kind) => { upKindRef.current = kind; upRef.current?.click(); };
  return (
    <div className="panel-assets">
      <div className="panel-title"><span>gravações</span>
        <button className="btn sm ghost" onClick={() => pick('gravacao')} disabled={!slug}><Ic.plus /> enviar</button>
      </div>
      <div className="asset-grid">
        {(assets.gravacoes || []).map(p => (
          <AssetCard key={p} path={p} url={assetUrl(p)} isVideo inUse={inUse.has(p)} onClick={() => onAssign(p, 'video')} />
        ))}
      </div>
      {!assets.gravacoes?.length && <div className="hint" style={{ padding: '0 14px 10px' }}>vídeos em assets/gravacoes/ aparecem aqui.</div>}

      <div className="panel-title"><span>prints</span>
        <button className="btn sm ghost" onClick={() => pick('print')} disabled={!slug}><Ic.plus /> enviar</button>
      </div>
      <div className="asset-grid">
        {(assets.prints || []).map(p => (
          <AssetCard key={p} path={p} url={assetUrl(p)} isVideo={false} inUse={inUse.has(p)} onClick={() => onAssign(p, 'image')} />
        ))}
      </div>
      {!assets.prints?.length && <div className="hint" style={{ padding: '0 14px 10px' }}>imagens em assets/prints/ aparecem aqui.</div>}

      <div className="hint" style={{ padding: '6px 14px 16px' }}>clique num asset para atribuí-lo à cena selecionada.</div>
      <input ref={upRef} type="file" multiple style={{ display: 'none' }}
        accept="video/*,image/*"
        onChange={async (e) => {
          const files = [...e.target.files];
          e.target.value = '';
          for (const f of files) await onUpload(upKindRef.current, f);
        }} />
    </div>
  );
}

// ── núcleo de gravação de take (áudio, com câmera opcional) ──────────────────
// Reutilizado pelo inspector (SceneAudioRecorder) e pelo GravarPanel.
// onUse(blob, comCamera) é async — o pai persiste via Store.recordTake.
function useTakeRecorder({ onUse, defaultCamera = false }) {
  const [state, setState] = React.useState('idle'); // idle | recording | review | busy
  const [err, setErr] = React.useState('');
  const [secs, setSecs] = React.useState(0);
  const [comCamera, setComCamera] = React.useState(!!defaultCamera);
  const [reviewUrl, setReviewUrl] = React.useState('');
  const recRef = React.useRef(null);
  const blobRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const camPreviewRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const wasCameraRef = React.useRef(false);

  // o <video> da bolha só monta quando state==='recording' — atribui o stream
  // ao vivo assim que ele existe (senão a bolha fica em branco até parar).
  React.useEffect(() => {
    if (state === 'recording' && wasCameraRef.current && camPreviewRef.current && streamRef.current) {
      camPreviewRef.current.srcObject = streamRef.current;
      camPreviewRef.current.play?.().catch(() => {});
    }
  }, [state]);

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: comCamera ? { facingMode: 'user', width: 480, height: 480 } : false,
      });
      wasCameraRef.current = comCamera;
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: comCamera ? 'video/webm' : 'audio/webm' });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        blobRef.current = new Blob(chunks, { type: comCamera ? 'video/webm' : 'audio/webm' });
        setReviewUrl(URL.createObjectURL(blobRef.current));
        setState('review');
      };
      recRef.current = rec;
      rec.start();
      setSecs(0);
      timerRef.current = setInterval(() => setSecs(s => s + 0.1), 100);
      setState('recording');
    } catch (e) {
      setErr('microfone/câmera indisponível: ' + (e.message || e));
    }
  };
  const stop = () => { clearInterval(timerRef.current); recRef.current?.stop(); };
  const discard = () => { if (reviewUrl) URL.revokeObjectURL(reviewUrl); setReviewUrl(''); blobRef.current = null; setState('idle'); setSecs(0); };
  const use = async () => {
    setState('busy'); setErr('');
    try {
      await onUse(blobRef.current, wasCameraRef.current);
      discard();
    } catch (e) {
      setErr(String(e.message || e));
      setState('review');
    }
  };
  React.useEffect(() => () => clearInterval(timerRef.current), []);
  return { state, err, secs, comCamera, setComCamera, reviewUrl, camPreviewRef, start, stop, discard, use, wasCamera: wasCameraRef.current };
}

// ── gravador de take no inspector da cena ────────────────────────────────────
function SceneAudioRecorder({ scene, assetUrl, onUse, onRemoveAudio, onRemoveCamera }) {
  const r = useTakeRecorder({ onUse, defaultCamera: scene.type === 'camera-intro' });
  const takeUrl = scene.audio?.src ? assetUrl(scene.audio.src) : null;
  return (
    <Group title="take da cena (áudio + câmera opcional)" right={scene.audio?.src
      ? <button className="btn sm danger" onClick={() => onRemoveAudio(scene.id)} title="remover o take desta cena">remover</button>
      : null}>
      <div className="rec-box">
        {scene.audio?.src && r.state === 'idle' && (
          <React.Fragment>
            <div className="rec-status">
              take {scene.audio.pendente ? 'pendente de limpeza (sincronize com o PC)' : 'gravado'} · {fmtSecs(scene.audio.duracaoSegundos)} (define a duração da cena)
              {scene.camera?.src ? ' · com câmera' : ''}
            </div>
            {takeUrl && <audio className="rec-audio" controls src={takeUrl} preload="none" />}
            {scene.camera?.src && (
              <button className="btn sm" onClick={() => onRemoveCamera(scene.id)}>remover só a câmera (manter áudio)</button>
            )}
          </React.Fragment>
        )}
        {scene.roteiro && r.state !== 'review' && <div className="rec-roteiro">{scene.roteiro}</div>}
        {!scene.roteiro && r.state === 'idle' && <div className="hint">dica: preencha o roteiro da cena para lê-lo aqui enquanto grava.</div>}

        {r.state === 'idle' && (
          <React.Fragment>
            <label className="check"><input type="checkbox" checked={r.comCamera} onChange={(e) => r.setComCamera(e.target.checked)} /> gravar com câmera (bolha PiP nesta cena)</label>
            <button className="btn" onClick={r.start}><Ic.mic /> {scene.audio?.src ? 'regravar take' : 'gravar take'}</button>
          </React.Fragment>
        )}
        {r.state === 'recording' && (
          <React.Fragment>
            {r.comCamera && <video ref={r.camPreviewRef} autoPlay muted playsInline style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--red)' }} />}
            <div className="rec-status"><span className="live">● REC</span> {r.secs.toFixed(1)}s</div>
            <button className="btn primary" onClick={r.stop}>parar</button>
          </React.Fragment>
        )}
        {r.state === 'review' && (
          <React.Fragment>
            {r.wasCamera
              ? <video controls src={r.reviewUrl} style={{ width: '100%', borderRadius: 8 }} />
              : <audio className="rec-audio" controls src={r.reviewUrl} />}
            <div className="row">
              <button className="btn primary" onClick={r.use}>usar take</button>
              <button className="btn" onClick={() => { r.discard(); r.start(); }}>regravar</button>
              <button className="btn danger" onClick={r.discard}>descartar</button>
            </div>
          </React.Fragment>
        )}
        {r.state === 'busy' && <div className="rec-status">salvando o take…</div>}
        {r.err && <div className="hint" style={{ color: 'var(--red-soft)' }}>{r.err}</div>}
      </div>
    </Group>
  );
}

// ── inspector ────────────────────────────────────────────────────────────────
// Renderiza UM campo do manifesto (file-driven) usando os editores existentes.
function SceneField({ field: f, value, onChange, assets }) {
  const label = f.label || f.name;
  if (f.type === 'textarea') return <AreaField label={label} value={value} rows={f.rows || 3} placeholder={f.placeholder} onChange={onChange} />;
  if (f.type === 'number') return <NumField label={label} value={value} step={f.step || 0.1} onChange={(v) => onChange(v === '' ? undefined : v)} />;
  if (f.type === 'check') return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
  if (f.type === 'select') return <SelectField label={label} value={value} options={(f.options || []).map(o => Array.isArray(o) ? o : [o, o])} onChange={onChange} />;
  if (f.type === 'asset') return <AssetSelect label={label} value={value} options={(f.kind === 'print' ? assets.prints : assets.gravacoes) || []} onChange={onChange} />;
  if (f.type === 'group') {
    const g = value || {};
    return <F label={label}><div className="row">{(f.fields || []).map(sf => (
      <NumField key={sf.name} label={sf.label || sf.name} value={g[sf.name]} step={sf.step || 1} onChange={(v) => onChange({ ...g, [sf.name]: v === '' ? 0 : +v })} />
    ))}</div></F>;
  }
  if (f.type === 'list') {
    return <ListEditor label={label} items={value} min={f.min || 0} max={f.max || 99}
      makeItem={() => Object.fromEntries((f.item || []).map(sf => [sf.name, sf.default ?? '']))}
      onChange={onChange}
      renderItem={(it, set) => (<div className="row">{(f.item || []).map(sf => (
        <input key={sf.name} type="text" className={sf.width ? 'fixed' : ''}
          style={{ ...(sf.width ? { width: sf.width, flex: 'none' } : {}), ...(sf.mono ? { fontFamily: 'var(--mono)' } : {}) }}
          placeholder={sf.label || sf.name} value={it[sf.name] ?? ''} onChange={(e) => set({ ...it, [sf.name]: e.target.value })} />
      ))}</div>)} />;
  }
  return <TextField label={label} value={value} mono={f.mono} placeholder={f.placeholder} onChange={onChange} />;
}

function SceneInspector({ slug, cfg, index, assets, assetUrl, catalog, patchScene, onMove, onRemove, onTake, onRemoveAudio, onRemoveCamera }) {
  const s = cfg.scenes[index];
  if (!s) return null;
  const meta = TYPE_META[s.type] || TYPE_META.video;
  const isMedia = s.type === 'video' || s.type === 'image';
  const layout = s.layout || (isMedia ? 'desktop' : null);
  const patch = (p) => patchScene(index, p);
  const mediaOptions = s.type === 'video' ? (assets.gravacoes || []) : (assets.prints || []);
  const durLocked = !!s.audio?.src;
  const tpl = templateForScene(catalog, s);        // manifesto que dirige os campos
  const tplFields = tpl?.fields || [];

  return (
    <React.Fragment>
      <div className="insp-head">
        <meta.icon />
        <span className="t">cena {index + 1} · {meta.label}{layout ? ' · ' + layout : ''}</span>
        <button className="icon-btn" title="mover para a esquerda" disabled={index === 0} onClick={() => onMove(index, -1)}><Ic.left /></button>
        <button className="icon-btn" title="mover para a direita" disabled={index === cfg.scenes.length - 1} onClick={() => onMove(index, 1)}><Ic.right /></button>
        <button className="icon-btn" title="excluir cena" onClick={() => onRemove(index)}><Ic.trash /></button>
      </div>
      <div className="insp-body">
        <Group title="tempo">
          <div className="row">
            <NumField label={durLocked ? 'duração (do take)' : 'duração (s)'} value={s.duration} step={0.1}
              disabled={durLocked} title={durLocked ? 'a duração vem do áudio gravado' : ''}
              onChange={(v) => patch({ duration: v === '' ? 3 : Math.max(0.5, v) })} />
            <F label="início → fim (derivado)">
              <input type="text" disabled value={`${fmtSecs(s.start)} → ${fmtSecs(s.end)}`} style={{ fontFamily: 'var(--mono)' }} />
            </F>
          </div>
        </Group>

        {isMedia && (
          <Group title="mídia">
            <div className="row">
              <SelectField label="tipo" value={s.type} options={[['video', 'vídeo'], ['image', 'print']]}
                onChange={(v) => patch({ type: v, src: '' })} />
              <SelectField label="layout" value={layout} options={[['desktop', 'desktop'], ['celular', 'celular'], ['callout', 'destaque'], ['raw', 'sem moldura']]}
                onChange={(v) => patch({ layout: v })} />
            </div>
            <AssetSelect label={'arquivo (' + (s.type === 'video' ? 'assets/gravacoes/' : 'assets/prints/') + ')'} value={s.src}
              options={mediaOptions} onChange={async (v) => {
                const p = { src: v };
                if (v && s.type === 'video' && !s.audio?.src) {
                  const d = await readMediaDuration(v);
                  if (d) p.duration = d;
                }
                patch(p);
              }} />
            {s.type === 'video' && <NumField label="pular início do clipe (trimStart, s)" value={s.trimStart} onChange={(v) => patch({ trimStart: v === '' ? 0 : v })} />}
            {s.type === 'image' && (
              <label className="check"><input type="checkbox" checked={!!s.kenBurns} onChange={(e) => patch({ kenBurns: e.target.checked })} /> efeito Ken Burns (zoom lento)</label>
            )}
          </Group>
        )}

        {/* campos do template (file-driven): dirigidos pelo manifesto da cena. */}
        {tplFields.length > 0 && (
          <Group title={tpl?.name || 'conteúdo'}>
            {s.type === 'camera-intro' && <div className="hint">grave o take <b>com câmera</b> abaixo: você aparece grande na tela e o áudio vira a narração desta cena.</div>}
            {tplFields.map((f) => (
              <SceneField key={f.name} field={f} value={s[f.name]} assets={assets} onChange={(v) => patch({ [f.name]: v })} />
            ))}
          </Group>
        )}

        <Group title="roteiro (teleprompter)">
          <AreaField label="o que narrar nesta cena" value={s.roteiro} onChange={(v) => patch({ roteiro: v })} rows={3}
            placeholder="texto lido durante a gravação (aqui e no app móvel)" />
        </Group>

        <SceneAudioRecorder scene={s} assetUrl={assetUrl}
          onUse={(blob, comCamera) => onTake(s, blob, comCamera)}
          onRemoveAudio={onRemoveAudio} onRemoveCamera={onRemoveCamera} />
      </div>
    </React.Fragment>
  );
}

function IntroInspector({ cfg, patchIntro }) {
  return (
    <React.Fragment>
      <div className="insp-head"><Ic.intro /><span className="t">intro</span></div>
      <div className="insp-body">
        <Group title="abertura">
          <TextField label="título" value={cfg.intro?.titulo} onChange={(v) => patchIntro({ titulo: v })} />
          <TextField label="subtítulo" value={cfg.intro?.subtitulo} onChange={(v) => patchIntro({ subtitulo: v })} />
          <NumField label="duração (s)" value={cfg.intro?.duracao} onChange={(v) => patchIntro({ duracao: v === '' ? 2.4 : v })} />
        </Group>
      </div>
    </React.Fragment>
  );
}

function OutroInspector({ cfg, assets, patchOutro }) {
  const media = cfg.outro?.media || null;
  const setMedia = (m) => patchOutro({ media: m });
  return (
    <React.Fragment>
      <div className="insp-head"><Ic.outro /><span className="t">outro</span></div>
      <div className="insp-body">
        <Group title="fechamento">
          <TextField label="CTA" value={cfg.outro?.cta} onChange={(v) => patchOutro({ cta: v })} />
          <TextField label="linha de apoio" value={cfg.outro?.sub} onChange={(v) => patchOutro({ sub: v })} />
          <NumField label="duração (s)" value={cfg.outro?.duracao} onChange={(v) => patchOutro({ duracao: v === '' ? 3.2 : v })} />
        </Group>
        <Group title="mídia do fechamento" right={media
          ? <button className="btn sm danger" onClick={() => setMedia(null)}>remover</button>
          : null}>
          {!media && (
            <React.Fragment>
              <div className="hint">mostre o resultado final na tela de fechamento: um print/vídeo no celular, no PC, ou os dois lado a lado (bom para projetos responsivos).</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => setMedia({ tipo: 'celular', srcCelular: '' })}><Ic.phone /> celular</button>
                <button className="btn sm" onClick={() => setMedia({ tipo: 'desktop', srcDesktop: '' })}><Ic.monitor /> PC</button>
                <button className="btn sm" onClick={() => setMedia({ tipo: 'ambos', srcCelular: '', srcDesktop: '' })}>ambos</button>
              </div>
            </React.Fragment>
          )}
          {media && (
            <React.Fragment>
              <SelectField label="formato" value={media.tipo} options={[['celular', 'celular'], ['desktop', 'PC'], ['ambos', 'celular + PC']]}
                onChange={(v) => setMedia({ ...media, tipo: v })} />
              {media.tipo !== 'desktop' && (
                <AssetSelect label="mídia do celular (gravação ou print)" value={media.srcCelular}
                  options={[...(assets.gravacoes || []), ...(assets.prints || [])]}
                  onChange={(v) => setMedia({ ...media, srcCelular: v })} />
              )}
              {media.tipo !== 'celular' && (
                <AssetSelect label="mídia do PC (gravação ou print)" value={media.srcDesktop}
                  options={[...(assets.gravacoes || []), ...(assets.prints || [])]}
                  onChange={(v) => setMedia({ ...media, srcDesktop: v })} />
              )}
            </React.Fragment>
          )}
        </Group>
      </div>
    </React.Fragment>
  );
}

// Seletor de tema: lista /api/themes; grava cfg.theme (default "elucas").
function ThemeSelect({ value, online, onChange }) {
  const [themes, setThemes] = React.useState(null);
  React.useEffect(() => { if (online) fetch('/api/themes').then(r => r.json()).then(setThemes).catch(() => setThemes([])); }, [online]);
  const opts = (themes || [{ id: 'elucas', name: 'elucas.dev (padrão)' }]).map(t => [t.id, t.name]);
  return (
    <F label="tema (visual)">
      <select value={value || 'elucas'} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </F>
  );
}

// Seletor de layout do quiz (por canal): lista /api/quiz-templates; grava cfg.template.
// Vazio = layout embutido (inline). Cada template é um arquivo (templates/quiz/<id>).
function QuizTemplateSelect({ value, online, onChange }) {
  const [tpls, setTpls] = React.useState(null);
  React.useEffect(() => { if (online) fetch('/api/quiz-templates').then(r => r.json()).then(setTpls).catch(() => setTpls([])); }, [online]);
  const opts = tpls || [];
  return (
    <F label="layout do quiz (canal)">
      <select value={value || ''} onChange={(e) => onChange(e.target.value || undefined)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
        <option value="">embutido (padrão)</option>
        {opts.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
      </select>
    </F>
  );
}

function ProjectInspector({ slug, cfg, assets, patchCfg, onCleanGlobalAudio, cleaning, onUploadNarracao, online, onSync, syncMsg, onExportZip }) {
  const hasSceneAudio = (cfg.scenes || []).some(s => s.audio?.src);
  const [host, setHost] = React.useState(Sync.getHost());
  const slugForThumb = slug || '<slug>';
  const thumbUrl = slug ? '/projects/' + slug + '/render/thumb.jpg' : null;
  return (
    <React.Fragment>
      <div className="insp-head"><Ic.gear /><span className="t">projeto</span></div>
      <div className="insp-body">
        <Group title="sincronização">
          <div className="rec-status">{online ? '● conectado ao PC' : '○ offline — alterações ficam neste aparelho'}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={onSync} disabled={!online}>sincronizar agora</button>
            <button className="btn sm" onClick={onExportZip}>exportar .rvs</button>
          </div>
          {syncMsg && <div className="hint" style={{ marginTop: 6 }}>{syncMsg}</div>}
          <F label="endereço do PC (vazio = este servidor)">
            <input type="text" value={host} placeholder="https://192.168.x.x:5173"
              style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}
              onChange={(e) => setHost(e.target.value)}
              onBlur={() => Sync.setHost(host.trim())} />
          </F>
        </Group>
        <Group title="identificação">
          <TextField label="tag (canto superior)" value={cfg.tag} onChange={(v) => patchCfg({ tag: v })} />
          <TextField label="título do vídeo" value={cfg.titulo} onChange={(v) => patchCfg({ titulo: v })} />
          <ThemeSelect value={cfg.theme} online={online} onChange={(v) => patchCfg({ theme: v })} />
        </Group>

        <Group title="capa (thumbnail)">
          <div className="hint">gerada em projects/{slugForThumb}/render/thumb.jpg a cada render. Escolha o segundo do frame, ou aponte uma imagem própria.</div>
          <div className="row">
            <NumField label="tempo do frame (s)" value={cfg.thumbnail?.tempo} step={0.1}
              onChange={(v) => patchCfg({ thumbnail: v === '' ? { ...(cfg.thumbnail || {}), tempo: undefined } : { ...(cfg.thumbnail || {}), tempo: v } })} />
            <AssetSelect label="ou imagem própria (print)" value={cfg.thumbnail?.src} options={assets.prints || []}
              onChange={(v) => patchCfg({ thumbnail: v ? { src: v } : { ...(cfg.thumbnail || {}), src: undefined } })} />
          </div>
          {thumbUrl && <img src={thumbUrl} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '100%', borderRadius: 8, marginTop: 8, border: '1px solid var(--line)' }} />}
        </Group>

        <Group title="câmera (PiP)" right={cfg.camera
          ? <button className="btn sm danger" onClick={() => patchCfg({ camera: null })}>remover</button>
          : <button className="btn sm" onClick={() => patchCfg({ camera: { src: '', position: 'bottom-right', size: 280 } })}>ativar</button>}>
          {!cfg.camera && <div className="hint">bolha com a sua câmera sobre o corpo do vídeo (opcional).</div>}
          {cfg.camera && (
            <React.Fragment>
              <AssetSelect label="gravação da câmera" value={cfg.camera.src} options={assets.gravacoes || []}
                onChange={(v) => patchCfg({ camera: { ...cfg.camera, src: v } })} />
              <div className="row">
                <SelectField label="posição" value={cfg.camera.position || 'bottom-right'}
                  options={[['bottom-right', 'inf. direita'], ['bottom-left', 'inf. esquerda'], ['top-right', 'sup. direita'], ['top-left', 'sup. esquerda']]}
                  onChange={(v) => patchCfg({ camera: { ...cfg.camera, position: v } })} />
                <NumField label="tamanho (px)" value={cfg.camera.size || 280} step={10}
                  onChange={(v) => patchCfg({ camera: { ...cfg.camera, size: v === '' ? 280 : v } })} />
              </div>
            </React.Fragment>
          )}
        </Group>

        <Group title="narração">
          {hasSceneAudio
            ? <div className="hint">este projeto usa <b>áudio por cena</b> ({cfg.scenes.filter(s => s.audio?.src).length}/{cfg.scenes.length} cenas com take). O render monta a narração automaticamente a partir dos takes.</div>
            : (
              <React.Fragment>
                <div className="hint">fluxo clássico: um áudio único para o vídeo todo. Grave takes por cena (selecione uma cena na timeline) ou envie um arquivo cru e limpe:</div>
                <div className="rec-status" style={{ margin: '8px 0 4px' }}>
                  raw: {assets.narracaoRaw || '—'}<br />limpo: {assets.narracaoLimpo || '—'} {cfg.narracao?.duracaoSegundos ? `(${fmtSecs(cfg.narracao.duracaoSegundos)})` : ''}
                </div>
                <div className="row">
                  <UploadButton label="enviar áudio cru" accept=".wav,.mp3,.m4a,.aac,.ogg,.mp4,.mov,.webm" onFile={onUploadNarracao} />
                  <button className="btn sm" disabled={!assets.narracaoRaw || cleaning} onClick={onCleanGlobalAudio}>
                    {cleaning ? 'limpando…' : 'limpar áudio'}
                  </button>
                </div>
              </React.Fragment>
            )}
        </Group>
      </div>
    </React.Fragment>
  );
}

function UploadButton({ label, accept, onFile }) {
  const ref = React.useRef(null);
  return (
    <React.Fragment>
      <button className="btn sm" onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); }} />
    </React.Fragment>
  );
}

// ── galeria de nova cena (thumbnails SVG espelhando o reel-kit) ──────────────
function Thumb({ children }) {
  return (
    <svg className="thumb" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="90" fill="#0C0C0F" />
      {children}
    </svg>
  );
}
const THUMBS = {
  'camera-intro': () => (<Thumb>
    <rect x="10" y="16" width="60" height="8" rx="3" fill="#ECECEF" />
    <rect x="10" y="30" width="44" height="5" rx="2" fill="#E5484D" />
    <rect x="84" y="10" width="66" height="70" rx="8" fill="#050506" stroke="#E5484D" strokeWidth="2.5" />
    <circle cx="117" cy="36" r="12" fill="#3a3a40" />
    <path d="M99 74c0-12 8-18 18-18s18 6 18 18Z" fill="#3a3a40" />
  </Thumb>),
  passo: () => (<Thumb>
    <text x="18" y="58" fill="#E5484D" fontSize="40" fontWeight="700" fontFamily="IBM Plex Sans">01</text>
    <rect x="66" y="34" width="70" height="7" rx="2" fill="#ECECEF" />
    <rect x="66" y="48" width="48" height="5" rx="2" fill="#87878F" />
  </Thumb>),
  codigo: () => (<Thumb>
    <rect x="22" y="14" width="116" height="62" rx="6" fill="#16161A" stroke="rgba(255,255,255,.14)" />
    <circle cx="32" cy="23" r="2.4" fill="#E5484D" /><circle cx="40" cy="23" r="2.4" fill="#87878F" /><circle cx="48" cy="23" r="2.4" fill="#87878F" />
    <text x="30" y="42" fill="#6bd48a" fontSize="8" fontFamily="IBM Plex Mono">$ pkg install nodejs</text>
    <text x="30" y="56" fill="#B4B4BC" fontSize="8" fontFamily="IBM Plex Mono">$ node -v</text>
  </Thumb>),
  'video-desktop': () => (<Thumb>
    <rect x="20" y="12" width="120" height="62" rx="5" fill="#16161A" stroke="rgba(255,255,255,.14)" />
    <circle cx="29" cy="20" r="2.2" fill="#E5484D" /><circle cx="36" cy="20" r="2.2" fill="#87878F" /><circle cx="43" cy="20" r="2.2" fill="#87878F" />
    <rect x="52" y="16" width="80" height="8" rx="4" fill="#0C0C0F" />
    <rect x="24" y="28" width="112" height="42" rx="2" fill="#1C1C22" />
    <path d="M74 42 88 49 74 56Z" fill="#E5484D" />
  </Thumb>),
  'video-celular': () => (<Thumb>
    <rect x="12" y="30" width="60" height="7" rx="2" fill="#ECECEF" />
    <rect x="12" y="44" width="46" height="5" rx="2" fill="#87878F" />
    <rect x="96" y="8" width="42" height="76" rx="10" fill="#16161A" stroke="rgba(255,255,255,.18)" />
    <rect x="110" y="12" width="14" height="4" rx="2" fill="#0C0C0F" />
    <path d="M111 42 123 48 111 54Z" fill="#E5484D" />
  </Thumb>),
  'image-desktop': () => (<Thumb>
    <rect x="20" y="12" width="120" height="62" rx="5" fill="#16161A" stroke="rgba(255,255,255,.14)" />
    <circle cx="29" cy="20" r="2.2" fill="#E5484D" /><circle cx="36" cy="20" r="2.2" fill="#87878F" /><circle cx="43" cy="20" r="2.2" fill="#87878F" />
    <rect x="24" y="28" width="112" height="42" rx="2" fill="#1C1C22" />
    <circle cx="48" cy="44" r="6" fill="#6bd48a" opacity=".7" />
    <path d="m24 70 30-22 22 16 20-13 40 22" stroke="#87878F" fill="none" strokeWidth="2" />
  </Thumb>),
  'image-celular': () => (<Thumb>
    <rect x="12" y="30" width="60" height="7" rx="2" fill="#ECECEF" />
    <rect x="12" y="44" width="46" height="5" rx="2" fill="#87878F" />
    <rect x="96" y="8" width="42" height="76" rx="10" fill="#16161A" stroke="rgba(255,255,255,.18)" />
    <circle cx="110" cy="40" r="5" fill="#6bd48a" opacity=".7" />
    <path d="m100 74 14-12 10 8 12-9" stroke="#87878F" fill="none" strokeWidth="2" />
  </Thumb>),
  callout: () => (<Thumb>
    <rect x="8" y="8" width="144" height="74" rx="4" fill="#1C1C22" />
    <rect x="26" y="22" width="52" height="26" rx="3" fill="none" stroke="#E5484D" strokeWidth="2.5" />
    <rect x="92" y="52" width="54" height="22" rx="4" fill="#16161A" stroke="rgba(255,255,255,.18)" />
    <rect x="97" y="58" width="34" height="4" rx="2" fill="#ECECEF" />
    <rect x="97" y="65" width="42" height="3" rx="1.5" fill="#87878F" />
  </Thumb>),
  raw: () => (<Thumb>
    <rect x="14" y="12" width="132" height="54" rx="6" fill="#1C1C22" stroke="rgba(255,255,255,.14)" strokeDasharray="4 4" />
    <path d="M72 32 88 39 72 46Z" fill="#E5484D" />
    <rect x="52" y="74" width="56" height="5" rx="2.5" fill="#87878F" />
  </Thumb>),
};

// thumb de um template: usa o svg do manifesto (thumbSvg) ou o built-in de fallback.
function TemplateThumb({ entry }) {
  if (entry.thumbSvg) return <div className="thumb" dangerouslySetInnerHTML={{ __html: entry.thumbSvg }} />;
  const T = THUMBS[entry.id];
  return T ? <T /> : <svg className="thumb" viewBox="0 0 160 90"><rect width="160" height="90" fill="#16161A" /></svg>;
}

function LayoutGallery({ catalog, onPick, onClose }) {
  const items = catalog || SCENE_CATALOG_FALLBACK;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nova cena</h3>
        <div className="sub">escolha o layout — dá para trocar depois no inspector.</div>
        <div className="gallery">
          {items.map((c) => (
            <button key={c.id} className="g-card" onClick={() => onPick(c)}>
              <TemplateThumb entry={c} />
              <div className="g-name">{c.name}</div>
              <div className="g-desc">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Ic, TYPE_META, THUMBS });

function JsonModal({ cfg, onClose }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>JSON do projeto</h3>
        <div className="sub">é isto que vai para projects/&lt;slug&gt;/project.json — somente leitura aqui.</div>
        <textarea className="json-view" readOnly value={JSON.stringify(cfg, null, 2)} />
      </div>
    </div>
  );
}

// ── tela inicial: lista de projetos (todos os formatos, local-first) ─────────
const FORMATOS = [
  { key: 'tutorial', label: 'Tutorial', desc: 'vídeo longo paisagem: gravações de tela, passos, narração' },
  { key: 'lista', label: 'Lista', desc: 'reel vertical: gancho + itens numerados + CTA' },
  { key: 'quiz', label: 'Quiz', desc: 'reel vertical: pergunta + opções + resposta' },
  { key: 'historia', label: 'História', desc: 'reel vertical: gancho + seções + fechamento' },
];

// Menu único de importação (declutter da home): um botão "importar ▾" que abre
// as três opções — .rvs (projeto completo), JSON (só a definição), planilha (quizzes).
function ImportMenu({ online, onDone, onOpen }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const rvsRef = React.useRef(null), jsonRef = React.useRef(null), planRef = React.useRef(null);
  const themeRef = React.useRef(null), tplRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const importRvs = async (file) => {
    const slug = (prompt('slug para o projeto importado:', slugify(file.name.replace(/\.rvs$/i, ''))) || '').trim();
    if (!slug) return;
    if (!SLUG_RE_UI.test(slug)) return alert('slug inválido — letras minúsculas, números e hífens.');
    setBusy('.rvs');
    try {
      const res = await fetch('/api/import?slug=' + encodeURIComponent(slug), { method: 'POST', body: await file.arrayBuffer() });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'falha');
      onDone && onDone(); alert('✓ importado: ' + slug);
    } catch (e) { alert('erro ao importar: ' + (e.message || e)); }
    setBusy('');
  };
  const importJson = async (file) => {
    let cfg;
    try { cfg = JSON.parse(await file.text()); } catch { return alert('arquivo não é um JSON válido.'); }
    if (!cfg || typeof cfg !== 'object' || !cfg.formato) return alert('JSON não parece um projeto (falta "formato").');
    const base = file.name.replace(/\.json$/i, '').replace(/^project$/i, cfg.titulo || cfg.tag || 'projeto');
    const slug = (prompt('slug para o projeto importado:', slugify(base)) || '').trim();
    if (!slug) return;
    if (!SLUG_RE_UI.test(slug)) return alert('slug inválido — letras minúsculas, números e hífens.');
    setBusy('JSON');
    try {
      const res = await fetch('/api/tutorial/' + encodeURIComponent(slug), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'falha');
      onDone && onDone();
      if (onOpen && confirm('✓ importado: ' + slug + '\n\nabrir agora?')) onOpen(slug);
    } catch (e) { alert('erro ao importar JSON: ' + (e.message || e)); }
    setBusy('');
  };
  const importPlanilha = async (file) => {
    setBusy('planilha');
    try {
      const res = await fetch('/api/import-planilha', { method: 'POST', body: await file.arrayBuffer() });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'falha');
      onDone && onDone(); alert(`✓ ${j.total} quizzes importados (${j.okCount} ok, ${j.warns} com avisos)`);
    } catch (e) { alert('erro ao importar planilha: ' + (e.message || e)); }
    setBusy('');
  };
  const importPack = (isTheme) => async (file) => {
    const kind = isTheme ? 'tema' : 'template';
    const id = (prompt(`id para o ${kind} importado:`, slugify(file.name.replace(/\.(rvtheme|rvtemplate)$/i, ''))) || '').trim();
    if (!id) return;
    if (!SLUG_RE_UI.test(id)) return alert('id inválido — letras minúsculas, números e hífens.');
    setBusy(kind);
    try {
      const route = isTheme ? '/api/import-theme' : '/api/import-template';
      const res = await fetch(route + '?id=' + encodeURIComponent(id), { method: 'POST', body: await file.arrayBuffer() });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'falha');
      onDone && onDone(); alert(`✓ ${kind} "${id}" importado`);
    } catch (e) { alert(`erro ao importar ${kind}: ` + (e.message || e)); }
    setBusy('');
  };

  return (
    <div className="import-menu" ref={wrapRef}>
      <button className="btn" disabled={!online || !!busy} title={online ? 'importar projeto' : 'precisa do PC conectado'}
        onClick={() => setOpen(!open)}>{busy ? 'importando ' + busy + '…' : 'importar ▾'}</button>
      {open && (
        <div className="import-pop">
          <button onClick={() => { setOpen(false); rvsRef.current?.click(); }}><b>.rvs</b><span>projeto completo (com mídia)</span></button>
          <button onClick={() => { setOpen(false); jsonRef.current?.click(); }}><b>JSON</b><span>só a definição, sem mídia</span></button>
          <button onClick={() => { setOpen(false); planRef.current?.click(); }}><b>planilha</b><span>lote de quizzes (.xlsx)</span></button>
          <button onClick={() => { setOpen(false); themeRef.current?.click(); }}><b>tema</b><span>visual (.rvtheme)</span></button>
          <button onClick={() => { setOpen(false); tplRef.current?.click(); }}><b>template</b><span>layout de cena (.rvtemplate)</span></button>
        </div>
      )}
      <input ref={rvsRef} type="file" accept=".rvs" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importRvs(f); }} />
      <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importJson(f); }} />
      <input ref={planRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPlanilha(f); }} />
      <input ref={themeRef} type="file" accept=".rvtheme" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPack(true)(f); }} />
      <input ref={tplRef} type="file" accept=".rvtemplate" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPack(false)(f); }} />
    </div>
  );
}

function ProjectHome({ online, onOpen, onNew }) {
  const [items, setItems] = React.useState(null);
  const [filtro, setFiltro] = React.useState('todos');
  const [busca, setBusca] = React.useState('');
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [del, setDel] = React.useState(null);   // slug pendente de confirmação de exclusão
  const [delBusy, setDelBusy] = React.useState(false);
  const refresh = React.useCallback(() => {
    Store.listAll().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh, online]);
  const doDelete = async () => {
    setDelBusy(true);
    try { await Store.deleteProject(del, online); setDel(null); refresh(); }
    catch (e) { alert(String(e.message || e)); }
    finally { setDelBusy(false); }
  };

  const BADGE = {
    sincronizado: ['synced', 'sincronizado'],
    pendente: ['pending', 'não sincronizado'],
    local: ['pending', 'só neste aparelho'],
    remoto: ['remote', 'só no PC'],
  };
  const filtered = (items || []).filter((it) =>
    (filtro === 'todos' || it.formato === filtro) &&
    (!busca || it.slug.includes(busca.toLowerCase())));
  const counts = {};
  for (const it of (items || [])) counts[it.formato] = (counts[it.formato] || 0) + 1;

  return (
    <div className="home">
      <div className="home-head">
        <h2 style={{ margin: 0 }}>projetos</h2>
        <div className="grow" />
        <ImportMenu online={online} onDone={refresh} onOpen={onOpen} />
        <button className="btn primary" onClick={() => setNovoOpen(true)}><Ic.plus /> novo projeto</button>
      </div>

      <div className="home-filters">
        <button className={'chip' + (filtro === 'todos' ? ' active' : '')} onClick={() => setFiltro('todos')}>todos {items ? `(${items.length})` : ''}</button>
        {FORMATOS.map((f) => (
          <button key={f.key} className={'chip' + (filtro === f.key ? ' active' : '')} onClick={() => setFiltro(f.key)}>
            {f.label}{counts[f.key] ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>
      <input type="text" className="home-search" placeholder="buscar por slug…" value={busca}
        onChange={(e) => setBusca(e.target.value)} />

      {items === null && <div className="hint">carregando…</div>}
      {items && !filtered.length && <div className="hint">nenhum projeto {busca ? 'com esse nome' : 'neste formato'}.</div>}
      <ul className="home-list">
        {filtered.slice(0, 200).map((it) => {
          const [cls, label] = BADGE[it.status] || ['pending', it.status];
          return (
            <li key={it.slug} onClick={() => onOpen(it.slug)}>
              <span className="home-format">{it.formato}</span>
              <span className="home-slug">{it.slug}</span>
              <div className="grow" />
              <span className={'badge ' + cls}>{label}</span>
              <button className="icon-btn danger" title="excluir projeto" onClick={(e) => { e.stopPropagation(); setDel(it.slug); }}><Ic.trash /></button>
            </li>
          );
        })}
      </ul>
      {filtered.length > 200 && <div className="hint">mostrando 200 de {filtered.length} — refine a busca.</div>}
      {online === false && <div className="hint" style={{ marginTop: 10 }}>○ offline — mostrando só o que está neste aparelho.</div>}

      {del && (
        <div className="modal-scrim" onClick={() => !delBusy && setDel(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h3>Excluir projeto</h3>
            <div className="sub">Isso apaga <b>{del}</b> — o <code>project.json</code>, os assets e o render (no PC e neste aparelho). <b>Não dá pra desfazer.</b></div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setDel(null)} disabled={delBusy}>cancelar</button>
              <button className="btn danger" onClick={doDelete} disabled={delBusy}>{delBusy ? 'excluindo…' : 'excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {novoOpen && (
        <div className="modal-scrim" onClick={() => setNovoOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>Novo projeto</h3>
            <div className="sub">escolha o formato do vídeo.</div>
            <div className="gallery" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {FORMATOS.map((f) => (
                <button key={f.key} className="g-card" onClick={() => { setNovoOpen(false); onNew(f.key); }}>
                  <div className="g-name">{f.label}</div>
                  <div className="g-desc">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── render em lote ───────────────────────────────────────────────────────────
// Lista os projetos com status de render (feito/pendente/desatualizado), enfileira
// renders SEQUENCIAIS (o servidor renderiza 1 por vez) e permite re-renderizar.
// Só faz sentido online — a renderização exige o PC. Status do servidor via
// GET /api/projects (rendered/stale); progresso via GET /api/render/<slug>/status.
const BATCH_LABEL = { pendente: 'pendente', desatualizado: 'desatualizado', feito: '✓ feito', fila: 'na fila', render: 'renderizando', ok: '✓ feito', erro: '✗ erro' };
function BatchRender({ online, onOpen }) {
  const [items, setItems] = React.useState(null); // [{slug,formato,rendered,stale}]
  const [rt, setRt] = React.useState({});         // slug -> {state, frame, total, error} (runtime)
  const [fmt, setFmt] = React.useState('todos');
  const [statusFiltro, setStatusFiltro] = React.useState('todos');
  const [running, setRunning] = React.useState(false);
  const stopRef = React.useRef(false);

  const load = React.useCallback(() => {
    fetch('/api/projects').then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, []);
  React.useEffect(() => { if (online) load(); }, [online, load]);

  const baseStatus = (it) => (it.rendered ? (it.stale ? 'desatualizado' : 'feito') : 'pendente');
  const dispStatus = (it) => rt[it.slug]?.state || baseStatus(it);
  const counts = { pendente: 0, desatualizado: 0, feito: 0 };
  for (const it of (items || [])) counts[baseStatus(it)]++;
  const filtered = (items || []).filter((it) =>
    (fmt === 'todos' || it.formato === fmt) &&
    (statusFiltro === 'todos' || baseStatus(it) === statusFiltro));
  const pendentes = filtered.filter((it) => baseStatus(it) !== 'feito').map((it) => it.slug);
  const runVals = Object.values(rt);
  const prog = { done: runVals.filter((s) => s.state === 'ok' || s.state === 'erro').length, total: runVals.length };

  // renderiza um slug: POST + poll até done/error.
  const renderSlug = (slug) => new Promise((resolve) => {
    setRt((s) => ({ ...s, [slug]: { state: 'render', frame: 0, total: 0 } }));
    fetch('/api/render/' + slug, { method: 'POST' }).catch(() => {});
    const t = setInterval(async () => {
      const st = await fetch(`/api/render/${slug}/status`).then((r) => r.json()).catch(() => null);
      if (!st) return;
      if (st.state === 'running') { setRt((s) => ({ ...s, [slug]: { state: 'render', frame: st.frame, total: st.total } })); return; }
      clearInterval(t);
      if (st.state === 'done') {
        setRt((s) => ({ ...s, [slug]: { state: 'ok' } }));
        setItems((list) => (list || []).map((x) => (x.slug === slug ? { ...x, rendered: true, stale: false } : x)));
      } else if (st.state === 'error') {
        setRt((s) => ({ ...s, [slug]: { state: 'erro', error: st.error } }));
      } else { setRt((s) => { const n = { ...s }; delete n[slug]; return n; }); }
      resolve();
    }, 1000);
  });
  const runQueue = async (slugs) => {
    if (!slugs.length || running) return;
    stopRef.current = false; setRunning(true);
    setRt((s) => { const n = { ...s }; for (const sl of slugs) n[sl] = { state: 'fila' }; return n; });
    for (const sl of slugs) {
      if (stopRef.current) { setRt((s) => { const n = { ...s }; if (n[sl]?.state === 'fila') delete n[sl]; return n; }); continue; }
      await renderSlug(sl);
    }
    setRunning(false);
  };

  if (online === false) return <div className="home"><div className="hint">○ offline — a renderização exige o PC. Conecte-se para renderizar em lote.</div></div>;

  return (
    <div className="home">
      <div className="home-head">
        <h2 style={{ margin: 0 }}>render em lote</h2>
        <div className="grow" />
        <button className="btn sm" onClick={load} disabled={running}>atualizar</button>
        {running
          ? <button className="btn sm" onClick={() => { stopRef.current = true; }}>parar após atual</button>
          : <button className="btn primary" disabled={!pendentes.length} onClick={() => runQueue(pendentes)}>renderizar pendentes{pendentes.length ? ` (${pendentes.length})` : ''}</button>}
      </div>

      <div className="home-filters">
        <button className={'chip' + (fmt === 'todos' ? ' active' : '')} onClick={() => setFmt('todos')}>todos {items ? `(${items.length})` : ''}</button>
        {FORMATOS.map((f) => <button key={f.key} className={'chip' + (fmt === f.key ? ' active' : '')} onClick={() => setFmt(f.key)}>{f.label}</button>)}
      </div>
      <div className="home-filters">
        {[['todos', 'tudo'], ['pendente', `pendentes (${counts.pendente})`], ['desatualizado', `desatualizados (${counts.desatualizado})`], ['feito', `feitos (${counts.feito})`]].map(([k, l]) => (
          <button key={k} className={'chip' + (statusFiltro === k ? ' active' : '')} onClick={() => setStatusFiltro(k)}>{l}</button>
        ))}
      </div>

      {running && <div className="hint">renderizando… {prog.done}/{prog.total} concluídos (1 por vez — não feche o PC).</div>}
      {items === null && <div className="hint">carregando…</div>}
      {items && !filtered.length && <div className="hint">nenhum projeto aqui.</div>}

      <ul className="home-list batch">
        {filtered.slice(0, 400).map((it) => {
          const st = dispStatus(it);
          const r = rt[it.slug];
          return (
            <li key={it.slug}>
              <span className="home-format">{it.formato}</span>
              <span className="home-slug" style={{ cursor: 'pointer' }} onClick={() => onOpen(it.slug)}>{it.slug}</span>
              <div className="grow" />
              {r?.state === 'render' && (
                <span className="batch-prog"><span className="bar"><div style={{ width: (r.total ? Math.round(100 * r.frame / r.total) : 0) + '%' }} /></span>{r.total ? Math.round(100 * r.frame / r.total) + '%' : '…'}</span>
              )}
              <span className={'badge batch-' + st} title={r?.error || ''}>{BATCH_LABEL[st] || st}</span>
              {it.rendered && <a className="btn xs" href={'/projects/' + it.slug + '/render/video.mp4'} target="_blank" onClick={(e) => e.stopPropagation()}>mp4</a>}
              <button className="btn xs" disabled={running || r?.state === 'render'} onClick={() => runQueue([it.slug])}>{it.rendered ? 'de novo' : 'renderizar'}</button>
            </li>
          );
        })}
      </ul>
      {filtered.length > 400 && <div className="hint">mostrando 400 de {filtered.length}.</div>}
    </div>
  );
}

// ── teleprompter karaoke (portado do mobile) ─────────────────────────────────
// target = duração-alvo da cena (mídia anexada); sem alvo, só cronômetro.
function Teleprompter({ roteiro, elapsed, target }) {
  const words = (roteiro || '').split(/\s+/).filter(Boolean);
  const progress = target > 0 ? Math.min(1, Math.max(0, elapsed / target)) : 0;
  const readCount = target > 0 ? Math.min(words.length, Math.floor(progress * words.length)) : 0;
  const secondsLeft = target > 0 ? Math.max(0, target - elapsed) : null;
  return (
    <div className="teleprompter">
      <div className="teleprompter-countdown">
        {target > 0
          ? <React.Fragment>
              <div className="teleprompter-bar"><div style={{ width: (progress * 100) + '%' }} /></div>
              <span>{secondsLeft.toFixed(1)}s restantes</span>
            </React.Fragment>
          : <span>{elapsed.toFixed(1)}s (sem duração-alvo — o take define a duração da cena)</span>}
      </div>
      <div className="teleprompter-text">
        {words.map((w, i) => (
          <span key={i} className={target > 0 ? (i < readCount ? 'word-read' : 'word-pending') : 'word-pending'}>{w} </span>
        ))}
      </div>
    </div>
  );
}

// ── gravação guiada por cena ─────────────────────────────────────────────────
// Fluxo do antigo mobile GravarTab, agora por cena: a mídia da cena toca
// enquanto você narra lendo o teleprompter; errou, regrava SÓ aquela cena.
function GravarPanel({ cfg, assetUrl, onTake }) {
  const scenes = cfg.scenes || [];
  const [idx, setIdx] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const timerRef = React.useRef(null);
  const scene = scenes[Math.min(idx, scenes.length - 1)];
  const r = useTakeRecorder({
    onUse: async (blob, comCamera) => { await onTake(scene, blob, comCamera); },
  });

  // cronômetro do teleprompter acompanha o estado de gravação do recorder.
  React.useEffect(() => {
    if (r.state === 'recording') {
      const t0 = Date.now();
      timerRef.current = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    } else {
      clearInterval(timerRef.current);
      if (r.state === 'idle') setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [r.state]);

  if (!scenes.length) return <div className="hint" style={{ padding: 20 }}>crie cenas primeiro para gravar os takes.</div>;

  const mediaUrl = scene.src ? assetUrl(scene.src) : null;
  const isVideo = scene.type === 'video';
  // alvo do karaoke = duração da mídia anexada (não do take, que ainda não existe)
  const target = isVideo && scene.duration ? +scene.duration : 0;
  const takeState = (s) => s.audio?.src ? (s.audio.pendente ? '◌' : '●') : '○';

  return (
    <div className="gravar">
      <div className="gravar-scenes">
        {scenes.map((s, i) => (
          <button key={s.id || i} className={'gravar-scene-chip' + (i === idx ? ' active' : '')}
            onClick={() => { if (r.state === 'idle') setIdx(i); }} disabled={r.state !== 'idle' && i !== idx}
            title={s.titulo || s.caption || ''}>
            <span className="chip-state">{takeState(s)}</span> {i + 1}
          </button>
        ))}
      </div>

      <div className="gravar-stage">
        {mediaUrl && isVideo && (
          <video key={mediaUrl + ':' + (r.state === 'recording')} className="gravar-media" src={mediaUrl}
            muted playsInline autoPlay={r.state === 'recording'} loop={false} preload="metadata" />
        )}
        {mediaUrl && !isVideo && <img className="gravar-media" src={mediaUrl} alt="" />}
        {!mediaUrl && (
          <div className="gravar-media placeholder">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mute)' }}>
              cena {idx + 1} · {scene.type}{scene.titulo ? ' · ' + scene.titulo : ''}
            </div>
          </div>
        )}
        {r.state === 'recording' && r.comCamera && (
          <video ref={r.camPreviewRef} className="gravar-cam" autoPlay muted playsInline />
        )}
        {r.state === 'recording' && <span className="rec-indicator"><span className="live">●</span> REC {r.secs.toFixed(1)}s</span>}
        {scene.roteiro && r.state !== 'review' && (
          <Teleprompter roteiro={scene.roteiro} elapsed={elapsed} target={r.state === 'recording' ? target : 0} />
        )}
      </div>

      <div className="gravar-controls">
        {r.state === 'idle' && (
          <React.Fragment>
            <label className="check" style={{ margin: 0 }}>
              <input type="checkbox" checked={r.comCamera} onChange={(e) => r.setComCamera(e.target.checked)} /> câmera
            </label>
            <button className="btn primary" onClick={r.start}><Ic.mic /> gravar cena {idx + 1}</button>
            {scene.audio?.src && <span className="hint">já tem take ({fmtSecs(scene.audio.duracaoSegundos)}) — gravar de novo substitui.</span>}
          </React.Fragment>
        )}
        {r.state === 'recording' && <button className="btn primary" onClick={r.stop}>parar</button>}
        {r.state === 'review' && (
          <React.Fragment>
            {r.wasCamera
              ? <video controls src={r.reviewUrl} style={{ maxHeight: 140, borderRadius: 8 }} />
              : <audio controls src={r.reviewUrl} style={{ flex: 1 }} />}
            <button className="btn primary" onClick={async () => { await r.use(); if (idx < scenes.length - 1) setIdx(idx + 1); }}>usar → próxima</button>
            <button className="btn" onClick={() => { r.discard(); r.start(); }}>regravar</button>
            <button className="btn danger" onClick={r.discard}>descartar</button>
          </React.Fragment>
        )}
        {r.state === 'busy' && <span className="rec-status">salvando take…</span>}
        {r.err && <span className="hint" style={{ color: 'var(--red-soft)' }}>{r.err}</span>}
      </div>
    </div>
  );
}

// ── editores dos formatos verticais (lista/quiz/historia) ────────────────────

// editor genérico de lista com add/remover/reordenar.
function ListEditor({ label, items, onChange, renderItem, makeItem, min = 0, max = 99 }) {
  const list = items || [];
  const set = (i, v) => onChange(list.map((x, xi) => xi === i ? v : x));
  const add = () => onChange([...list, makeItem()]);
  const remove = (i) => onChange(list.filter((_, xi) => xi !== i));
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <F label={`${label} (${list.length})`}>
      {list.map((it, i) => (
        <div key={i} className="list-item">
          <div className="list-item-body">{renderItem(it, (v) => set(i, v), i)}</div>
          <div className="list-item-actions">
            <button className="icon-btn" title="subir" disabled={i === 0} onClick={() => move(i, -1)}><Ic.left /></button>
            <button className="icon-btn" title="descer" disabled={i === list.length - 1} onClick={() => move(i, 1)}><Ic.right /></button>
            <button className="icon-btn" title="remover" disabled={list.length <= min} onClick={() => remove(i)}><Ic.trash /></button>
          </div>
        </div>
      ))}
      {list.length < max && <button className="btn sm" onClick={add}><Ic.plus /> adicionar</button>}
    </F>
  );
}

function ListaEditor({ cfg, patch }) {
  return (
    <React.Fragment>
      <Group title="gancho">
        <TextField label="tag (canto superior)" value={cfg.tag} onChange={(v) => patch({ tag: v })} />
        <TextField label="hook linha 1 (ate 22)" value={cfg.hook1} onChange={(v) => patch({ hook1: v })} />
        <TextField label="hook linha 2 - vermelha (ate 22)" value={cfg.hook2} onChange={(v) => patch({ hook2: v })} />
        <TextField label="subtitulo do gancho" value={cfg.hookSub} onChange={(v) => patch({ hookSub: v })} />
      </Group>
      <Group title="itens (3 a 7)">
        <ListEditor label="itens" items={cfg.items} min={3} max={7}
          makeItem={() => ({ badge: '', text: '' })}
          onChange={(items) => patch({ items })}
          renderItem={(it, set) => (
            <div className="row">
              <input className="fixed" style={{ width: 90, fontFamily: 'var(--mono)' }} type="text" placeholder="badge" value={it.badge ?? ''} onChange={(e) => set({ ...it, badge: e.target.value })} />
              <input type="text" placeholder="texto do item (ate 28)" value={it.text ?? ''} onChange={(e) => set({ ...it, text: e.target.value })} />
            </div>
          )} />
        <div className="hint">badge vazio vira o numero do item.</div>
      </Group>
      <Group title="fechamento">
        <TextField label="CTA titulo" value={cfg.ctaTitle} onChange={(v) => patch({ ctaTitle: v })} />
        <TextField label="CTA subtitulo" value={cfg.ctaSub} onChange={(v) => patch({ ctaSub: v })} />
        <TextField label="handle (rodape)" value={cfg.handleSub} onChange={(v) => patch({ handleSub: v })} />
        <TextField label="grid do fundo (ex.: cells)" value={cfg.grid} onChange={(v) => patch({ grid: v })} mono />
      </Group>
    </React.Fragment>
  );
}

// Narração da pergunta (quiz): grava a voz OU gera por TTS. Grava cfg.narracao
// (o render muxa e a cena da pergunta passa a durar o tempo da fala). Só online.
function NarracaoQuiz({ slug, cfg, online, patch }) {
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const rec = useTakeRecorder({
    onUse: async (blob) => {
      setErr(''); setBusy('enviando…');
      try {
        await fetch(`/api/assets/${encodeURIComponent(slug)}/narracao/${encodeURIComponent(slug)}.webm`, { method: 'PUT', body: blob });
        const n = await api(`/api/audio/${encodeURIComponent(slug)}`, { method: 'POST' });
        patch({ narracao: { raw: n.raw, limpo: n.limpo, duracaoSegundos: n.duracaoSegundos } });
      } catch (e) { setErr(String(e.message || e)); } finally { setBusy(''); }
    },
  });
  const gerarTTS = async () => {
    const text = (cfg.question || '').replace(/\n/g, ' ').trim();
    if (!text) { setErr('escreva a pergunta primeiro'); return; }
    setErr(''); setBusy('gerando (TTS)…');
    try {
      const n = await api(`/api/tts/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      patch({ narracao: { raw: n.raw, limpo: n.limpo, duracaoSegundos: n.duracaoSegundos } });
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(''); }
  };
  const dur = cfg.narracao?.duracaoSegundos;
  if (!online) return <div className="hint">narração exige o PC conectado.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dur > 0 && <div className="hint">✓ narração: {fmtSecs(dur)} — a pergunta fica no ar esse tempo. <button className="btn xs" onClick={() => patch({ narracao: undefined })}>remover</button></div>}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {rec.state === 'recording'
          ? <button className="btn sm danger" onClick={rec.stop}>parar ({rec.secs}s)</button>
          : <button className="btn sm" onClick={rec.start} disabled={!!busy}><Ic.mic /> gravar voz</button>}
        {rec.state === 'review' && <><button className="btn sm primary" onClick={rec.use}>usar</button><button className="btn sm" onClick={rec.discard}>descartar</button></>}
        <button className="btn sm" onClick={gerarTTS} disabled={!!busy || rec.state === 'recording'}>gerar por TTS</button>
      </div>
      {rec.reviewUrl && rec.state === 'review' && <audio src={rec.reviewUrl} controls style={{ width: '100%' }} />}
      {busy && <div className="hint">{busy}</div>}
      {(err || rec.err) && <div className="warn-chip" title={err || rec.err}>✗ {(err || rec.err).slice(0, 80)}</div>}
      <div className="hint">TTS usa a pergunta como texto. Provedor/voz por env (ver docs/voz-tts.md).</div>
    </div>
  );
}

// Áudio de CTA COMPARTILHADO (voz/cta.m4a) — reutilizado por todos os quizzes.
// Padrão gerado por TTS; dá pra regerar com outro texto ou gravar a própria voz.
function CtaAudio({ online }) {
  const [info, setInfo] = React.useState(null);
  const [text, setText] = React.useState('Acertou? Comenta aí.');
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const load = React.useCallback(() => { fetch('/api/voz/cta').then((r) => r.json()).then(setInfo).catch(() => setInfo({ exists: false })); }, []);
  React.useEffect(() => { if (online) load(); }, [online, load]);

  const rec = useTakeRecorder({ onUse: async (blob) => {
    const put = await fetch('/api/voz/cta/cta.webm', { method: 'PUT', body: blob });
    if (!put.ok) throw new Error((await put.json().catch(() => ({}))).error || 'falha ao enviar');
    load();
  } });
  const gerarTTS = async () => {
    setBusy('tts'); setErr('');
    try {
      const r = await fetch('/api/tts-shared/cta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || 'falha no TTS');
      load();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(''); }
  };

  if (!online) return <div className="hint">o áudio do CTA fica disponível conectado ao PC.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="hint"><b>Compartilhado por todos os quizzes</b> — toca no fim de cada vídeo. Se mudar a frase, regere (TTS) ou grave a sua voz.</div>
      {info?.exists
        ? <div className="row" style={{ alignItems: 'center' }}><audio controls src={`/${info.src}?v=${info.duracaoSegundos}`} style={{ flex: 1, height: 32 }} /><span className="hint" style={{ flex: 'none' }}>{fmtSecs(info.duracaoSegundos)}</span></div>
        : <div className="hint">nenhum áudio de CTA ainda.</div>}
      <div className="row">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="texto do CTA" />
        <button className="btn sm" style={{ flex: 'none' }} disabled={!!busy || !text.trim()} onClick={gerarTTS}>{busy === 'tts' ? 'gerando…' : 'gerar (TTS)'}</button>
      </div>
      <div className="row">
        {rec.state === 'idle' && <button className="btn sm" onClick={rec.start}>● gravar minha voz</button>}
        {rec.state === 'recording' && <><span className="rec-status"><span className="live">●</span> {fmtSecs(rec.secs)}</span><button className="btn sm" onClick={rec.stop}>parar</button></>}
        {rec.state === 'review' && <><audio controls src={rec.reviewUrl} style={{ flex: 1, height: 32 }} /><button className="btn sm primary" style={{ flex: 'none' }} onClick={rec.use}>usar</button><button className="btn sm" style={{ flex: 'none' }} onClick={rec.discard}>descartar</button></>}
        {rec.state === 'busy' && <span className="hint">processando…</span>}
      </div>
      {(err || rec.err) && <div className="warn-chip" title={err || rec.err}>✗ {(err || rec.err).slice(0, 70)}</div>}
    </div>
  );
}

function QuizEditor({ cfg, patch, slug, online }) {
  const options = cfg.options || [];
  const setCorrect = (idx) => patch({ options: options.map((o, i) => ({ ...o, correct: i === idx })) });
  return (
    <React.Fragment>
      <Group title="gancho">
        <TextField label="tag" value={cfg.tag} onChange={(v) => patch({ tag: v })} />
        <TextField label="hook (curto)" value={cfg.hook1} onChange={(v) => patch({ hook1: v })} />
        <TextField label="subtitulo do gancho" value={cfg.hookSub} onChange={(v) => patch({ hookSub: v })} />
      </Group>
      <Group title="pergunta">
        <AreaField label="pergunta (uma frase por linha, ate 24/linha)" value={cfg.question} onChange={(v) => patch({ question: v })} rows={3} />
      </Group>
      <Group title="narração da pergunta (opcional)">
        <NarracaoQuiz slug={slug} cfg={cfg} online={online} patch={patch} />
      </Group>
      <Group title="opcoes (2 a 4, marque a correta)">
        <ListEditor label="opcoes" items={options} min={2} max={4}
          makeItem={() => ({ text: '', correct: false })}
          onChange={(opts) => patch({ options: opts })}
          renderItem={(it, set, i) => (
            <div className="row">
              <label className="fixed" title="correta" style={{ display: 'flex', alignItems: 'center' }}>
                <input type="radio" name="quiz-correct" checked={!!it.correct} onChange={() => setCorrect(i)} />
              </label>
              <input type="text" placeholder="texto da opcao (ate 18)" value={it.text ?? ''} onChange={(e) => set({ ...it, text: e.target.value })} />
            </div>
          )} />
      </Group>
      <Group title="resposta e fechamento">
        <TextField label="explicacao/reveal (ate 34)" value={cfg.reveal} onChange={(v) => patch({ reveal: v })} />
        <TextField label="CTA titulo" value={cfg.ctaTitle} onChange={(v) => patch({ ctaTitle: v })} />
        <TextField label="handle (rodape)" value={cfg.handleSub} onChange={(v) => patch({ handleSub: v })} />
      </Group>
      <Group title="CTA (áudio)"><CtaAudio online={online} /></Group>
    </React.Fragment>
  );
}

function HistoriaEditor({ cfg, patch }) {
  const hook = cfg.hook || {};
  const cta = cfg.cta || {};
  return (
    <React.Fragment>
      <Group title="gancho">
        <TextField label="tag" value={cfg.tag} onChange={(v) => patch({ tag: v })} />
        <TextField label="linha 1 (ate 16)" value={hook.line1} onChange={(v) => patch({ hook: { ...hook, line1: v } })} />
        <TextField label="linha 2 (ate 16)" value={hook.line2} onChange={(v) => patch({ hook: { ...hook, line2: v } })} />
        <TextField label="punch - vermelha (ate 30)" value={hook.punch} onChange={(v) => patch({ hook: { ...hook, punch: v } })} />
      </Group>
      <Group title="secoes (2 a 4)">
        <ListEditor label="secoes" items={cfg.sections} min={2} max={4}
          makeItem={() => ({ eyebrow: '// nova secao', title: '', body: '', punch: '' })}
          onChange={(sections) => patch({ sections })}
          renderItem={(sec, set) => {
            const tipo = sec.widget ? sec.widget.type : 'texto';
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input type="text" placeholder="eyebrow (// titulo curto)" style={{ fontFamily: 'var(--mono)' }} value={sec.eyebrow ?? ''} onChange={(e) => set({ ...sec, eyebrow: e.target.value })} />
                <select value={tipo} onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'texto') { const { widget, ...rest } = sec; set({ ...rest, title: sec.title || '', body: sec.body || '' }); }
                  else if (t === 'stats') set({ eyebrow: sec.eyebrow, widget: { type: 'stats', rows: sec.widget?.rows || [['', '']] } });
                  else set({ eyebrow: sec.eyebrow, widget: { type: 'flow', chips: sec.widget?.chips || ['', ''] } });
                }}>
                  <option value="texto">texto (titulo/corpo/punch)</option>
                  <option value="stats">widget: estatisticas</option>
                  <option value="flow">widget: fluxo (chips)</option>
                </select>
                {tipo === 'texto' && (
                  <React.Fragment>
                    <input type="text" placeholder="titulo (ate 24)" value={sec.title ?? ''} onChange={(e) => set({ ...sec, title: e.target.value })} />
                    <input type="text" placeholder="corpo (ate 38)" value={sec.body ?? ''} onChange={(e) => set({ ...sec, body: e.target.value })} />
                    <input type="text" placeholder="punch (ate 30)" value={sec.punch ?? ''} onChange={(e) => set({ ...sec, punch: e.target.value })} />
                  </React.Fragment>
                )}
                {tipo === 'stats' && (
                  <ListEditor label="linhas" items={sec.widget.rows} min={1} max={4}
                    makeItem={() => ['', '']}
                    onChange={(rows) => set({ ...sec, widget: { type: 'stats', rows } })}
                    renderItem={(row, setRow) => (
                      <div className="row">
                        <input className="fixed" style={{ width: 90, fontFamily: 'var(--mono)' }} type="text" placeholder="No" value={row[0] ?? ''} onChange={(e) => setRow([e.target.value, row[1]])} />
                        <input type="text" placeholder="descricao" value={row[1] ?? ''} onChange={(e) => setRow([row[0], e.target.value])} />
                      </div>
                    )} />
                )}
                {tipo === 'flow' && (
                  <ListEditor label="chips" items={sec.widget.chips} min={2} max={5}
                    makeItem={() => ''}
                    onChange={(chips) => set({ ...sec, widget: { type: 'flow', chips } })}
                    renderItem={(chip, setChip) => (
                      <input type="text" placeholder="chip" value={chip ?? ''} onChange={(e) => setChip(e.target.value)} />
                    )} />
                )}
              </div>
            );
          }} />
      </Group>
      <Group title="fechamento">
        <TextField label="linha de topo (mono)" value={cta.top} onChange={(v) => patch({ cta: { ...cta, top: v } })} mono />
        <AreaField label="titulo do fechamento (ate 24/linha)" value={cta.title} onChange={(v) => patch({ cta: { ...cta, title: v } })} rows={2} />
        <TextField label="handle (rodape)" value={cfg.handleSub} onChange={(v) => patch({ handleSub: v })} />
      </Group>
    </React.Fragment>
  );
}

// editor de reel vertical: formulario do formato + preview retrato tocando.
// narrow (celular): só o formulário, com botão pra abrir o preview em overlay.
function ReelEditor({ slug, cfg, nonce, online, patch, narrow, onOpenPreview }) {
  const Editor = { lista: ListaEditor, quiz: QuizEditor, historia: HistoriaEditor }[cfg.formato];
  const src = online ? `/player/player.html?reel=${encodeURIComponent(slug)}&v=${nonce}` : 'about:blank';
  const form = (
    <React.Fragment>
      <Group title="canal (tema + layout)">
        <ThemeSelect value={cfg.theme} online={online} onChange={(v) => patch({ theme: v })} />
        {cfg.formato === 'quiz' && (
          <QuizTemplateSelect value={cfg.template} online={online} onChange={(v) => patch({ template: v })} />
        )}
      </Group>
      {Editor
        ? <Editor cfg={cfg} patch={patch} slug={slug} online={online} />
        : <div className="hint">formato "{cfg.formato}" nao tem editor visual - use o JSON.</div>}
    </React.Fragment>
  );
  if (narrow) {
    return (
      <div className="reel-editor narrow">
        <div className="reel-form">
          <div className="narrow-actions">
            <button className="btn" onClick={onOpenPreview} disabled={!online}><Ic.play /> preview</button>
          </div>
          {form}
        </div>
      </div>
    );
  }
  return (
    <div className="reel-editor">
      <div className="reel-form">{form}</div>
      <div className="reel-preview">
        <div className="preview-frame-wrap portrait">
          {online
            ? <iframe key={slug + ':' + nonce} src={src} title="preview" />
            : <div className="preview-offline"><Ic.phone /><div>preview disponivel quando conectado ao PC</div></div>}
        </div>
        <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>a animacao toca em loop - salve para atualizar.</div>
      </div>
    </div>
  );
}
