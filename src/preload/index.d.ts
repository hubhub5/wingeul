export {}

declare global {
  interface Window {
    wg: {
      call(name: string, args: unknown[]): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      onProgress(cb: (msg: string) => void): () => void
    }
  }
}
