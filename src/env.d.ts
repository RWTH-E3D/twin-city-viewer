/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_FEATURES: string;
  readonly VITE_BACKEND_PROCESSES: string;
  readonly VITE_BACKEND_DOCU: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}