// WebSocket → TCP bridge: lets the browser client talk to a TCP game server of the user's own (for
// example the local Python backend, which listens on 127.0.0.1:30100). Bytes are passed through
// unchanged in both directions; the client's FrameDecoder already handles frames split across or
// packed into WebSocket messages. One TCP connection per WebSocket.
//
// Usage: node server/ws-tcp-bridge.mjs [wsPort] [tcpHost] [tcpPort]   (default 8081 127.0.0.1 30100)
// Only connect it to servers you run yourself.
import net from 'node:net';
import { WebSocketServer } from 'ws';

const WS_PORT = Number(process.argv[2] ?? process.env.BRIDGE_PORT ?? 8081);
const TCP_HOST = process.argv[3] ?? process.env.BE_HOST ?? '127.0.0.1';
const TCP_PORT = Number(process.argv[4] ?? process.env.BE_PORT ?? 30100);

/** Pipes one WebSocket to a new TCP connection; returns the socket for tests. */
export function bridge(ws, host = TCP_HOST, port = TCP_PORT) {
  const tcp = net.connect({ host, port });
  const pending = [];
  let open = false;
  tcp.on('connect', () => {
    open = true;
    for (const b of pending.splice(0)) tcp.write(b);
  });
  tcp.on('data', (b) => ws.readyState === ws.OPEN && ws.send(b));
  tcp.on('close', () => ws.close());
  tcp.on('error', (e) => {
    console.error(`[bridge] tcp ${host}:${port}: ${e.message}`);
    ws.close();
  });
  ws.on('message', (data) => {
    const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (open) tcp.write(b);
    else pending.push(b);
  });
  ws.on('close', () => tcp.destroy());
  return tcp;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wss = new WebSocketServer({ port: WS_PORT });
  wss.on('connection', (ws) => bridge(ws));
  console.log(`[bridge] ws://localhost:${WS_PORT} → tcp ${TCP_HOST}:${TCP_PORT}`);
}
