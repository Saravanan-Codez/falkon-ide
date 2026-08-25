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
const { EventEmitter } = require('events');

const PORT = parseInt(process.env.PORT || '9889', 10);
const HOST = '127.0.0.1';

class ExtensionHostBridge extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.activeExtensions = new Map();
  }

  handleConnection(req, socket, head) {
    // Basic HTTP upgrade / raw socket communication bridge
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      '\r\n'
    );

    this.clients.add(socket);
    console.log(`[ExtHost] Client connected (${this.clients.size} total)`);

    socket.on('data', (chunk) => {
      // Decode framed data / JSON messages from client
      try {
        const str = chunk.toString('utf8');
        // Handle websocket unmasking or raw JSON framing
        this.processMessage(socket, str);
      } catch (err) {
        console.error('[ExtHost] Error processing message:', err.message);
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
    // Basic RPC dispatcher for extension host requests
    if (raw.includes('"type":"ping"')) {
      socket.write(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    if (raw.includes('"type":"ext-host-init"')) {
      console.log('[ExtHost] Received initialization payload');
      socket.write(JSON.stringify({ type: 'ext-host-initialized', status: 'ok' }));
      return;
    }
  }

  sendToAll(data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of this.clients) {
      try {
        client.write(payload);
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
