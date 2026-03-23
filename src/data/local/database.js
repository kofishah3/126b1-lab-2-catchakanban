const { openDB } = window.idb;

let dbPromise = null;

/**
 * @returns {Promise<IDBDatabase>}
 */
export function getDb() {
  if (!dbPromise) {
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
