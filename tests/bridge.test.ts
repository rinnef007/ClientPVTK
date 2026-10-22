import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
// @ts-expect-error plain JS module without types
import { bridge } from '../server/ws-tcp-bridge.mjs';

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

function listen<T extends net.Server | WebSocketServer>(s: T): Promise<number> {
  return new Promise((ok) => {
    if (s instanceof WebSocketServer) s.on('listening', () => ok((s.address() as net.AddressInfo).port));
    else (s as net.Server).listen(0, '127.0.0.1', () => ok(((s as net.Server).address() as net.AddressInfo).port));
  });
}

describe('ws-tcp-bridge', () => {
  it('passes bytes both ways unchanged, including data sent before TCP connects', async () => {
    const tcp = net.createServer((c) => c.on('data', (b) => c.write(Buffer.concat([Buffer.from([0xee]), b]))));
    const tcpPort = await listen(tcp);
    const wss = new WebSocketServer({ port: 0 });
    wss.on('connection', (ws) => bridge(ws, '127.0.0.1', tcpPort));
    const wsPort = await listen(wss);
    closers.push(() => tcp.close(), () => wss.close());

    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`);
    closers.push(() => ws.close());
    const got = new Promise<Buffer>((ok) => ws.on('message', (d) => ok(d as Buffer)));
    await new Promise((ok) => ws.on('open', ok));
    ws.send(Buffer.from([0, 4, 0x13, 0x88]));
    expect([...(await got)]).toEqual([0xee, 0, 4, 0x13, 0x88]);
  });
});
