export type SecretFormatter = 'plaintext' | 'code' | 'markdown' | 'env';

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
  salt?: string;      // Base64URL salt for PBKDF2 (if slot has custom password)
  burned: boolean;
  readAt?: number | null;
  burnOnRead: boolean;
}

export interface RecipientLinkInfo {
  slotId: string;
  label: string;
  slotKey: string;
  url: string;
  burnOnRead: boolean;
  hasPassword?: boolean;
}

export interface MultiRecipientCreatedResult {
  pasteId: string;
  isMultiRecipient: true;
  adminToken: string;
  adminUrl: string;
  deleteToken: string;
  expireAt: number;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
  recipientLinks: RecipientLinkInfo[];
}

export interface StandardCreatedResult {
  pasteId: string;
  isMultiRecipient?: false;
  masterKey: string;
  deleteToken: string;
  expireAt: number;
  burnAfterReading: boolean;
  timeLockEnabled?: boolean;
  unlockAt?: string | null;
}

export type CreatedSecretResult = StandardCreatedResult | MultiRecipientCreatedResult;

export interface PasteResponse {
  id: string;
  isMultiRecipient?: boolean;
  payload: {
    v: number;
    ct: string;
    iv: string;
    salt?: string;
    iterations?: number;
    adata?: string;
    duress?: {
      enabled: boolean;
      decoyCt: string;
      decoyIv: string;
      decoySalt: string;
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

