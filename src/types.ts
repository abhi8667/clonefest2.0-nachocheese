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

export interface PasteResponse {
  id: string;
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
  expireAt: number;
  burnAfterReading: boolean;
  viewsRemaining: number;
  openDiscussion: boolean;
  comments: StoredComment[];
  wasBurned: boolean;
  createdAt: number;
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
