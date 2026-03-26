let openDBPromise = null;
let dbPromise = null;

function getOpenDB() {
  if (!openDBPromise) {
    openDBPromise = (async () => {
      if (window.idb?.openDB) {
        return window.idb.openDB;
      }

      const idbModule = await import("https://unpkg.com/idb@8?module");
      if (idbModule?.openDB) {
        return idbModule.openDB;
      }

      throw new Error("Unable to initialize IndexedDB helper (openDB).");
    })();
  }

  return openDBPromise;
}

/**
 * @returns {Promise<IDBDatabase>}
 */
export function getDb() {
  if (!dbPromise) {
    dbPromise = getOpenDB().then((openDB) =>
      openDB("catcha-kanban", 1, {
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
      }),
    );
  }
  return dbPromise;
}
