import { getDb } from "./database.js";

/**
 * Record a change in the manifest. If a transaction is provided,
 * the write happens within that transaction (for atomicity with data writes).
 *
 * @param {string} entityType - "board" | "task"
 * @param {string} entityId
 * @param {string} changeType - "created" | "modified" | "deleted"
 * @param {IDBTransaction} [tx] - optional existing transaction
 */
export async function recordChange(entityType, entityId, changeType, tx) {
  const key = `${entityType}:${entityId}`;
  const entry = {
    key,
    entityType,
    entityId,
    changeType,
    updatedAt: new Date().toISOString(),
  };

  if (tx) {
    tx.objectStore("manifest").put(entry);
  } else {
    const db = await getDb();
    await db.put("manifest", entry);
  }
}

/**
 * @returns {Promise<Array>}
 */
export async function getManifest() {
  const db = await getDb();
  return db.getAll("manifest");
}

/**
 * Get all manifest entries with updatedAt after the given timestamp.
 * @param {string} timestamp - ISO 8601
 * @returns {Promise<Array>}
 */
export async function getChangesSince(timestamp) {
  const db = await getDb();
  const range = IDBKeyRange.lowerBound(timestamp, true);
  return db.getAllFromIndex("manifest", "by-timestamp", range);
}

/**
 * Remove tombstones for the given entity keys.
 * Called after remote sync confirms deletion acknowledgment.
 * @param {string[]} keys - manifest keys to purge (e.g. ["task:task-123"])
 */
export async function purgeTombstones(keys) {
  const db = await getDb();
  const tx = db.transaction("manifest", "readwrite");

  for (const key of keys) {
    const entry = await tx.store.get(key);
    if (entry && entry.changeType === "deleted") {
      tx.store.delete(key);
    }
  }

  await tx.done;
}
