/**
 * CipherDrop Sovereign Backend Server
 * Express REST API + WebSocket Blind Relay for Real-Time E2EE Incident Rooms
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from './app.js';
import { storage } from './storage.js';

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/incident-room' });

const PORT = process.env.PORT || 3001;

// ----------------------------------------------------
// WEBSOCKET BLIND RELAY FOR REAL-TIME INCIDENT ROOMS
// ----------------------------------------------------

// In-memory room manager (Rooms store ZERO plaintext - only encrypted frames)
const activeRooms = new Map(); // roomId -> Set<WebSocket>

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomId = url.searchParams.get('room');

  if (!roomId) {
    ws.close(1008, 'Room ID is required');
    return;
  }

  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, new Set());
  }

  const room = activeRooms.get(roomId);
  room.add(ws);

  // Broadcast peer count
  const broadcastPeerCount = () => {
    const countMsg = JSON.stringify({ type: 'presence', count: room.size });
    for (const client of room) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(countMsg);
      }
    }
  };

  broadcastPeerCount();

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());

      // Emergency Nuke Room command (Eradicates server-side paste ciphertext if attached, plus memory zeroize broadcast)
      if (parsed.type === 'nuke-room') {
        if (parsed.pasteId) {
          try {
            storage.deletePaste(parsed.pasteId);
          } catch (_) {}
        }
        const nukeMsg = JSON.stringify({ type: 'room-nuked', reason: 'Emergency zeroize triggered by a peer. All buffers purged.' });
        for (const client of room) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(nukeMsg);
            client.close(1000, 'Room destroyed');
          }
        }
        activeRooms.delete(roomId);
        return;
      }

      // Blind relay of encrypted frames (editor updates, chat messages)
      for (const client of room) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      }
    } catch (err) {
      console.warn('[WS Parse Warn]', err.message);
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    if (room.size === 0) {
      activeRooms.delete(roomId);
    } else {
      broadcastPeerCount();
    }
  });
});

// ----------------------------------------------------
// JANITOR BACKGROUND WORKER (Runs every 30 seconds)
// ----------------------------------------------------
const janitorInterval = setInterval(() => {
  try {
    storage.sweepExpired();
  } catch (err) {
    console.error('[Janitor Error]', err);
  }
}, 30000);
janitorInterval.unref();

if (!process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 =================================================`);
    console.log(`   CipherDrop Sovereign Server running on http://127.0.0.1:${PORT}`);
    console.log(`   WebSocket Blind Relay active at ws://127.0.0.1:${PORT}/ws/incident-room`);
    console.log(`   Zero-Knowledge Mode: ACTIVE (Server never receives keys)`);
    console.log(`=================================================\n`);
  });
}

// Graceful shutdown: stop accepting new connections, close the WS relay,
// and let in-flight requests finish before exiting.
function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  clearInterval(janitorInterval);
  wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  server.close(() => process.exit(0));
  // Force-exit if connections don't close within 5s.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
