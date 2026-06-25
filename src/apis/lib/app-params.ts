const isNode = typeof window === 'undefined';

// In-memory fallback that mirrors the localStorage API exactly.
// Used in Node/SSR where window.localStorage does not exist.
const _memStore: Record<string, string> = {};
const _memLocalStorage = {
  getItem:    (key: string): string | null => _memStore[key] ?? null,
  setItem:    (key: string, value: string): void => { _memStore[key] = String(value); },
  removeItem: (key: string): void => { delete _memStore[key]; },
  clear:      (): void => { Object.keys(_memStore).forEach(k => delete _memStore[k]); },
};

export const localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> =
  isNode ? _memLocalStorage : window.localStorage;

export const token = "_token_";

// Derive storage prefix from appId: lowercase, no spaces, use underscores
export const appId = "prompthub-App-Id";
export const functionsVersion = null;

const toSnakeCase = (str: string): string =>
  str.replace(/([A-Z])/g, '_$1').toLowerCase();

// Derive prefix from appId: lowercase, replace hyphens/spaces with underscores, strip non-alphanumeric except underscore
const derivePrefix = (id: string): string =>
  id.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '') + '_';

export const APP_PREFIX = derivePrefix(appId);
// e.g. "prompthub_app_id_" → trimmed to just the app name portion
// We use only the first segment before any suffix like "-App-Id"
const appNameSegment = appId.split(/[-_]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
export const LS_PREFIX = appNameSegment + '_';
// e.g. "prompthub_"

const getAppParamValue = (paramName: string, { defaultValue = undefined as any, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue;

  const storageKey = `${LS_PREFIX}${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    localStorage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue) {
    localStorage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = localStorage.getItem(storageKey);
  if (storedValue) return storedValue;
  return null;
};

export const getAppParams = () => {
  if (getAppParamValue('clear_access_token') === 'true') {
    localStorage.removeItem(`${LS_PREFIX}access_token`);
    localStorage.removeItem('token');
  }
  return {
    appId:            getAppParamValue('app_id',            { defaultValue: undefined }),
    appPrefix:        getAppParamValue('app_prefix',        { defaultValue: undefined }),
    token:            getAppParamValue('access_token',      { removeFromUrl: true }),
    fromUrl:          getAppParamValue('from_url',          { defaultValue: undefined }),
    functionsVersion: getAppParamValue('functions_version', { defaultValue: undefined }),
    appBaseUrl:       getAppParamValue('app_base_url',      { defaultValue: undefined }),
  };
};

export const appParams = { ...getAppParams() };
export const appBaseUrl = appParams.appBaseUrl;