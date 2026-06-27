/**
 * Returns the Ollama base endpoint.
 * Priority: 1) stored ollama_endpoints[0] in localStorage
 *           2) /proxy on localhost
 *           3) hardcoded ngrok fallback
 */
export const getOllamaEndpoint = () => {
  try {
    const stored = localStorage.getItem('ollama_endpoints');
    if (stored) {
      const endpoints = JSON.parse(stored);
      if (Array.isArray(endpoints) && endpoints[0]) return endpoints[0];
    }
  } catch {}

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
    return '/proxy';
  }
  return 'https://christy-ramentaceous-verbatim.ngrok-free.dev';
};