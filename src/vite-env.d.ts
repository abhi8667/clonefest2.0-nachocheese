/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Host (no protocol) of the WebSocket relay, e.g. "crypton.onrender.com".
   * Only set for builds served from a host that cannot proxy a WS upgrade
   * (Vercel). Unset elsewhere, where the relay is same-origin.
   */
  readonly VITE_WS_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
