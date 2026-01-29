/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_API_KEY: string;
  readonly API_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly NEXT_PUBLIC_API_KEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}