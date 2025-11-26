import { AppState } from '../store/useAppStore';

const STORAGE_KEY = 'webchord_state';

export function saveStateToLocalStorage(state: Partial<AppState>): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    console.log('💾 State saved to localStorage');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

export function loadStateFromLocalStorage(): Partial<AppState> | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return null;
    }
    console.log('📂 State loaded from localStorage');
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

export function exportStateAsJSON(state: Partial<AppState>): string {
  return JSON.stringify(state, null, 2);
}

export function importStateFromJSON(json: string): Partial<AppState> | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

export function encodeStateToURL(state: Partial<AppState>): string {
  const json = JSON.stringify(state);
  const encoded = btoa(json);
  return `${window.location.origin}${window.location.pathname}?state=${encoded}`;
}

export function decodeStateFromURL(): Partial<AppState> | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('state');
    if (!encoded) return null;
    
    const json = atob(encoded);
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode state from URL:', error);
    return null;
  }
}

