/**
 * Reference image persistence via IndexedDB.
 * Stores reference images used in the editor so they survive page navigation.
 */

const DB_NAME = "kinolu_refs";
const DB_VERSION = 1;
const STORE = "references";

export interface RefEntry {
  id: string;
  name: string;
  blob: Blob;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a reference image */
export async function saveRefImage(name: string, blob: Blob): Promise<RefEntry> {
  const db = await openDB();
  const entry: RefEntry = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    blob,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

/** List all saved reference images (metadata + blob) */
export async function listRefImages(): Promise<RefEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = (req.result as RefEntry[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete a saved reference image */
export async function deleteRefImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Clear all saved references */
export async function clearAllRefImages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
