function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export async function getSessionValue(key: string) {
  return storage()?.getItem(key) ?? null;
}

export async function setSessionValue(key: string, value: string) {
  storage()?.setItem(key, value);
}

export async function deleteSessionValue(key: string) {
  storage()?.removeItem(key);
}
