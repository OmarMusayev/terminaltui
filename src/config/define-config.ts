import { loadEnv } from "./env-loader.js";

// Eagerly load .env files so defineConfig() works at import time
let _envLoaded = false;
function ensureEnvLoaded(): void {
  if (_envLoaded) return;
  _envLoaded = true;
  try { loadEnv(); } catch { /* ignore if env loading fails */ }
}

/** A single config field definition. */
export interface ConfigField<T = string> {
  /** Environment variable name to read from. */
  env: string;
  /** Default value if env var is not set. */
  default?: T;
  /** If true, throws a helpful error when the env var is missing and no default. */
  required?: boolean;
  /** Transform the string env value to the desired type. */
  transform?: (value: string) => T;
}

/** Schema for defineConfig — maps keys to field definitions. */
export type ConfigSchema = Record<string, ConfigField<any>>;

/** Resolved config values based on schema. */
export type ConfigValues<S extends ConfigSchema> = {
  [K in keyof S]: S[K] extends ConfigField<infer T> ? T : string;
};

/** Config container with typed get(). */
export interface ConfigContainer<S extends ConfigSchema> {
  get<K extends keyof S>(key: K): ConfigValues<S>[K];
  getAll(): ConfigValues<S>;
}

/**
 * Define typed application config from environment variables.
 *
 * ```typescript
 * const config = defineConfig({
 *   apiUrl: { env: "API_URL", default: "https://api.example.com" },
 *   apiKey: { env: "API_KEY", required: true },
 *   debug: { env: "DEBUG", default: false, transform: v => v === "true" },
 * });
 * config.get("apiUrl") // typed as string
 * ```
 */
export function defineConfig<S extends ConfigSchema>(schema: S): ConfigContainer<S> {
  // Ensure .env files are loaded before reading env vars
  ensureEnvLoaded();

  const resolved: Record<string, any> = {};
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    const envValue = process.env[field.env];

    if (envValue !== undefined) {
      resolved[key] = field.transform ? field.transform(envValue) : envValue;
    } else if (field.default !== undefined) {
      resolved[key] = field.default;
    } else if (field.required) {
      errors.push(`Missing required environment variable: ${field.env} (config key: ${key})`);
    } else {
      resolved[key] = undefined;
    }
  }

  if (errors.length > 0) {
    throw new Error(`[terminaltui] Configuration errors:\n  ${errors.join("\n  ")}`);
  }

  return {
    get(key: any): any {
      return resolved[key as string];
    },
    getAll(): any {
      return { ...resolved };
    },
  };
}
