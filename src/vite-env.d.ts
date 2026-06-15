/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated market ids to surface in the UI (from OFFPEAK_MARKETS). */
  readonly VITE_OFFPEAK_MARKETS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
