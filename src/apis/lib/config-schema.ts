/**
 * Configuration Schema Validation (Improvement #1)
 * Validates createClient config before use.
 */

export interface ClientConfig {
  serverUrl: string;
  appId: string;
  functionsVersion?: string;
  headers: Record<string, string>;
  model: string;
  ollamaEndpoints: string[];
  messages?: Array<{ role: string; content: string }>;
}

export function validateClientConfig(config: Partial<ClientConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.serverUrl || typeof config.serverUrl !== 'string') errors.push('serverUrl is required and must be a string');
  if (!config.appId || typeof config.appId !== 'string') errors.push('appId is required and must be a string');
  if (!config.model || typeof config.model !== 'string') errors.push('model is required and must be a string');
  if (!Array.isArray(config.ollamaEndpoints) || config.ollamaEndpoints.length === 0) errors.push('ollamaEndpoints must be a non-empty array');
  if (config.headers && typeof config.headers !== 'object') errors.push('headers must be an object');

  return { valid: errors.length === 0, errors };
}