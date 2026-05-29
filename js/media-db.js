/* IndexedDB — хранилище медиафайлов (фото, видео) */
const MediaDB = (() => {
  const DB_NAME    = 'BargutMedia';
  const STORE_NAME = 'blobs';
  let dbPromise    = null;

  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        req.onsuccess  = (e) => resolve(e.target.result);
        req.onerror    = (e) => reject(e.target.error);
      });
    }
    return dbPromise;
  }

  async function save(blob, type) {
    const db = await openDB();
    const id = 'M' + Date.now() + Math.random().toString(36).slice(2, 6);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id, blob, type });
      tx.oncomplete = () => resolve(id);
      tx.onerror    = (e) => reject(e.target.error);
    });
  }

  async function load(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  return { save, load };
})();

window.MediaDB = MediaDB;
