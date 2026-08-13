import * as SecureStore from "expo-secure-store";

export function getSessionValue(key: string) {
  return SecureStore.getItemAsync(key);
}

export function setSessionValue(key: string, value: string) {
  return SecureStore.setItemAsync(key, value);
}

export function deleteSessionValue(key: string) {
  return SecureStore.deleteItemAsync(key);
}
