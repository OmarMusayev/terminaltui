import type { ContentBlock } from "../config/types.js";
import type { RouteParams } from "../routing/types.js";

/** Application context passed to lifecycle hooks. */
export interface AppContext {
  state: any; // StateContainer — typed as any to avoid circular deps
  navigate: (pageId: string, params?: RouteParams) => void;
}

/** Error context for onError hook. */
export interface ErrorContext {
  page?: string;
  params?: RouteParams;
  phase: "render" | "middleware" | "action" | "fetch";
}

/** Lifecycle hooks for the site. */
export interface LifecycleHooks {
  onInit?: (app: AppContext) => Promise<void> | void;
  onExit?: (app: AppContext) => Promise<void> | void;
  onNavigate?: (from: string, to: string, params?: RouteParams) => void;
  onError?: (error: Error, context: ErrorContext) => ContentBlock[] | void;
}
