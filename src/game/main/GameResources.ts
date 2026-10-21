// Web-only boot step standing in for the resource part of GameCanvas initialisation:
// fetches the shared packs that the Java code reads synchronously, then builds the id lists.
import type { AssetManifest } from '../../midp/ImageStore';
import { setAssetFS } from '../common/Utilities';
import { AssetFS } from './AssetFS';
import * as ResourceHandler from './ResourceHandler';

export async function initGameResources(manifest: AssetManifest | null): Promise<AssetFS> {
  const fs = new AssetFS(manifest);
  setAssetFS(fs);
  await fs.preload(['ani/3.pd', 'ani/3.pn', 'map/1.pd', 'map/1.pn']);
  ResourceHandler.loadAllIDList();
  ResourceHandler.loadMapPackData();
  return fs;
}
