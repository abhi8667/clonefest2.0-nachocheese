import React, { useState, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Download, 
  UploadCloud, 
  Lock, 
  Unlock, 
  Sparkles, 
  Check, 
  Copy, 
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { 
  generateMasterKey, 
  encryptSecret, 
  decryptSecret 
} from '../crypto/webcrypto';
import { 
  embedPayloadInImage, 
  extractPayloadFromImage, 
  generateProceduralCarrierImage 
} from '../crypto/steganography';
import { DecryptedSecret } from '../types';
import { FeatureHighlights } from './FeatureHighlights';
import { TerminalWindow } from './TerminalWindow';

export const StegoTool: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'embed' | 'extract'>('embed');

  // Embed Mode State
  const [embedText, setEmbedText] = useState<string>('AWS_SECRET_KEY=9a8d7f6b5c4e3d2a10928374\nSTRIPE_KEY=sk_live_prod_super_secret');
  const [carrierImageSrc, setCarrierImageSrc] = useState<string | null>(null);
  const [isProcessingEmbed, setIsProcessingEmbed] = useState<boolean>(false);
  const [embedResultBlobUrl, setEmbedResultBlobUrl] = useState<string | null>(null);
  const [embedResultKey, setEmbedResultKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  // Extract Mode State
  const [extractImageSrc, setExtractImageSrc] = useState<string | null>(null);
  const [extractKey, setExtractKey] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedSecret, setExtractedSecret] = useState<DecryptedSecret | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const embedFileInputRef = useRef<HTMLInputElement>(null);
  const extractFileInputRef = useRef<HTMLInputElement>(null);

  // Handle Embed Image Upload
  const handleEmbedFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCarrierImageSrc(reader.result as string);
      setEmbedError(null);
    };
    reader.readAsDataURL(file);
  };

  // Generate Procedural Carrier
  const handleGenerateProceduralCarrier = () => {
    const canvas = generateProceduralCarrierImage(500, 500);
    setCarrierImageSrc(canvas.toDataURL('image/png'));
  };

  // Perform Embed Operation
  const handleEmbedSecret = async () => {
    if (!embedText.trim()) {
      setEmbedError('Please enter the secret text to embed.');
      return;
    }

    try {
      setIsProcessingEmbed(true);
      setEmbedError(null);

      // 1. Generate master key & encrypt payload
      const masterKey = generateMasterKey();
      const payload: DecryptedSecret = {
        text: embedText.trim(),
        formatter: 'env',
      };
      const encrypted = await encryptSecret(payload, masterKey);
      const encryptedJson = JSON.stringify(encrypted);

      // 2. Prepare carrier image
      let imgElement: HTMLImageElement;
      if (carrierImageSrc) {
        imgElement = new Image();
        imgElement.src = carrierImageSrc;
        await new Promise(r => { imgElement.onload = r; });
      } else {
        const canvas = generateProceduralCarrierImage(500, 500);
        imgElement = new Image();
        imgElement.src = canvas.toDataURL('image/png');
        await new Promise(r => { imgElement.onload = r; });
      }

      // 3. Inject into image pixels
      const outputBlob = await embedPayloadInImage(imgElement, encryptedJson);
      const blobUrl = URL.createObjectURL(outputBlob);

      setEmbedResultBlobUrl(blobUrl);
      setEmbedResultKey(masterKey);

    } catch (err: any) {
      setEmbedError(err.message || 'Error embedding secret.');
    } finally {
      setIsProcessingEmbed(false);
    }
  };

  // Handle Extract Image Upload
  const handleExtractFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setExtractImageSrc(reader.result as string);
      setExtractError(null);
      setExtractedSecret(null);
    };
    reader.readAsDataURL(file);
  };

  // Perform Extract Operation
  const handleExtractSecret = async () => {
    if (!extractImageSrc || !extractKey.trim()) {
      setExtractError('Please provide both the Carrier PNG and the Decryption Key.');
      return;
    }

    try {
      setIsExtracting(true);
      setExtractError(null);

      const img = new Image();
      img.src = extractImageSrc;
      await new Promise(r => { img.onload = r; });

      // 1. Extract ciphertext string from LSB
      const extractedJson = await extractPayloadFromImage(img);
      const encryptedPayload = JSON.parse(extractedJson);

      // 2. Decrypt with master key
      const decrypted = await decryptSecret(encryptedPayload, extractKey.trim());
      setExtractedSecret(decrypted);

    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract secret. Ensure the image is an unmodified Carrier PNG and the key is correct.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Intro Header */}
      <TerminalWindow path="anonymous@cipherdrop — stego" glow>
      <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-slate-100 flex items-center gap-2">
              Steganography Disguise Carrier
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Deep Packet Inspection Bypass
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Disguise AES-256-GCM encrypted payloads inside ordinary PNG photos using Least Significant Bit (LSB) encoding.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-obsidian-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveSubTab('embed')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'embed' ? 'bg-emerald-500 text-obsidian-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Disguise / Embed
          </button>
          <button
            onClick={() => setActiveSubTab('extract')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'extract' ? 'bg-emerald-500 text-obsidian-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Reveal / Extract
          </button>
        </div>
      </div>
      </TerminalWindow>

      {/* EMBED MODE */}
      {activeSubTab === 'embed' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Input secret & image */}
          <TerminalWindow path="anonymous@cipherdrop — stego/embed" stagger={1}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Confidential Secret to Hide
              </label>
              <textarea
                value={embedText}
                onChange={(e) => setEmbedText(e.target.value)}
                placeholder="Enter sensitive keys, passwords, or code snippets…"
                rows={5}
                className="w-full glass-input p-3 rounded-xl text-xs font-mono text-emerald-200 resize-none focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-300 uppercase">
                Carrier Image
              </label>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => embedFileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl bg-obsidian-900 hover:bg-white/5 border border-white/10 text-xs font-mono text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload PNG</span>
                </button>
                <input
                  type="file"
                  accept="image/png"
                  ref={embedFileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleEmbedFileChange(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleGenerateProceduralCarrier}
                  className="py-2 px-3 rounded-xl bg-obsidian-900 hover:bg-white/5 border border-white/10 text-xs font-mono text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto Generate</span>
                </button>
              </div>

              {carrierImageSrc && (
                <div className="p-2 bg-obsidian-950 rounded-xl border border-white/5 flex items-center gap-3">
                  <img src={carrierImageSrc} alt="Carrier" className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                  <span className="text-xs font-mono text-emerald-400">Carrier Image Loaded</span>
                </div>
              )}
            </div>

            {embedError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{embedError}</span>
              </div>
            )}

            <button
              onClick={handleEmbedSecret}
              disabled={isProcessingEmbed}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isProcessingEmbed ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Encoding LSB Pixels...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Encrypt & Disguise into PNG</span>
                </>
              )}
            </button>
          </div>
          </TerminalWindow>

          {/* Right: Output Result */}
          <TerminalWindow path="anonymous@cipherdrop — stego/output" stagger={2} className="flex flex-col h-full">
          <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
            {embedResultBlobUrl ? (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <span className="inline-block p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <FileCheck className="w-6 h-6" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-100">Disguised Carrier Generated</h3>
                  <p className="text-xs text-slate-400">
                    The secret is mathematically hidden in the pixel values.
                  </p>
                </div>

                <div className="p-2 bg-obsidian-950 rounded-2xl border border-emerald-500/20 text-center">
                  <img
                    src={embedResultBlobUrl}
                    alt="Encoded Output"
                    className="max-h-48 mx-auto rounded-xl border border-white/10 shadow-lg"
                  />
                </div>

                {/* Master Decryption Key */}
                <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-emerald-400">Master Decryption Key</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-200 truncate">{embedResultKey}</span>
                    <button
                      onClick={async () => {
                        if (embedResultKey) {
                          await navigator.clipboard.writeText(embedResultKey);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }
                      }}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <a
                  href={embedResultBlobUrl}
                  download="carrier_secret.png"
                  className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Carrier PNG</span>
                </a>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-500">
                <ImageIcon className="w-12 h-12 text-slate-600" />
                <h4 className="text-xs font-mono font-semibold text-slate-400">Awaiting Encryption</h4>
                <p className="text-xs max-w-xs">
                  Fill in your secret and click "Encrypt & Disguise" to generate a carrier image.
                </p>
              </div>
            )}
          </div>
          </TerminalWindow>

        </div>
      ) : (
        /* EXTRACT MODE */
        <div className="max-w-xl mx-auto">
        <TerminalWindow path="anonymous@cipherdrop — stego/extract">
        <div className="p-6 sm:p-8 space-y-6">

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Upload Carrier PNG
              </label>
              <div
                onClick={() => extractFileInputRef.current?.click()}
                className="p-6 border border-dashed border-white/20 rounded-2xl bg-obsidian-950 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
              >
                {extractImageSrc ? (
                  <div className="flex items-center justify-center gap-3">
                    <img src={extractImageSrc} alt="Extract Target" className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                    <span className="text-xs font-mono text-emerald-400">Carrier Image Selected</span>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <UploadCloud className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs">Click or drag & drop Carrier PNG here</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/png"
                ref={extractFileInputRef}
                onChange={(e) => e.target.files?.[0] && handleExtractFileChange(e.target.files[0])}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Decryption Key
              </label>
              <input
                type="text"
                value={extractKey}
                onChange={(e) => setExtractKey(e.target.value)}
                placeholder="Enter Base58 Master Key…"
                className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-emerald-200 focus:outline-none"
              />
            </div>

            {extractError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{extractError}</span>
              </div>
            )}

            <button
              onClick={handleExtractSecret}
              disabled={isExtracting || !extractImageSrc || !extractKey.trim()}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Extracting & Decrypting...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Extract & Decrypt Payload</span>
                </>
              )}
            </button>
          </div>

          {extractedSecret && (
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
              <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Decrypted Secret Payload
              </span>
              <pre className="font-mono text-xs text-emerald-200 p-3 bg-obsidian-950 rounded-xl overflow-x-auto selection:bg-emerald-500/40">
                <code>{extractedSecret.text}</code>
              </pre>
            </div>
          )}

        </div>
        </TerminalWindow>
        </div>
      )}

      <FeatureHighlights
        title="Steganography Capabilities"
        cards={[
          { icon: <ImageIcon className="w-5 h-5" />, title: 'Bypasses DPI Firewalls', description: 'Credentials travel disguised as innocent PNG images past Deep Packet Inspection systems.' },
          { icon: <Lock className="w-5 h-5" />, title: 'LSB Pixel Injection', description: 'Encrypted payloads are embedded in the Least Significant Bits of pixel color channels.' },
          { icon: <FileCheck className="w-5 h-5" />, title: 'Visually Identical', description: 'Output images are perceptually indistinguishable from the original carrier image.' },
          { icon: <Sparkles className="w-5 h-5" />, title: 'Client-Side Only', description: 'All encoding and decoding happens in browser memory. No server involvement whatsoever.' },
        ]}
      />

    </div>
  );
};
