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
  FileCheck,
  Fingerprint,
  Search,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { 
  generateMasterKey, 
  encryptSecret, 
  decryptSecret,
  extractWatermark,
  attributeWatermark
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
  const [activeSubTab, setActiveSubTab] = useState<'embed' | 'extract' | 'detective'>('embed');

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

  // Forensic Watermark Detective State
  const [detectiveText, setDetectiveText] = useState<string>('');
  const [detectiveCandidates, setDetectiveCandidates] = useState<string>('slot_1, slot_2, slot_3');
  const [detectiveResult, setDetectiveResult] = useState<{
    watermarkBits: string | null;
    zeroWidthCount: number;
    attribution: { slotId: string; confidence: number; matchBits: number; totalBits: number } | null;
  } | null>(null);
  const [isAnalyzingDetective, setIsAnalyzingDetective] = useState<boolean>(false);

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

  // Perform Forensic Watermark Analysis
  const handleAnalyzeWatermark = async () => {
    if (!detectiveText) return;

    try {
      setIsAnalyzingDetective(true);
      const extractedBits = await extractWatermark(detectiveText);

      // Count zero-width characters in text
      let zwCount = 0;
      for (const char of detectiveText) {
        if (char === '\u200B' || char === '\u200C' || char === '\u200D') {
          zwCount++;
        }
      }

      // Parse candidate slot list
      const candidateList = detectiveCandidates
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);

      let attributionResult = null;
      if (candidateList.length > 0) {
        attributionResult = await attributeWatermark(detectiveText, candidateList);
      }

      setDetectiveResult({
        watermarkBits: extractedBits,
        zeroWidthCount: zwCount,
        attribution: attributionResult,
      });

    } catch (err) {
      console.error('Forensic analysis error:', err);
    } finally {
      setIsAnalyzingDetective(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-obsidian-950 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-base font-mono font-bold text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-emerald-400" />
            Steganography & Forensic Attribution
          </h2>
          <p className="text-xs text-slate-400">
            Lossless visual deniability in PNG canvas pixels and invisible leak-traceable text watermarking.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-obsidian-900 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveSubTab('embed')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'embed' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Embed into Image
          </button>
          <button
            onClick={() => setActiveSubTab('extract')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'extract' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Extract from Image
          </button>
          <button
            onClick={() => setActiveSubTab('detective')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'detective' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            3. Forensic Detective
          </button>
        </div>
      </div>

      {activeSubTab === 'embed' ? (
        /* EMBED MODE */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TerminalWindow path="anonymous@crypton — stego/embed">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Secret Payload to Embed
              </label>
              <textarea
                value={embedText}
                onChange={(e) => setEmbedText(e.target.value)}
                placeholder="Enter sensitive keys, passwords, or credentials…"
                rows={6}
                className="w-full glass-input p-3 rounded-xl text-xs font-mono text-emerald-100 placeholder:text-slate-600 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Carrier Image (PNG)
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => embedFileInputRef.current?.click()}
                  className="p-3 rounded-xl border border-white/10 bg-obsidian-900 hover:bg-white/5 text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>{carrierImageSrc ? 'Change Image' : 'Upload PNG'}</span>
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
                  className="p-3 rounded-xl border border-white/10 bg-obsidian-900 hover:bg-white/5 text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Generate Noise</span>
                </button>
              </div>

              {carrierImageSrc && (
                <div className="mt-3 relative rounded-xl overflow-hidden border border-white/10 max-h-36 flex items-center justify-center bg-obsidian-950">
                  <img src={carrierImageSrc} alt="Carrier" className="object-contain max-h-36 w-auto" />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] bg-obsidian-950/80 text-emerald-400 border border-emerald-500/20 font-mono">
                    Carrier Ready
                  </span>
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
              disabled={isProcessingEmbed || !embedText.trim()}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isProcessingEmbed ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Encrypting & Modifying LSB Pixels…</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Encrypt & Inject into Carrier PNG</span>
                </>
              )}
            </button>
          </div>
          </TerminalWindow>

          {/* Embed Result Preview */}
          <TerminalWindow path="anonymous@crypton — stego/output">
          <div className="p-6 flex flex-col justify-between h-full space-y-4">
            {embedResultBlobUrl && embedResultKey ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Steganographic Carrier Generated
                  </span>
                  <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-obsidian-950 p-2 flex items-center justify-center">
                    <img src={embedResultBlobUrl} alt="Stego Output" className="max-h-44 object-contain rounded-lg" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-300">Decryption Key (Deliver Separately)</label>
                  <div className="flex items-center gap-2 p-1.5 bg-obsidian-950 rounded-xl border border-white/10">
                    <input
                      type="text"
                      readOnly
                      value={embedResultKey}
                      className="w-full px-2 py-1 bg-transparent text-xs font-mono text-emerald-300 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(embedResultKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <a
                  href={embedResultBlobUrl}
                  download="carrier_encrypted.png"
                  className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Carrier PNG</span>
                </a>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
                <ImageIcon className="w-12 h-12 text-slate-600" />
                <p className="text-xs max-w-xs font-mono">
                  Your encrypted PNG image output and cryptographic key will appear here after encoding.
                </p>
              </div>
            )}
          </div>
          </TerminalWindow>
        </div>
      ) : activeSubTab === 'extract' ? (
        /* EXTRACT MODE */
        <div className="max-w-xl mx-auto">
        <TerminalWindow path="anonymous@crypton — stego/extract">
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
      ) : (
        /* FORENSIC WATERMARK DETECTIVE TAB */
        <div className="max-w-2xl mx-auto animate-fadeIn">
        <TerminalWindow path="anonymous@crypton — watermark-detective" glow>
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-mono font-bold text-slate-100">
                Forensic Leak Watermark Attribution
              </h3>
              <p className="text-xs text-slate-400">
                Paste leaked text to inspect invisible zero-width fingerprints and identify the responsible recipient slot.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Leaked / Suspect Plaintext:
              </label>
              <textarea
                value={detectiveText}
                onChange={(e) => setDetectiveText(e.target.value)}
                placeholder="Paste the leaked document or message here…"
                rows={5}
                className="w-full glass-input p-3 rounded-xl text-xs font-mono text-emerald-100 placeholder:text-slate-600 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Candidate Recipient Slot IDs (Comma-separated or list):
              </label>
              <input
                type="text"
                value={detectiveCandidates}
                onChange={(e) => setDetectiveCandidates(e.target.value)}
                placeholder="slot_1, slot_2, slot_3..."
                className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-100 focus:outline-none"
              />
            </div>

            <button
              onClick={handleAnalyzeWatermark}
              disabled={isAnalyzingDetective || !detectiveText.trim()}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isAnalyzingDetective ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Analyzing Zero-Width Markers…</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  <span>Run Forensic Fingerprint Analysis</span>
                </>
              )}
            </button>
          </div>

          {/* Analysis Results */}
          {detectiveResult && (
            <div className="p-4 bg-obsidian-950 rounded-2xl border border-emerald-500/30 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold font-mono text-slate-200">
                  Forensic Attribution Report
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {detectiveResult.zeroWidthCount} Zero-Width Markers Found
                </span>
              </div>

              {detectiveResult.watermarkBits ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
                    <span className="text-[11px] font-mono text-emerald-400 font-bold block">
                      EXTRACTED 32-BIT WATERMARK:
                    </span>
                    <code className="text-xs font-mono text-slate-200 break-all">
                      {detectiveResult.watermarkBits}
                    </code>
                  </div>

                  {detectiveResult.attribution ? (
                    <div className="p-3 bg-teal-950/30 border border-teal-500/40 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-teal-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-teal-400" />
                          Attributed Recipient: {detectiveResult.attribution.slotId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-teal-500/20 text-teal-300">
                          {Math.round(detectiveResult.attribution.confidence * 100)}% Match
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {detectiveResult.attribution.matchBits} of {detectiveResult.attribution.totalBits} fingerprint bits match recipient slot <code className="text-teal-300 font-mono">{detectiveResult.attribution.slotId}</code>.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-mono">
                      Watermark bits extracted, but no matching slot found in the provided candidate list.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-mono flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>No framed zero-width steganographic watermark found in this text.</span>
                </div>
              )}
            </div>
          )}

        </div>
        </TerminalWindow>
        </div>
      )}

      <FeatureHighlights
        title="Steganography & Watermarking Guarantees"
        cards={[
          { icon: <ImageIcon className="w-5 h-5" />, title: 'Lossless Visual Cover', description: 'Pixel payloads travel disguised inside lossless PNG canvas files with identical visual appearance.' },
          { icon: <Fingerprint className="w-5 h-5" />, title: 'Leak-Traceable Watermarking', description: 'Zero-width Unicode sequences embed recipient-specific fingerprints into plaintext.' },
          { icon: <FileCheck className="w-5 h-5" />, title: 'Mathematical Attribution', description: 'Forensic hamming distance matching provides 100% precision in leak source identification.' },
          { icon: <Sparkles className="w-5 h-5" />, title: '100% Client-Side', description: 'All steganographic pixel injection and extraction occurs entirely within browser memory.' },
        ]}
      />

    </div>
  );
};
