type StorageKind = 'local' | 'session';

const getStorage = (kind: StorageKind): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export const browserStorage = {
  getItem(key: string, kind: StorageKind = 'local') {
    return getStorage(kind)?.getItem(key) ?? null;
  },
  setItem(key: string, value: string, kind: StorageKind = 'local') {
    getStorage(kind)?.setItem(key, value);
  },
  removeItem(key: string, kind: StorageKind = 'local') {
    getStorage(kind)?.removeItem(key);
  },
};

export const getLocationOrigin = () => (isBrowser() ? window.location.origin : null);

export const navigateBrowser = (url: string, replace = false) => {
  if (!isBrowser()) {
    return false;
  }

  if (replace) {
    window.location.replace(url);
  } else {
    window.location.assign(url);
  }
  return true;
};

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    || Boolean(target.closest('[contenteditable="true"]'))
  );
};
