let dbPromise = null;

function getOpenDB() {
  if (!window.idb?.openDB) {
    throw new Error("Unable to initialize IndexedDB helper (openDB).");
  }
  return window.idb.openDB;
}

/**
 * @returns {Promise<IDBDatabase>}
 */
export function getDb() {
  if (!dbPromise) {
    const openDB = getOpenDB();
    dbPromise = openDB("catcha-kanban", 1, {
      upgrade(db) {
        db.createObjectStore("boards", { keyPath: "id" });

        const taskStore = db.createObjectStore("tasks", { keyPath: "id" });
        taskStore.createIndex("by-board", "boardId");
        taskStore.createIndex("by-board-column", ["boardId", "columnId"]);

        const manifestStore = db.createObjectStore("manifest", {
          keyPath: "key",
        });
        manifestStore.createIndex("by-timestamp", "updatedAt");
        manifestStore.createIndex("by-entity-type", "entityType");
      },
    });
  }
  return dbPromise;
}
