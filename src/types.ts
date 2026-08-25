export type SecretFormatter = 'plaintext' | 'code' | 'markdown' | 'env';
export type KdfType = 'argon2id' | 'pbkdf2';

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 Data URL
}

export interface DecryptedSecret {
  text: string;
  formatter: SecretFormatter;
  language?: string;
  isDecoy?: boolean;
  attachment?: FileAttachment;
  commentsAllowed?: boolean;
  watermarkFingerprint?: string;
}

export interface EncryptedCommentPayload {
  author: string;
  text: string;
}

export interface StoredComment {
  id: string;
  parentId: string | null;
  payload: {
    ct: string;
    iv: string;
  };
  createdAt: number;
  decrypted?: EncryptedCommentPayload;
}

export interface RecipientEnvelopeSlot {
  slotId: string;
  label: string;
  wrappedKey: string; // Base64URL encrypted CEK
  iv: string;         // Base64URL IV for envelope unwrap
  salt?: string;      // Base64URL salt for PBKDF2/Argon2id (if slot has custom password)
  kdf?: KdfType;
  burned: boolean;
  readAt?: number | null;
  burnOnRead: boolean;
  watermarked?: boolean;
}

export interface RecipientLinkInfo {
  slotId: string;
  label: string;
  slotKey: string;
  url: string;
  burnOnRead: boolean;
  hasPassword?: boolean;
  watermarked?: boolean;
}

export interface MultiRecipientCreatedResult {
  pasteId: string;
  isMultiRecipient: true;
  isQuorum?: false;
  adminToken: string;
  adminUrl: string;
  deleteToken: string;
  expireAt: number;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
  recipientLinks: RecipientLinkInfo[];
}

export interface QuorumShareInfo {
  shareIndex: number;
  shareKey: string;
  label: string;
  url: string;
}

export interface QuorumCreatedResult {
  pasteId: string;
  isQuorum: true;
  isMultiRecipient?: false;
  threshold: number;
  totalShares: number;
  deleteToken: string;
  expireAt: number;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
  quorumShares: QuorumShareInfo[];
}

export interface StandardCreatedResult {
  pasteId: string;
  isMultiRecipient?: false;
  isQuorum?: false;
  masterKey: string;
  deleteToken: string;
  expireAt: number;
  burnAfterReading: boolean;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
}

export type CreatedSecretResult = StandardCreatedResult | MultiRecipientCreatedResult | QuorumCreatedResult;

export interface PasteResponse {
  id: string;
  isMultiRecipient?: boolean;
  isQuorum?: boolean;
  quorum?: {
    threshold: number;
    totalShares: number;
  };
  payload: {
    v: number;
    ct: string;
    iv: string;
    salt?: string;
    iterations?: number;
    kdf?: KdfType;
    memorySize?: number;
    adata?: string;
    duress?: {
      enabled: boolean;
      decoyCt: string;
      decoyIv: string;
      decoySalt: string;
      decoyKdf?: KdfType;
    };
  };
  envelopes?: RecipientEnvelopeSlot[];
  adminTokenHash?: string;
  activeSlot?: RecipientEnvelopeSlot;
  expireAt: number;
  burnAfterReading: boolean;
  viewsRemaining: number;
  openDiscussion: boolean;
  comments: StoredComment[];
  wasBurned: boolean;
  createdAt: number;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
}

export interface InboundDrop {
  id: string;
  prompt: string;
  publicKey: string;
  status: 'pending' | 'completed';
  encryptedPayload?: {
    encryptedKey: string;
    iv: string;
    ct: string;
  };
  expireAt: number;
  createdAt: number;
}

export type ActiveTab = 'create' | 'request-drop' | 'incident-room' | 'stego' | 'vault' | 'api-docs';


