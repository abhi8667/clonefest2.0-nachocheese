/**
 * CipherDrop Steganography Disguise Carrier Engine
 * Injects and extracts encrypted AES-GCM payloads into PNG carrier image pixels (LSB)
 */

const MAGIC_HEADER = [0x43, 0x44, 0x52, 0x50]; // 'CDRP'

/**
 * Embed encrypted payload string into an image canvas, returning a clean PNG Blob
 */
export async function embedPayloadInImage(
  imageSource: HTMLImageElement | ImageData,
  payloadString: string
): Promise<Blob> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payloadString);
  const payloadLength = payloadBytes.length;

  // Header: 4 bytes Magic + 4 bytes Length (Big Endian)
  const totalHeaderSize = 8;
  const headerBytes = new Uint8Array(totalHeaderSize);
  headerBytes.set(MAGIC_HEADER, 0);
  headerBytes[4] = (payloadLength >> 24) & 0xff;
  headerBytes[5] = (payloadLength >> 16) & 0xff;
  headerBytes[6] = (payloadLength >> 8) & 0xff;
  headerBytes[7] = payloadLength & 0xff;

  const fullData = new Uint8Array(totalHeaderSize + payloadLength);
  fullData.set(headerBytes, 0);
  fullData.set(payloadBytes, totalHeaderSize);

  // Each byte requires 8 bits. Each pixel RGBA gives 3 usable channels (R, G, B), skipping Alpha.
  const requiredBits = fullData.length * 8;
  const requiredPixels = Math.ceil(requiredBits / 3);

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let imgData: ImageData;

  if (imageSource instanceof ImageData) {
    canvas = document.createElement('canvas');
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    ctx = canvas.getContext('2d')!;
    imgData = imageSource;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = Math.max(imageSource.naturalWidth || imageSource.width, 300);
    canvas.height = Math.max(imageSource.naturalHeight || imageSource.height, 300);
    ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
    imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  const totalPixels = imgData.width * imgData.height;
  if (requiredPixels > totalPixels) {
    throw new Error(
      `Carrier image is too small. Need at least ${Math.ceil(Math.sqrt(requiredPixels))}x${Math.ceil(Math.sqrt(requiredPixels))} resolution for this secret.`
    );
  }

  const pixels = imgData.data;
  let bitIndex = 0;

  for (let i = 0; i < fullData.length; i++) {
    const byte = fullData[i];
    for (let b = 7; b >= 0; b--) {
      const bit = (byte >> b) & 1;
      // Calculate pixel and channel index (skip alpha channels: index % 4 === 3)
      const pixelIndex = Math.floor(bitIndex / 3);
      const channel = bitIndex % 3; // 0=R, 1=G, 2=B
      const dataIndex = pixelIndex * 4 + channel;

      // Clear LSB and insert secret bit
      pixels[dataIndex] = (pixels[dataIndex] & ~1) | bit;
      bitIndex++;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export canvas to PNG blob'));
    }, 'image/png');
  });
}

/**
 * Extract encrypted payload string from an image element
 */
export async function extractPayloadFromImage(
  imageSource: HTMLImageElement | ImageData
): Promise<string> {
  let imgData: ImageData;

  if (imageSource instanceof ImageData) {
    imgData = imageSource;
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.naturalWidth || imageSource.width;
    canvas.height = imageSource.naturalHeight || imageSource.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageSource, 0, 0);
    imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  const pixels = imgData.data;
  const totalChannels = (pixels.length / 4) * 3;

  function readBits(startBit: number, numBits: number): Uint8Array {
    const numBytes = Math.ceil(numBits / 8);
    const result = new Uint8Array(numBytes);
    let currBit = 0;

    for (let i = 0; i < numBits; i++) {
      const globalBit = startBit + i;
      const pixelIndex = Math.floor(globalBit / 3);
      const channel = globalBit % 3;
      const dataIndex = pixelIndex * 4 + channel;

      const bit = pixels[dataIndex] & 1;
      const byteIdx = Math.floor(i / 8);
      result[byteIdx] = (result[byteIdx] << 1) | bit;
      currBit++;
    }
    return result;
  }

  if (totalChannels < 64) {
    throw new Error('Image too small or contains no valid carrier data.');
  }

  // 1. Read header (64 bits = 8 bytes)
  const headerBytes = readBits(0, 64);
  const magic = [headerBytes[0], headerBytes[1], headerBytes[2], headerBytes[3]];

  if (
    magic[0] !== MAGIC_HEADER[0] ||
    magic[1] !== MAGIC_HEADER[1] ||
    magic[2] !== MAGIC_HEADER[2] ||
    magic[3] !== MAGIC_HEADER[3]
  ) {
    throw new Error('No CipherDrop steganographic carrier secret detected in this image.');
  }

  const length =
    ((headerBytes[4] << 24) >>> 0) |
    (headerBytes[5] << 16) |
    (headerBytes[6] << 8) |
    headerBytes[7];

  if (length <= 0 || (8 + length) * 8 > totalChannels) {
    throw new Error('Corrupted or invalid carrier payload length.');
  }

  // 2. Read payload bytes
  const payloadBytes = readBits(64, length * 8);
  const decoder = new TextDecoder();
  return decoder.decode(payloadBytes);
}

/**
 * Generate a default procedural high-entropy aesthetic carrier pattern image
 */
export function generateProceduralCarrierImage(width = 400, height = 400): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dark obsidian gradient background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Geometric abstract mesh for high entropy
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(
      (Math.sin(i * 99) * 0.5 + 0.5) * width,
      (Math.cos(i * 37) * 0.5 + 0.5) * height,
      20 + (i % 50),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(${16 + (i * 12) % 200}, ${185 + (i * 7) % 70}, ${129 + (i * 15) % 100}, 0.15)`;
    ctx.fill();
  }

  return canvas;
}
