// Port of com.hz.map.MapLayer.
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import type { GameMap } from './GameMap';

export const LAYER_BLOCK = 1;
export const LAYER_TILE = 2;
export const LAYER_PIXEL = 3;
export const LAYER_PLAYER = 4;
export const LAYER_ANIM = 5;

export abstract class MapLayer {
  constructor(
    readonly type: number,
    readonly map: GameMap,
  ) {}

  abstract draw(g: Graphics, ox: number, oy: number, w: number, h: number, withTop: boolean): void;
  abstract fromBytes(dis: DataInputStream): void;
}
