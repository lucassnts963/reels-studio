// studio/db.js — camada local-first (IndexedDB) do Studio unificado.
// Mantém o MESMO banco do antigo mobile-studio ('reels-studio-mobile'):
// IndexedDB é por origem, então projetos/gravações feitos no app móvel
// antigo aparecem aqui automaticamente, sem migração.

const DB_NAME = 'reels-studio-mobile';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'slug' });
      }
      if (!db.objectStoreNames.contains('assets')) {
        const store = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
        store.createIndex('slug', 'slug', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// pede armazenamento persistente uma vez (evita o navegador descartar blobs
// grandes de gravação sob pressão de disco — relevante no Android).
let persistAsked = false;
function askPersist() {
  if (persistAsked || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}

const DB = {
  async listProjects() {
    const db = await openDB();
    return reqToPromise(tx(db, 'projects', 'readonly').getAll());
  },

  async getProject(slug) {
    const db = await openDB();
    return reqToPromise(tx(db, 'projects', 'readonly').get(slug));
  },

  // cfg: o objeto content/<slug>.json inteiro. syncedAt fica intacto a
  // menos que markSynced seja chamado (mudança pendente = updatedAt > syncedAt).
  async saveProject(slug, cfg) {
    const db = await openDB();
    const existing = await reqToPromise(tx(db, 'projects', 'readonly').get(slug));
    const record = {
      slug, cfg,
      updatedAt: Date.now(),
      syncedAt: existing ? existing.syncedAt : null,
    };
    await reqToPromise(tx(db, 'projects', 'readwrite').put(record));
    return record;
  },

  async markProjectSynced(slug) {
    const db = await openDB();
    const existing = await reqToPromise(tx(db, 'projects', 'readonly').get(slug));
    if (!existing) return;
    existing.syncedAt = Date.now();
    await reqToPromise(tx(db, 'projects', 'readwrite').put(existing));
  },

  async deleteProject(slug) {
    const db = await openDB();
    await reqToPromise(tx(db, 'projects', 'readwrite').delete(slug));
  },

  async listAssets(slug) {
    const db = await openDB();
    return reqToPromise(tx(db, 'assets', 'readonly').index('slug').getAll(IDBKeyRange.only(slug)));
  },

  // kind: 'gravacao' | 'print' | 'narracao' | 'audioCena'
  // meta: dados extras do asset (ex.: { trim: false } para take com câmera).
  // Erros de cota viram mensagem legível em vez de falha silenciosa.
  async addAsset(slug, kind, filename, blob, meta) {
    askPersist();
    const db = await openDB();
    // sobrescreve um asset anterior de mesmo kind+filename (regravação de take).
    const existing = (await DB.listAssets(slug)).find((a) => a.kind === kind && a.filename === filename);
    if (existing) await reqToPromise(tx(db, 'assets', 'readwrite').delete(existing.id));
    const record = { slug, kind, filename, blob, meta: meta || null, synced: false, createdAt: Date.now() };
    try {
      const id = await reqToPromise(tx(db, 'assets', 'readwrite').add(record));
      return { ...record, id };
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e)))) {
        let detail = '';
        try {
          const est = await navigator.storage.estimate();
          detail = ` (usado ${(est.usage / 1048576).toFixed(0)}MB de ${(est.quota / 1048576).toFixed(0)}MB)`;
        } catch {}
        throw new Error('armazenamento do navegador cheio' + detail + ' — sincronize com o PC para liberar espaço');
      }
      throw e;
    }
  },

  async markAssetSynced(id) {
    const db = await openDB();
    const store = tx(db, 'assets', 'readwrite');
    const existing = await reqToPromise(store.get(id));
    if (!existing) return;
    existing.synced = true;
    await reqToPromise(store.put(existing));
  },

  async deleteAsset(id) {
    const db = await openDB();
    await reqToPromise(tx(db, 'assets', 'readwrite').delete(id));
  },
};

window.DB = DB;
