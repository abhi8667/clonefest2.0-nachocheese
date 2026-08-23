/**
 * CipherDrop Sovereign Backend Server
 * Express REST API + WebSocket Blind Relay for Real-Time E2EE Incident Rooms
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/incident-room' });

const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Serve built frontend if dist directory exists
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', apiLimiter);

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

/**
 * POST /api/paste - Create a new encrypted paste
 */
app.post('/api/paste', (req, res) => {
  try {
    const {
      payload,
      expireInSeconds = 86400,
      burnAfterReading = false,
      maxViews = -1,
      openDiscussion = false,
    } = req.body;

    if (!payload || !payload.ct || !payload.iv) {
      return res.status(400).json({ error: 'Invalid encrypted payload. Ciphertext and IV are required.' });
    }

    // Generate random 16-character hexadecimal ID & deletion token
    const pasteId = crypto.randomBytes(8).toString('hex');
    const deleteToken = crypto.randomBytes(16).toString('hex');

    const result = storage.createPaste(pasteId, payload, {
      expireInSeconds: Number(expireInSeconds),
      burnAfterReading: Boolean(burnAfterReading),
      maxViews: Number(maxViews),
      openDiscussion: Boolean(openDiscussion),
      deleteToken,
    });

    res.status(201).json({
      id: result.id,
      deleteToken: result.deleteToken,
      expireAt: result.expireAt,
      status: 'created',
    });
  } catch (err) {
    console.error('[API Error /paste]', err);
    res.status(500).json({ error: 'Internal server error while saving paste.' });
  }
});

/**
 * GET /api/paste/:id - Read encrypted paste
 */
app.get('/api/paste/:id', (req, res) => {
  try {
    const { id } = req.params;
    const paste = storage.getPaste(id);

    if (!paste) {
      return res.status(404).json({ error: 'Secret not found, expired, or already burned.' });
    }

    res.json(paste);
  } catch (err) {
    console.error('[API Error GET /paste/:id]', err);
    res.status(500).json({ error: 'Internal server error while retrieving paste.' });
  }
});

/**
 * DELETE /api/paste/:id - Manually burn a paste with deleteToken
 */
app.delete('/api/paste/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { deleteToken } = req.body;

    if (!deleteToken) {
      return res.status(400).json({ error: 'Deletion token is required.' });
    }

    const deleted = storage.deletePaste(id, deleteToken);
    if (!deleted) {
      return res.status(403).json({ error: 'Invalid deletion token or secret already burned.' });
    }

    res.json({ status: 'destroyed', message: 'Secret has been permanently destroyed.' });
  } catch (err) {
    console.error('[API Error DELETE /paste/:id]', err);
    res.status(500).json({ error: 'Internal server error while deleting paste.' });
  }
});

/**
 * POST /api/paste/:id/comment - Post encrypted comment
 */
app.post('/api/paste/:id/comment', (req, res) => {
  try {
    const { id: pasteId } = req.params;
    const { parentId, payload } = req.body;

    if (!payload || !payload.ct || !payload.iv) {
      return res.status(400).json({ error: 'Invalid comment payload.' });
    }

    const commentId = crypto.randomBytes(8).toString('hex');
    const result = storage.addComment(commentId, pasteId, parentId, payload);

    res.status(201).json(result);
  } catch (err) {
    console.error('[API Error /comment]', err);
    res.status(400).json({ error: err.message || 'Error posting comment.' });
  }
});

/**
 * POST /api/request-drop - Create an Inbound Request-a-Secret Drop Link
 */
app.post('/api/request-drop', (req, res) => {
  try {
    const { prompt, publicKey, expireInSeconds = 86400 } = req.body;

    if (!prompt || !publicKey) {
      return res.status(400).json({ error: 'Prompt and Public Key are required to initiate an inbound drop.' });
    }

    const dropId = crypto.randomBytes(8).toString('hex');
    const drop = storage.createInboundDrop(dropId, prompt, publicKey, Number(expireInSeconds));

    res.status(201).json(drop);
  } catch (err) {
    console.error('[API Error /request-drop]', err);
    res.status(500).json({ error: 'Error generating inbound drop.' });
  }
});

/**
 * GET /api/request-drop/:id - Retrieve Inbound Drop info
 */
app.get('/api/request-drop/:id', (req, res) => {
  try {
    const { id } = req.params;
    const drop = storage.getInboundDrop(id);

    if (!drop) {
      return res.status(404).json({ error: 'Inbound drop not found or expired.' });
    }

    res.json(drop);
  } catch (err) {
    console.error('[API Error GET /request-drop/:id]', err);
    res.status(500).json({ error: 'Error fetching inbound drop.' });
  }
});

/**
 * POST /api/request-drop/:id/submit - Submitter posts encrypted secret
 */
app.post('/api/request-drop/:id/submit', (req, res) => {
  try {
    const { id } = req.params;
    const { encryptedPayload } = req.body;

    if (!encryptedPayload || !encryptedPayload.ct || !encryptedPayload.encryptedKey) {
      return res.status(400).json({ error: 'Valid hybrid encrypted payload is required.' });
    }

    const result = storage.submitInboundDrop(id, encryptedPayload);
    res.json(result);
  } catch (err) {
    console.error('[API Error /request-drop/:id/submit]', err);
    res.status(400).json({ error: err.message || 'Error submitting secret to drop.' });
  }
});

/**
 * GET /api/stats & GET /api/health
 */
app.get('/api/stats', (req, res) => {
  res.json(storage.getStats());
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    engine: 'CipherDrop v2.0-ZeroKnowledge',
  });
});

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

      // Emergency Nuke Room command
      if (parsed.type === 'nuke-room') {
        const nukeMsg = JSON.stringify({ type: 'room-nuked', reason: 'Emergency zeroize triggered by a peer.' });
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
setInterval(() => {
  try {
    storage.sweepExpired();
  } catch (err) {
    console.error('[Janitor Error]', err);
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`\n🚀 =================================================`);
  console.log(`   CipherDrop Sovereign Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket Blind Relay active at ws://localhost:${PORT}/ws/incident-room`);
  console.log(`   Zero-Knowledge Mode: ACTIVE (Server never receives keys)`);
  console.log(`=================================================\n`);
});
