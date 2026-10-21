import type { Graphics } from '../midp/Graphics';
import type { ImageStore, AssetManifest } from '../midp/ImageStore';
import type { InputState } from '../midp/Input';
import type { SocketClient } from '../net/SocketClient';

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 480;

export interface Context {
  images: ImageStore;
  manifest: AssetManifest | null;
  net: SocketClient;
  wsUrl: string;
  go(scene: Scene): void;
}

export interface Scene {
  update(input: InputState): void;
  paint(g: Graphics): void;
}

// Shared palette loosely matching the original UI (dark panels, gold titles).
export const COLOR_BG = 0x10141c;
export const COLOR_PANEL = 0x1d2433;
export const COLOR_BORDER = 0x6b5a33;
export const COLOR_TITLE = 0xf2c75c;
export const COLOR_TEXT = 0xe6e6e6;
export const COLOR_DIM = 0x8a93a6;
export const COLOR_SELECT = 0x3a4f7a;
