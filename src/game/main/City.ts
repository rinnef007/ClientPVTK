// City.doEnterCity of client 1.2.0 (jadx decompile): 10510 takes the player into a city and the reply
// builds the new map like a map jump. The rest of City (city info 10511, the city menu, the city
// mission shortcut of "Dò đường") is not ported, so nothing in the web UI calls this yet.
import * as GameWorld from './GameWorld';
import { online } from '../../net/online/Online';
import { createJumpCityMsg, readJumpCity } from '../../net/online/MapMessages';

export function doEnterCity(masterId: number): boolean {
  const s = online.session;
  if (s == null) return false;
  return GameWorld.changeMapWith(async () => readJumpCity(await s.request(createJumpCityMsg(masterId))));
}
