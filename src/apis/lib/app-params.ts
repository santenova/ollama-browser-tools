const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
export const localStorage = windowObj.localStorage;

export const token = "_token_";

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `aiorreal_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
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
	if (storedValue) {
		return storedValue;
	}
	return null;
}

export const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		localStorage.removeItem('aiorreal_access_token');
		localStorage.removeItem('token');
	}
    const c = {
      appId: getAppParamValue("app_id", {
        defaultValue: undefined,
      }),
      appPrefix: getAppParamValue("app_prefix", {
        defaultValue:  undefined,
      }),
      token: getAppParamValue("access_token", {
        removeFromUrl: true,
      }),
      fromUrl: getAppParamValue("from_url", {
        defaultValue: undefined,
      }),
      functionsVersion: getAppParamValue("functions_version", {
        defaultValue: undefined,
      }),
      appBaseUrl: getAppParamValue("app_base_url", {
        defaultValue: undefined,
      }),
    };
    return c;
}


export const appId ="prompthub-App-Id";
export const functionsVersion = null;


export const appParams = {
	...getAppParams()
}
