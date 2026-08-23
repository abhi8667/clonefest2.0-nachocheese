import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Flame, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { hashSha256 } from '../crypto/webcrypto';
import { TerminalWindow } from './TerminalWindow';

interface CreatorAdminModalProps {
  pasteId: string;
  adminToken: string;
  onClose: () => void;
}

interface SlotStatus {
  slotId: string;
  label: string;
  burned: boolean;
  readAt: number | null;
  burnOnRead: boolean;
}

interface AdminData {
  id: string;
  isMultiRecipient: boolean;
  expireAt: number;
  burnAfterReading: boolean;
  createdAt: number;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
  envelopes: SlotStatus[];
}

export const CreatorAdminModal: React.FC<CreatorAdminModalProps> = ({
  pasteId,
  adminToken,
  onClose,
}) => {
  const [data, setData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSlotId, setRevokingSlotId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tokenHash = await hashSha256(adminToken);
      const res = await fetch(`/api/paste/${pasteId}/admin?tokenHash=${encodeURIComponent(tokenHash)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to retrieve admin telemetry.');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching admin telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [pasteId, adminToken]);

  const handleRevokeSlot = async (slotId: string, label: string) => {
    if (!confirm(`Are you sure you want to revoke access for "${label}"? Their key envelope will be permanently deleted from the server.`)) {
      return;
    }

    try {
      setRevokingSlotId(slotId);
      setActionMessage(null);
      const tokenHash = await hashSha256(adminToken);

      const res = await fetch(`/api/paste/${pasteId}/slot/${slotId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to revoke slot.');

      setActionMessage(`Access revoked for "${label}".`);
      if (json.allBurned) {
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        await fetchStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Error revoking slot.');
    } finally {
      setRevokingSlotId(null);
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'Not yet viewed';
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl">
      <TerminalWindow path="anonymous@cipherdrop — admin" glow>
      <div className="relative text-slate-100 space-y-6 p-6 sm:p-8">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-bold text-slate-100 flex items-center gap-2">
                Creator Admin Dashboard
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Telemetry
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Paste ID: <span className="text-emerald-300">{pasteId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-2 rounded-xl bg-obsidian-900 border border-white/10 text-slate-300 hover:text-emerald-400 hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action / Error Banner */}
        {actionMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {isLoading && !data ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 rounded-xl border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
            <p className="text-xs text-slate-400 font-mono">Validating admin token...</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            
            {/* Overview Metric Cards */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-3 bg-obsidian-950 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">Total Envelopes</span>
                <span className="text-sm font-bold text-slate-200">{data.envelopes.length}</span>
              </div>
              <div className="p-3 bg-obsidian-950 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">Read</span>
                <span className="text-sm font-bold text-emerald-400">
                  {data.envelopes.filter(e => e.readAt !== null).length}
                </span>
              </div>
              <div className="p-3 bg-obsidian-950 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">Pending</span>
                <span className="text-sm font-bold text-amber-400">
                  {data.envelopes.filter(e => e.readAt === null && !e.burned).length}
                </span>
              </div>
            </div>

            {/* Time-Lock Status Alert */}
            {data.timeLockEnabled && data.unlockAt && (
              <div className="p-3 bg-amber-950/20 rounded-xl border border-amber-500/30 text-xs font-mono flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Time-Locked until: <strong>{new Date(data.unlockAt).toUTCString()}</strong></span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {new Date(data.unlockAt).getTime() > Date.now() ? '🔒 Locked' : '🔓 Unlocked'}
                </span>
              </div>
            )}

            {/* Recipient Slots Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Recipient Envelopes Status
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {data.envelopes.map((slot) => (
                  <div
                    key={slot.slotId}
                    className="p-3 bg-obsidian-950 rounded-xl border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{slot.label}</span>
                        {slot.burnOnRead && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Burn on Read
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Viewed: {formatTimestamp(slot.readAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {slot.burned ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Burned
                        </span>
                      ) : slot.readAt ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Read
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          Pending
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRevokeSlot(slot.slotId, slot.label)}
                        disabled={revokingSlotId === slot.slotId}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                        title="Revoke Recipient Access"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <p className="text-[11px] text-slate-500">
            Revoking a slot removes the encrypted key envelope. Other recipients are unaffected.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-obsidian-900 hover:bg-white/5 border border-white/10 text-slate-300 font-semibold"
          >
            Close Dashboard
          </button>
        </div>

      </div>
      </TerminalWindow>
      </div>
    </div>
  );
};
