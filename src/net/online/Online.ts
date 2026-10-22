// The backend connection while the world runs online (set by MapScene), so the screens that talk to
// the server (missions, shop) can send requests instead of using the local simulation.
import type { MoveSync } from './MoveSync';
import type { OnlineSession } from './OnlineSession';

export const online: { session: OnlineSession | null; moveSync: MoveSync | null } = { session: null, moveSync: null };

export function isOnline(): boolean {
  return online.session != null;
}
