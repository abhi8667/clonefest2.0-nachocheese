import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  Users, 
  Lock, 
  Unlock, 
  Send, 
  Copy, 
  Check, 
  ShieldAlert, 
  Radio, 
  AlertTriangle, 
  Sparkles,
  Terminal,
  Trash2
} from 'lucide-react';
import { generateMasterKey, encryptSecret, decryptSecret } from '../crypto/webcrypto';
import { FeatureHighlights } from './FeatureHighlights';

interface IncidentWarRoomProps {
  initialRoomId?: string;
  initialRoomKey?: string;
}

export const IncidentWarRoom: React.FC<IncidentWarRoomProps> = ({ 
  initialRoomId, 
  initialRoomKey 
}) => {
  const [roomId, setRoomId] = useState<string>(initialRoomId || '');
  const [roomKey, setRoomKey] = useState<string>(initialRoomKey || '');
  const [inRoom, setInRoom] = useState<boolean>(Boolean(initialRoomId && initialRoomKey));

  // War Room Live State
  const [peerCount, setPeerCount] = useState<number>(1);
  const [padText, setPadText] = useState<string>(
    '# EPHEMERAL INCIDENT WAR ROOM\n- Incident ID: INC-8492\n- Status: ROTATING COMPROMISED AWS CREDENTIALS\n- Zero-Knowledge Live Relay: ACTIVE'
  );
  const [chatMessages, setChatMessages] = useState<{ author: string; text: string; time: string }[]>([]);
  const [myAlias, setMyAlias] = useState<string>(`SecOp-${Math.floor(100 + Math.random() * 900)}`);
  const [chatInput, setChatInput] = useState<string>('');
  const [isNuked, setIsNuked] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Initialize or Join Room
  const handleCreateOrJoin = (customId?: string, customKey?: string) => {
    const rId = customId || roomId.trim() || Math.random().toString(36).substring(2, 10);
    const rKey = customKey || roomKey.trim() || generateMasterKey();

    setRoomId(rId);
    setRoomKey(rKey);
    setInRoom(true);

    window.location.hash = `warroom=${rId}&key=${rKey}`;
  };

  // WebSocket Connection
  useEffect(() => {
    if (!inRoom || !roomId || !roomKey) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/incident-room?room=${roomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔒 [WarRoom] WebSocket connected');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'presence') {
          setPeerCount(data.count);
          return;
        }

        if (data.type === 'room-nuked') {
          setIsNuked(true);
          setPadText('');
          setChatMessages([]);
          return;
        }

        // Decrypt incoming message or pad update with roomKey
        if (data.type === 'pad-update' && data.payload) {
          const dec = await decryptSecret(data.payload, roomKey);
          setPadText(dec.text);
        } else if (data.type === 'chat' && data.payload) {
          const dec = await decryptSecret(data.payload, roomKey);
          setChatMessages(prev => [
            ...prev,
            {
              author: dec.language || 'Peer',
              text: dec.text,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }
      } catch (err) {
        console.warn('Decryption frame warning:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [inRoom, roomId, roomKey]);

  // Broadcast Pad Updates
  const handlePadChange = async (newText: string) => {
    setPadText(newText);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const encrypted = await encryptSecret(
        { text: newText, formatter: 'markdown' },
        roomKey
      );
      wsRef.current.send(JSON.stringify({ type: 'pad-update', payload: encrypted }));
    } catch (_) {}
  };

  // Broadcast Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const messageText = chatInput.trim();
    setChatInput('');

    // Add locally
    setChatMessages(prev => [
      ...prev,
      { author: myAlias, text: messageText, time: new Date().toLocaleTimeString() }
    ]);

    try {
      const encrypted = await encryptSecret(
        { text: messageText, formatter: 'plaintext', language: myAlias },
        roomKey
      );
      wsRef.current.send(JSON.stringify({ type: 'chat', payload: encrypted }));
    } catch (_) {}
  };

  // Emergency Nuke Room
  const handleEmergencyNuke = () => {
    if (confirm('🚨 EMERGENCY NUKE: Are you sure you want to permanently erase and terminate this War Room across all connected peers?')) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'nuke-room' }));
      }
      setIsNuked(true);
      setPadText('');
      setChatMessages([]);
    }
  };

  const warRoomShareUrl = `${window.location.origin}/#warroom=${roomId}&key=${roomKey}`;

  // ----------------------------------------------------
  // NUKED STATE
  // ----------------------------------------------------
  if (isNuked) {
    return (
      <div className="max-w-md mx-auto p-8 glass-panel rounded-3xl border border-rose-500/30 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Flame className="w-8 h-8 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100">War Room Nuked & Zeroized</h2>
          <p className="text-xs text-slate-400">
            Emergency zeroization was triggered. All peer buffers and live pad states have been wiped from memory.
          </p>
        </div>
        <button
          onClick={() => {
            setIsNuked(false);
            setInRoom(false);
            setRoomId('');
            setRoomKey('');
            window.location.hash = '';
          }}
          className="btn-cyber-primary px-6 py-2 rounded-xl text-xs font-semibold"
        >
          Create New Incident Room
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // JOIN / CREATE ROOM VIEW
  // ----------------------------------------------------
  if (!inRoom) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Real-Time E2EE Incident War Room</h2>
              <p className="text-xs text-slate-400 font-mono">Live Ephemeral Scratchpad & Secure Relay</p>
            </div>
          </div>

          <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/5 space-y-2 text-xs">
            <h4 className="font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-400" /> Live Synchronized E2EE Channel
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Designed for DevOps and security teams managing live outages, credential rotations, or critical incident responses. Zero server logging with instant one-click emergency room purging.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleCreateOrJoin()}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Instant War Room</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full"></div>
              <span className="bg-obsidian-900 px-3 text-[10px] font-mono text-slate-500 uppercase">or join existing</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID..."
                className="w-1/2 glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-200"
              />
              <input
                type="text"
                value={roomKey}
                onChange={(e) => setRoomKey(e.target.value)}
                placeholder="Enter Room Decryption Key..."
                className="w-1/2 glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-200"
              />
            </div>

            <button
              onClick={() => handleCreateOrJoin(roomId, roomKey)}
              disabled={!roomId.trim() || !roomKey.trim()}
              className="w-full py-2.5 rounded-xl bg-obsidian-900 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 disabled:opacity-50 transition-colors"
            >
              Join War Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ACTIVE WAR ROOM VIEW
  // ----------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Banner */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-obsidian-900 to-obsidian-900 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 font-mono">INCIDENT ROOM #{roomId}</h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Users className="w-3 h-3" /> {peerCount} Peer{peerCount > 1 ? 's' : ''} Online
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">E2EE WebSockets Relay • Blind Relay Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(warRoomShareUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="btn-cyber-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link' : 'Invite Peers'}</span>
          </button>

          <button
            onClick={handleEmergencyNuke}
            className="btn-cyber-danger flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold"
            title="Purge room state across all connected peers immediately"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Nuke & Burn</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Collaborative Pad + Encrypted Live Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Shared Pad (2 cols) */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl">
          <div className="px-6 py-3 bg-obsidian-950 border-b border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="text-emerald-400 font-bold uppercase">Shared Incident Scratchpad</span>
            <span>Syncs live with peers</span>
          </div>
          <textarea
            value={padText}
            onChange={(e) => handlePadChange(e.target.value)}
            placeholder="Type confidential incident notes or keys here..."
            rows={18}
            className="w-full flex-1 p-6 bg-obsidian-950/60 font-mono text-xs text-emerald-200 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Live E2EE Chat (1 col) */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 flex flex-col h-[520px] shadow-2xl">
          <div className="px-4 py-3 bg-obsidian-950 border-b border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="text-slate-200 font-bold uppercase">E2EE War Log</span>
            <input
              type="text"
              value={myAlias}
              onChange={(e) => setMyAlias(e.target.value)}
              className="w-24 bg-obsidian-900 border border-white/10 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono focus:outline-none text-right"
              title="Change your alias"
            />
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic text-center pt-8">
                No chat messages yet. All chatter is encrypted in real-time before transit.
              </p>
            ) : (
              chatMessages.map((m, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-obsidian-950 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-emerald-400">{m.author}</span>
                    <span className="text-slate-500">{m.time}</span>
                  </div>
                  <p className="text-slate-200 break-words">{m.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendChat} className="p-3 bg-obsidian-950 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send E2EE message..."
              className="flex-1 glass-input px-3 py-2 rounded-xl text-xs text-slate-200 font-mono"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="btn-cyber-primary p-2 rounded-xl text-xs disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>

      <FeatureHighlights
        title="War Room Security"
        cards={[
          { icon: <Radio className="w-5 h-5" />, title: 'Blind WebSocket Relay', description: 'Server relays only encrypted frames. Zero plaintext is stored or logged at any point.' },
          { icon: <ShieldAlert className="w-5 h-5" />, title: 'Emergency Nuke', description: 'One-click broadcast signal that instantly zeroizes all peer memory and destroys the room.' },
          { icon: <Users className="w-5 h-5" />, title: 'Live Peer Presence', description: 'Real-time connected participant counter with automatic cleanup on disconnect.' },
          { icon: <Lock className="w-5 h-5" />, title: 'Zero Server Storage', description: 'All room state exists purely in-memory. No persistence, no logs, no forensic artifacts.' },
        ]}
      />

    </div>
  );
};
