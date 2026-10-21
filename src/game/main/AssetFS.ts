import type { AssetManifest } from '../../midp/ImageStore';

/**
 * Web stand-in for Utilities.getResourceAsStream(): the Java code reads assets synchronously,
 * so files are fetched ahead of time with preload() and then served from memory by get().
 * Existence is decided by the asset manifest, so missing files never cost a request.
 */
export class AssetFS {
  private files = new Map<string, Uint8Array>();
  private known = new Set<string>();

  constructor(
    manifest: AssetManifest | null,
    private readonly fetcher: (path: string) => Promise<Uint8Array | null> = defaultFetch,
  ) {
    for (const [dir, names] of Object.entries(manifest?.dirs ?? {})) {
      for (const n of names) this.known.add(normalize(dir === '.' ? n : `${dir}/${n}`));
    }
  }

  exists(path: string): boolean {
    return this.known.has(normalize(path));
  }

  /** Bytes of an already-preloaded file, or null (Utilities.getFileByte). */
  get(path: string): Uint8Array | null {
    return this.files.get(normalize(path)) ?? null;
  }

  /** Puts bytes directly (tests, generated data). */
  put(path: string, data: Uint8Array): void {
    const p = normalize(path);
    this.known.add(p);
    this.files.set(p, data);
  }

  /** Fetches every listed file that exists and is not cached yet. */
  async preload(paths: string[]): Promise<void> {
    const todo = [...new Set(paths.map(normalize))].filter((p) => this.known.has(p) && !this.files.has(p));
    await Promise.all(
      todo.map(async (p) => {
        const data = await this.fetcher(p);
        if (data) this.files.set(p, data);
      }),
    );
  }
}

function normalize(p: string): string {
  return p.replace(/^\/+/, '');
}

async function defaultFetch(path: string): Promise<Uint8Array | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}assets/${path}`);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}
