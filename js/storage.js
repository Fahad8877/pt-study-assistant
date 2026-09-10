/* Lecture persistence in localStorage (prototype-level storage). */
(function () {
  const KEY = "pt.lectures";
  const LAST = "pt.lastLecture";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn("Storage full or unavailable", e);
      return false;
    }
  }

  function all() {
    return load().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function get(id) {
    return load().find((l) => l.id === id) || null;
  }

  function upsert(lecture) {
    const list = load();
    const i = list.findIndex((l) => l.id === lecture.id);
    lecture.updatedAt = Date.now();
    if (i >= 0) list[i] = lecture; else list.push(lecture);
    save(list);
    return lecture;
  }

  function remove(id) {
    save(load().filter((l) => l.id !== id));
    if (getLastId() === id) {
      try { localStorage.removeItem(LAST); } catch (e) { /* ignore */ }
    }
  }

  function setLastId(id) {
    try { localStorage.setItem(LAST, id); } catch (e) { /* ignore */ }
  }

  function getLastId() {
    try { return localStorage.getItem(LAST); } catch (e) { return null; }
  }

  function newId() {
    return "lec_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  window.Store = { all, get, upsert, remove, setLastId, getLastId, newId };

  /* ---------- page / slide images (IndexedDB; too large for localStorage) ---------- */
  const DB = "pt-study-assistant";
  const STORE_IMG = "images";
  const memory = new Map();

  function openDb() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE_IMG); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  function tx(db, mode, fn) {
    return new Promise((resolve) => {
      const t = db.transaction(STORE_IMG, mode);
      const req = fn(t.objectStore(STORE_IMG));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  }

  window.Images = {
    /** images: [{ slide, kind, dataUrl }] */
    async put(lectureId, images) {
      memory.set(lectureId, images);
      const db = await openDb();
      if (db) await tx(db, "readwrite", (s) => s.put(images, lectureId));
    },
    async get(lectureId) {
      if (memory.has(lectureId)) return memory.get(lectureId);
      const db = await openDb();
      const v = db ? await tx(db, "readonly", (s) => s.get(lectureId)) : null;
      if (v) memory.set(lectureId, v);
      return v || [];
    },
    async remove(lectureId) {
      memory.delete(lectureId);
      const db = await openDb();
      if (db) await tx(db, "readwrite", (s) => s.delete(lectureId));
    },
  };
})();
