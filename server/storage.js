/**
 * CipherDrop Blind Storage & Persistence Engine
 * Zero-Knowledge Key-Value & Relational Store (SQLite with in-memory fallback)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'cipherdrop.db');

export class StorageEngine {
  constructor() {
    this._timeOffset = 0; // For deterministic time testing
    try {
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.isMemory = false;
      console.log('⚡ [Storage] SQLite WAL database initialized at', DB_PATH);
    } catch (err) {
      console.warn('⚠️ [Storage] Could not initialize file SQLite, falling back to in-memory store:', err.message);
      this.db = new Database(':memory:');
      this.isMemory = true;
    }

    this._initTables();
  }

  getCurrentTime() {
    return Math.floor(Date.now() / 1000) + this._timeOffset;
  }

  setTimeOffset(seconds) {
    this._timeOffset = Number(seconds) || 0;
  }

  resetTimeOffset() {
    this._timeOffset = 0;
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pastes (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expire_at INTEGER NOT NULL,
        burn_after_reading INTEGER DEFAULT 0,
        views_remaining INTEGER DEFAULT -1,
        open_discussion INTEGER DEFAULT 0,
        delete_token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_multi_recipient INTEGER DEFAULT 0,
        envelopes TEXT,
        admin_token_hash TEXT,
        time_lock_enabled INTEGER DEFAULT 0,
        unlock_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        paste_id TEXT NOT NULL,
        parent_id TEXT,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (paste_id) REFERENCES pastes (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS inbound_drops (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        public_key TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        encrypted_payload TEXT,
        expire_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Ensure backwards compatibility with any existing DB without recreating
    try { this.db.exec(`ALTER TABLE pastes ADD COLUMN is_multi_recipient INTEGER DEFAULT 0;`); } catch (_) {}
    try { this.db.exec(`ALTER TABLE pastes ADD COLUMN envelopes TEXT;`); } catch (_) {}
    try { this.db.exec(`ALTER TABLE pastes ADD COLUMN admin_token_hash TEXT;`); } catch (_) {}
    try { this.db.exec(`ALTER TABLE pastes ADD COLUMN time_lock_enabled INTEGER DEFAULT 0;`); } catch (_) {}
    try { this.db.exec(`ALTER TABLE pastes ADD COLUMN unlock_at INTEGER;`); } catch (_) {}

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pastes_expire ON pastes(expire_at);
      CREATE INDEX IF NOT EXISTS idx_pastes_unlock ON pastes(unlock_at);
      CREATE INDEX IF NOT EXISTS idx_comments_paste ON comments(paste_id);
      CREATE INDEX IF NOT EXISTS idx_drops_expire ON inbound_drops(expire_at);
    `);
  }

  /**
   * Store a new blind encrypted paste (Standard or Multi-Recipient)
   */
  createPaste(id, payload, options) {
    const {
      expireInSeconds = 86400,
      burnAfterReading = false,
      maxViews = -1,
      openDiscussion = false,
      deleteToken,
      isMultiRecipient = false,
      envelopes = null,
      adminTokenHash = null,
      timeLockEnabled = false,
      unlockAt = null,
    } = options;

    const now = this.getCurrentTime();
    const expireAt = expireInSeconds === 0 ? 2147483647 : now + expireInSeconds;
    const viewsRemaining = burnAfterReading ? 1 : maxViews;
    const isTimeLocked = Boolean(timeLockEnabled);
    const unlockTimestamp = isTimeLocked && unlockAt ? Number(unlockAt) : null;

    const stmt = this.db.prepare(`
      INSERT INTO pastes (
        id, payload, expire_at, burn_after_reading, views_remaining, open_discussion, delete_token, created_at,
        is_multi_recipient, envelopes, admin_token_hash, time_lock_enabled, unlock_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      expireAt,
      burnAfterReading ? 1 : 0,
      viewsRemaining,
      openDiscussion ? 1 : 0,
      deleteToken,
      now,
      isMultiRecipient ? 1 : 0,
      envelopes ? (typeof envelopes === 'string' ? envelopes : JSON.stringify(envelopes)) : null,
      adminTokenHash || null,
      isTimeLocked ? 1 : 0,
      unlockTimestamp
    );

    return {
      id,
      expireAt,
      deleteToken,
      timeLockEnabled: isTimeLocked,
      unlockAt: unlockTimestamp,
    };
  }

  /**
   * Read paste atomically. Decrements view count and burns if exhausted.
   * If slotId is provided on multi-recipient paste, updates/burns specific recipient envelope.
   * If time-locked and unlockAt is in the future, returns 423 Locked and does not reveal ciphertext or decrement views.
   */
  getPaste(id, slotId = null) {
    const now = this.getCurrentTime();

    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(`SELECT * FROM pastes WHERE id = ?`);
      const paste = stmt.get(id);

      if (!paste) return null;

      // Check time expiry (expired secrets are purged immediately)
      if (paste.expire_at <= now) {
        this.deletePaste(id);
        return null;
      }

      // Check Time-Lock enforcement gate (Server-Assisted Release)
      if (paste.time_lock_enabled === 1 && paste.unlock_at && paste.unlock_at > now) {
        return {
          locked: true,
          status: 423,
          error: 'TIME_LOCKED',
          timeLockEnabled: true,
          unlockAt: new Date(paste.unlock_at * 1000).toISOString(),
          expireAt: paste.expire_at,
        };
      }

      let shouldDelete = false;
      let remaining = paste.views_remaining;
      let envelopes = paste.envelopes ? JSON.parse(paste.envelopes) : [];
      let activeSlot = null;

      if (paste.is_multi_recipient === 1 && envelopes.length > 0) {
        if (slotId) {
          const slotIndex = envelopes.findIndex(e => e.slotId === slotId);
          if (slotIndex === -1) {
            return { error: 'Recipient slot revoked or does not exist.', status: 404 };
          }

          const slot = envelopes[slotIndex];
          if (slot.burned) {
            return {
              error: slot.revoked
                ? 'This recipient access link was revoked by the creator.'
                : 'This recipient secret was already burned after its first read.',
              status: 410,
            };
          }

          // Record read timestamp
          slot.readAt = slot.readAt || now;

          // Check if slot should burn on read
          if (slot.burnOnRead || paste.burn_after_reading === 1) {
            slot.burned = true;
          }

          activeSlot = { ...slot };
          envelopes[slotIndex] = slot;

          // Update database with updated slot state
          this.db.prepare(`UPDATE pastes SET envelopes = ? WHERE id = ?`).run(JSON.stringify(envelopes), id);

          // If all recipient slots have now burned, destroy the whole paste
          if (envelopes.every(e => e.burned)) {
            shouldDelete = true;
          }
        }
      } else {
        // Standard paste single-view / view-count decrement logic
        if (paste.burn_after_reading === 1 || remaining === 1) {
          shouldDelete = true;
        } else if (remaining > 1) {
          remaining -= 1;
          this.db.prepare(`UPDATE pastes SET views_remaining = ? WHERE id = ?`).run(remaining, id);
        }
      }

      if (shouldDelete) {
        this.deletePaste(id);
      }

      // Fetch comments if discussion is enabled
      let comments = [];
      if (paste.open_discussion === 1) {
        const commentsStmt = this.db.prepare(`
          SELECT id, parent_id, payload, created_at FROM comments WHERE paste_id = ? ORDER BY created_at ASC
        `);
        comments = commentsStmt.all(id).map(c => ({
          id: c.id,
          parentId: c.parent_id,
          payload: JSON.parse(c.payload),
          createdAt: c.created_at,
        }));
      }

      return {
        id: paste.id,
        isMultiRecipient: paste.is_multi_recipient === 1,
        payload: JSON.parse(paste.payload),
        envelopes: paste.is_multi_recipient === 1 ? envelopes : undefined,
        activeSlot: activeSlot || undefined,
        expireAt: paste.expire_at,
        burnAfterReading: paste.burn_after_reading === 1,
        viewsRemaining: remaining,
        openDiscussion: paste.open_discussion === 1,
        comments,
        wasBurned: shouldDelete,
        createdAt: paste.created_at,
        timeLockEnabled: paste.time_lock_enabled === 1,
        unlockAt: paste.unlock_at ? new Date(paste.unlock_at * 1000).toISOString() : null,
      };
    });

    return tx();
  }

  /**
   * Get Creator Admin Status & Telemetry
   */
  getAdminStatus(id, adminTokenHash) {
    const paste = this.db.prepare(`SELECT * FROM pastes WHERE id = ?`).get(id);
    if (!paste) return null;

    if (!paste.admin_token_hash || paste.admin_token_hash !== adminTokenHash) {
      return { error: 'Invalid or unauthorized admin token.', status: 403 };
    }

    const envelopes = paste.envelopes ? JSON.parse(paste.envelopes) : [];
    return {
      id: paste.id,
      isMultiRecipient: paste.is_multi_recipient === 1,
      expireAt: paste.expire_at,
      burnAfterReading: paste.burn_after_reading === 1,
      createdAt: paste.created_at,
      timeLockEnabled: paste.time_lock_enabled === 1,
      unlockAt: paste.unlock_at ? new Date(paste.unlock_at * 1000).toISOString() : null,
      envelopes: envelopes.map(e => ({
        slotId: e.slotId,
        label: e.label,
        burned: Boolean(e.burned),
        readAt: e.readAt || null,
        burnOnRead: Boolean(e.burnOnRead),
      })),
    };
  }

  /**
   * Revoke an individual recipient envelope slot
   */
  revokeSlot(id, slotId, adminTokenHash) {
    const paste = this.db.prepare(`SELECT * FROM pastes WHERE id = ?`).get(id);
    if (!paste) return null;

    if (!paste.admin_token_hash || paste.admin_token_hash !== adminTokenHash) {
      return { error: 'Invalid or unauthorized admin token.', status: 403 };
    }

    const envelopes = paste.envelopes ? JSON.parse(paste.envelopes) : [];
    const slotIndex = envelopes.findIndex(e => e.slotId === slotId);
    if (slotIndex === -1) {
      return { error: 'Slot not found or already removed.', status: 404 };
    }

    envelopes[slotIndex].burned = true;
    envelopes[slotIndex].revoked = true;

    // If all slots are now burned, delete the paste entirely
    const allBurned = envelopes.every(e => e.burned);
    if (allBurned) {
      this.deletePaste(id);
      return { success: true, message: 'All slots burned/revoked. Secret destroyed.', allBurned: true };
    }

    this.db.prepare(`UPDATE pastes SET envelopes = ? WHERE id = ?`).run(JSON.stringify(envelopes), id);
    return { success: true, message: 'Recipient slot successfully revoked.', allBurned: false };
  }


  /**
   * Delete paste and its associated comments
   */
  deletePaste(id, deleteToken) {
    if (deleteToken) {
      const stmt = this.db.prepare(`DELETE FROM pastes WHERE id = ? AND delete_token = ?`);
      const result = stmt.run(id, deleteToken);
      if (result.changes > 0) {
        this.db.prepare(`DELETE FROM comments WHERE paste_id = ?`).run(id);
        return true;
      }
      return false;
    }

    const stmt = this.db.prepare(`DELETE FROM pastes WHERE id = ?`);
    const result = stmt.run(id);
    this.db.prepare(`DELETE FROM comments WHERE paste_id = ?`).run(id);
    return result.changes > 0;
  }

  /**
   * Add zero-knowledge encrypted comment to a paste
   */
  addComment(id, pasteId, parentId, payload) {
    const paste = this.db.prepare(`SELECT open_discussion, expire_at FROM pastes WHERE id = ?`).get(pasteId);
    if (!paste) throw new Error('Paste does not exist');
    if (paste.open_discussion !== 1) throw new Error('Discussions are not enabled on this paste');

    const now = this.getCurrentTime();
    const stmt = this.db.prepare(`
      INSERT INTO comments (id, paste_id, parent_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      pasteId,
      parentId || null,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      now
    );

    return { id, pasteId, parentId, createdAt: now };
  }

  /**
   * Create an inbound Request-a-Secret drop link
   */
  createInboundDrop(id, prompt, publicKey, expireInSeconds = 86400) {
    const now = this.getCurrentTime();
    const expireAt = now + expireInSeconds;

    const stmt = this.db.prepare(`
      INSERT INTO inbound_drops (id, prompt, public_key, status, expire_at, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `);

    stmt.run(id, prompt, publicKey, expireAt, now);
    return { id, prompt, publicKey, expireAt };
  }

  /**
   * Get an inbound drop metadata
   */
  getInboundDrop(id) {
    const now = this.getCurrentTime();
    const drop = this.db.prepare(`SELECT * FROM inbound_drops WHERE id = ?`).get(id);

    if (!drop) return null;
    if (drop.expire_at <= now) {
      this.db.prepare(`DELETE FROM inbound_drops WHERE id = ?`).run(id);
      return null;
    }

    return {
      id: drop.id,
      prompt: drop.prompt,
      publicKey: drop.public_key,
      status: drop.status,
      encryptedPayload: drop.encrypted_payload ? JSON.parse(drop.encrypted_payload) : null,
      expireAt: drop.expire_at,
      createdAt: drop.created_at,
    };
  }

  /**
   * Submit encrypted response to an inbound drop
   */
  submitInboundDrop(id, encryptedPayload) {
    const drop = this.getInboundDrop(id);
    if (!drop) throw new Error('Inbound drop not found or expired');
    if (drop.status === 'completed') throw new Error('This drop request has already been fulfilled');

    const stmt = this.db.prepare(`
      UPDATE inbound_drops
      SET status = 'completed', encrypted_payload = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(encryptedPayload), id);
    return { id, status: 'completed' };
  }

  /**
   * Periodic Janitor: Sweep expired pastes and drops
   */
  sweepExpired() {
    const now = this.getCurrentTime();

    const expiredPastes = this.db.prepare(`SELECT id FROM pastes WHERE expire_at <= ?`).all(now);
    if (expiredPastes.length > 0) {
      const deletePasteStmt = this.db.prepare(`DELETE FROM pastes WHERE id = ?`);
      const deleteCommentsStmt = this.db.prepare(`DELETE FROM comments WHERE paste_id = ?`);
      
      const sweepTx = this.db.transaction((pastes) => {
        for (const p of pastes) {
          deletePasteStmt.run(p.id);
          deleteCommentsStmt.run(p.id);
        }
      });
      sweepTx(expiredPastes);
      console.log(`🧹 [Janitor] Purged ${expiredPastes.length} expired paste(s).`);
    }

    const expiredDrops = this.db.prepare(`DELETE FROM inbound_drops WHERE expire_at <= ?`).run(now);
    if (expiredDrops.changes > 0) {
      console.log(`🧹 [Janitor] Purged ${expiredDrops.changes} expired inbound drop(s).`);
    }
  }

  /**
   * Get server stats (blind counts, no contents)
   */
  getStats() {
    const pasteCount = this.db.prepare(`SELECT COUNT(*) as count FROM pastes`).get().count;
    const commentCount = this.db.prepare(`SELECT COUNT(*) as count FROM comments`).get().count;
    const dropCount = this.db.prepare(`SELECT COUNT(*) as count FROM inbound_drops`).get().count;
    return { pasteCount, commentCount, dropCount };
  }
}

export const storage = new StorageEngine();
