// Minimal WebSocket mock of the game server, for local/offline testing of the web client.
// It speaks the original frame format ([u16 len][i16 type][payload]) and answers a handful of
// message types with stub data. Reply payloads are guesses based on the client's parsers in
// MsgHandler, not captured server traffic.
//
// Usage: node server/mock-server.mjs [port]   (default 8080)
import { WebSocketServer } from 'ws';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const CG_LOGIN_PLAYERCHECK = 1;
const CG_LOGIN_ACTORLIST = 10001;
const CG_SYSTEM_HEART = 16001;

function frame(type, payload = Buffer.alloc(0)) {
  const out = Buffer.alloc(4 + payload.length);
  out.writeUInt16BE(out.length, 0);
  out.writeInt16BE(type, 2);
  payload.copy(out, 4);
  return out;
}

function* decode(state, chunk) {
  state.buf = Buffer.concat([state.buf, chunk]);
  while (state.buf.length >= 2) {
    const size = state.buf.readUInt16BE(0);
    if (size === 0xffff) {
      state.buf = state.buf.subarray(2);
      continue;
    }
    if (size < 4) throw new Error(`bad frame size ${size}`);
    if (state.buf.length < size) return;
    yield { type: state.buf.readInt16BE(2), payload: state.buf.subarray(4, size) };
    state.buf = state.buf.subarray(size);
  }
}

/** Returns reply frames for one request. */
export function handle(msg) {
  switch (msg.type) {
    case CG_SYSTEM_HEART:
      // The real reply format is unknown; echo an empty frame as an ack.
      return [frame(CG_SYSTEM_HEART)];
    case CG_LOGIN_PLAYERCHECK: {
      // Client reads: byte status (0 = ok, else error string follows).
      if (msg.payload.length < 18) return [frame(CG_LOGIN_PLAYERCHECK, errorPayload('Gói tin không hợp lệ'))];
      return [frame(CG_LOGIN_PLAYERCHECK, Buffer.from([0]))];
    }
    case CG_LOGIN_ACTORLIST:
      // processListPlayerMsg: byte count, then `count` players. Empty list keeps the stub honest.
      return [frame(CG_LOGIN_ACTORLIST, Buffer.from([0]))];
    default:
      return [frame(msg.type, errorPayload(`Mock chưa hỗ trợ type ${msg.type}`))];
  }
}

/** status byte -1 followed by a Java-style string (u24 length + UTF-16BE). */
function errorPayload(text) {
  const b = Buffer.alloc(1 + 3 + text.length * 2);
  b.writeInt8(-1, 0);
  b.writeUIntBE(text.length, 1, 3);
  for (let i = 0; i < text.length; i++) b.writeUInt16BE(text.charCodeAt(i), 4 + i * 2);
  return b;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wss = new WebSocketServer({ port: PORT });
  wss.on('connection', (ws, req) => {
    const state = { buf: Buffer.alloc(0) };
    console.log(`[mock] client connected ${req.socket.remoteAddress}`);
    ws.on('message', (data) => {
      try {
        for (const msg of decode(state, Buffer.from(data))) {
          console.log(`[mock] ← type=${msg.type} len=${msg.payload.length}`);
          for (const out of handle(msg)) ws.send(out);
        }
      } catch (e) {
        console.error('[mock]', e.message);
        ws.close();
      }
    });
    ws.on('close', () => console.log('[mock] client disconnected'));
  });
  console.log(`[mock] listening on ws://localhost:${PORT}`);
}
