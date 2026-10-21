/**
 * Lazy image cache for files under public/assets (same relative paths as the APK's assets/ dir).
 * Like MIDP code that polls for loaded resources, get() never blocks: it returns null until ready.
 */
export class ImageStore {
  private cache = new Map<string, HTMLImageElement | null>();
  private failed = new Set<string>();

  constructor(private readonly base = `${import.meta.env.BASE_URL}assets/`) {}

  get(path: string): HTMLImageElement | null {
    const key = path.replace(/^\/+/, '');
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    this.cache.set(key, null);
    const img = new Image();
    img.onload = () => this.cache.set(key, img);
    img.onerror = () => this.failed.add(key);
    img.src = this.base + key;
    return null;
  }

  async load(path: string): Promise<HTMLImageElement> {
    const key = path.replace(/^\/+/, '');
    const img = new Image();
    img.src = this.base + key;
    await img.decode();
    this.cache.set(key, img);
    return img;
  }

  isMissing(path: string): boolean {
    return this.failed.has(path.replace(/^\/+/, ''));
  }
}

export interface AssetManifest {
  /** Relative paths of every imported file, grouped by directory. */
  dirs: Record<string, string[]>;
}

export async function loadManifest(): Promise<AssetManifest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/manifest.json`);
    if (!res.ok) return null;
    return (await res.json()) as AssetManifest;
  } catch {
    return null;
  }
}
