const hasArtifactStorage =
  typeof window !== "undefined" &&
  window.storage &&
  typeof window.storage.get === "function";

const LS_PREFIX = "mdt:";

async function lsGet(key) {
  const raw = localStorage.getItem(LS_PREFIX + key);
  if (raw === null) throw new Error("not found");
  return { key, value: raw, shared: false };
}

async function lsSet(key, value) {
  localStorage.setItem(LS_PREFIX + key, value);
  return { key, value, shared: false };
}

async function lsDelete(key) {
  localStorage.removeItem(LS_PREFIX + key);
  return { key, deleted: true, shared: false };
}

export const storage = hasArtifactStorage
  ? {
      get: (key, shared = false) => window.storage.get(key, shared),
      set: (key, value, shared = false) => window.storage.set(key, value, shared),
      delete: (key, shared = false) => window.storage.delete(key, shared),
    }
  : {
      get: lsGet,
      set: lsSet,
      delete: lsDelete,
    };
