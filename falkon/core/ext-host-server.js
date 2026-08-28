/**
 * Falkon IDE — Node.js Extension Host Server
 *
 * This sidecar process runs in Node.js, providing full Node.js environment
 * access (fs, child_process, net, path, etc.) for VS Code extensions.
 *
 * It listens on WebSocket / HTTP port 9889 and routes extension host protocol messages
 * between the extension runtime and the WebView frontend.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const PORT = parseInt(process.env.PORT || '9889', 10);
const HOST = '127.0.0.1';
const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeWebSocketFrame(data) {
  const isBuffer = Buffer.isBuffer(data);
  const payload = isBuffer ? data : Buffer.from(String(data), 'utf8');
  const payloadLength = payload.length;

  let header;
  if (payloadLength < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode (or 0x82 if binary)
    if (isBuffer) header[0] = 0x82;
    header[1] = payloadLength;
  } else if (payloadLength < 65536) {
    header = Buffer.alloc(4);
    header[0] = isBuffer ? 0x82 : 0x81;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = isBuffer ? 0x82 : 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) === 0x80;
  let payloadLength = secondByte & 0x7f;
  let currentOffset = 2;

  if (payloadLength === 126) {
    if (buffer.length < currentOffset + 2) return null;
    payloadLength = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < currentOffset + 8) return null;
    payloadLength = Number(buffer.readBigUInt64BE(currentOffset));
    currentOffset += 8;
  }

  let maskingKey = null;
  if (isMasked) {
    if (buffer.length < currentOffset + 4) return null;
    maskingKey = buffer.slice(currentOffset, currentOffset + 4);
    currentOffset += 4;
  }

  if (buffer.length < currentOffset + payloadLength) return null;

  const payload = buffer.slice(currentOffset, currentOffset + payloadLength);
  const totalFrameSize = currentOffset + payloadLength;

  let unmaskedData = Buffer.alloc(payloadLength);
  if (isMasked && maskingKey) {
    for (let i = 0; i < payloadLength; i++) {
      unmaskedData[i] = payload[i] ^ maskingKey[i % 4];
    }
  } else {
    unmaskedData = payload;
  }

  return {
    opcode,
    data: unmaskedData,
    frameLength: totalFrameSize,
  };
}

class ExtensionHostBridge extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.activeExtensions = new Map();
  }

  handleConnection(req, socket, head) {
    const secKey = req.headers['sec-websocket-key'];
    if (!secKey) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(secKey + WS_MAGIC_STRING)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ];

    socket.write(headers.join('\r\n'));
    this.clients.add(socket);
    console.log(`[ExtHost] Client connected (${this.clients.size} total)`);

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length > 0) {
        const frame = decodeWebSocketFrame(buffer);
        if (!frame) break;

        buffer = buffer.slice(frame.frameLength);

        if (frame.opcode === 0x8) {
          // Close frame
          socket.end();
          break;
        } else if (frame.opcode === 0x9) {
          // Ping frame -> reply with Pong (opcode 0xA)
          const pongHeader = Buffer.from([0x8a, 0x00]);
          socket.write(pongHeader);
        } else if (frame.opcode === 0x1 || frame.opcode === 0x2) {
          // Text / binary frame
          const str = frame.data.toString('utf8');
          this.processMessage(socket, str);
        }
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      console.log(`[ExtHost] Client disconnected (${this.clients.size} remaining)`);
    });

    socket.on('error', (err) => {
      console.error('[ExtHost] Socket error:', err.message);
      this.clients.delete(socket);
    });
  }

  processMessage(socket, raw) {
    if (raw.includes('"type":"ping"')) {
      const pong = JSON.stringify({ type: 'pong', timestamp: Date.now() });
      socket.write(encodeWebSocketFrame(pong));
      return;
    }

    if (raw.includes('"type":"ext-host-init"')) {
      console.log('[ExtHost] Received initialization payload');
      const ack = JSON.stringify({ type: 'ext-host-initialized', status: 'ok' });
      socket.write(encodeWebSocketFrame(ack));
      return;
    }
  }

  sendToAll(data) {
    const frame = encodeWebSocketFrame(typeof data === 'string' ? data : JSON.stringify(data));
    for (const client of this.clients) {
      try {
        client.write(frame);
      } catch (_) {}
    }
  }
}

const bridge = new ExtensionHostBridge();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pid: process.pid, port: PORT }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Falkon Extension Host Sidecar Server');
});

server.on('upgrade', (req, socket, head) => {
  bridge.handleConnection(req, socket, head);
});

server.listen(PORT, HOST, () => {
  console.log(`[ExtHost] Server listening on http://${HOST}:${PORT}`);
  console.log('EXT_HOST_READY');
});

process.on('uncaughtException', (err) => {
  console.error('[ExtHost] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ExtHost] Unhandled Rejection:', reason);
});
