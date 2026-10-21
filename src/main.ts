import { GameLoop } from './engine/GameLoop';
import { initGameResources } from './game/main/GameResources';
import { Graphics } from './midp/Graphics';
import { ImageStore, loadManifest } from './midp/ImageStore';
import { InputState } from './midp/Input';
import { SocketClient } from './net/SocketClient';
import { SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './scenes/Scene';
import { SplashScene } from './scenes/SplashScene';

// Never default to the official servers: this client is for local/offline study only.
const DEFAULT_WS = 'ws://localhost:8080';

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx2d = canvas.getContext('2d', { alpha: false });
  if (!ctx2d) throw new Error('Canvas 2D not supported');

  // Integer scaling when it fits keeps pixel art sharp; fall back to fractional on small screens.
  const fit = () => {
    const s = Math.min(window.innerWidth / SCREEN_WIDTH, window.innerHeight / SCREEN_HEIGHT);
    const scale = s >= 1 ? Math.floor(s) : s;
    canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  const toLogical = (cx: number, cy: number): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.floor(((cx - r.left) * SCREEN_WIDTH) / r.width),
      Math.floor(((cy - r.top) * SCREEN_HEIGHT) / r.height),
    ];
  };

  const g = new Graphics(ctx2d, SCREEN_WIDTH, SCREEN_HEIGHT);
  const input = new InputState(canvas, toLogical);
  const wsUrl = new URLSearchParams(location.search).get('ws') ?? DEFAULT_WS;

  const manifest = await loadManifest();
  await initGameResources(manifest);

  let scene: Scene;
  const context: Context = {
    images: new ImageStore(),
    manifest,
    net: new SocketClient(),
    wsUrl,
    go: (next) => {
      scene = next;
    },
  };
  scene = new SplashScene(context);

  new GameLoop(
    () => {
      input.beginTick();
      scene.update(input);
    },
    () => {
      g.setClip(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      scene.paint(g);
    },
  ).start();
}

boot().catch((e) => {
  document.body.textContent = `Lỗi khởi động: ${e instanceof Error ? e.message : String(e)}`;
  document.body.style.color = '#fff';
});
