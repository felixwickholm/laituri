/**
 * A small QR code encoder: byte mode, error correction level M, versions 1 to 10 (up to 213 bytes).
 * Enough for an MCP address with its key. Follows ISO/IEC 18004; the structure mirrors Nayuki's
 * public-domain reference encoder. `tests/connect/qr.test.ts` checks it against matrices made by segno.
 */

/** A square of modules, row by row: true is dark. */
export type QrMatrix = boolean[][];

/** Per version, level M: total codewords, error correction codewords per block, number of blocks. */
const VERSIONS: [total: number, ecPerBlock: number, blocks: number][] = [
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
  [196, 18, 4],
  [242, 22, 4],
  [292, 22, 5],
  [346, 26, 5],
];

const ALIGNMENT: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/** Level M's two format bits. */
const LEVEL_M = 0b00;

export const MAX_QR_BYTES = 213;

const dataCodewords = (version: number) => {
  const [total, ec, blocks] = VERSIONS[version - 1];
  return total - ec * blocks;
};

const countBits = (version: number) => (version < 10 ? 8 : 16);

/** The smallest version whose data codewords hold `length` bytes in byte mode. */
export function versionFor(length: number): number {
  for (let version = 1; version <= VERSIONS.length; version++) {
    if (4 + countBits(version) + 8 * length <= dataCodewords(version) * 8) return version;
  }
  throw new RangeError(`A QR code here holds at most ${MAX_QR_BYTES} bytes.`);
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

/** Mode, count, bytes, terminator and pad bytes, as data codewords. */
function dataBytes(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  return out;
}

/** Splits the data into blocks, adds each block's error correction, and interleaves both. */
function withErrorCorrection(data: number[], version: number): number[] {
  const [total, ecLength, blockCount] = VERSIONS[version - 1];
  const shortBlocks = blockCount - (total % blockCount);
  const shortData = Math.floor(total / blockCount) - ecLength;
  const divisor = rsDivisor(ecLength);
  const blocks: number[][] = [];
  const ecc: number[][] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i++) {
    const length = shortData + (i < shortBlocks ? 0 : 1);
    const block = data.slice(offset, offset + length);
    offset += length;
    blocks.push(block);
    ecc.push(rsRemainder(block, divisor));
  }
  const out: number[] = [];
  for (let i = 0; i <= shortData; i++) for (const block of blocks) if (i < block.length) out.push(block[i]);
  for (let i = 0; i < ecLength; i++) for (const block of ecc) out.push(block[i]);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  fixed(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }

  drawPatterns(): void {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.fixed(6, i, i % 2 === 0);
      this.fixed(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < size && y >= 0 && y < size) this.fixed(x, y, distance !== 2 && distance !== 4);
        }
      }
    }
    const centres = ALIGNMENT[this.version - 1];
    const last = centres.length - 1;
    centres.forEach((cx, i) =>
      centres.forEach((cy, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.fixed(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }),
    );
    this.drawFormat(0);
    this.drawVersion();
  }

  drawFormat(mask: number): void {
    const data = (LEVEL_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    const { size } = this;
    for (let i = 0; i <= 5; i++) this.fixed(8, i, bit(i));
    this.fixed(8, 7, bit(6));
    this.fixed(8, 8, bit(7));
    this.fixed(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.fixed(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.fixed(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.fixed(8, size - 15 + i, bit(i));
    this.fixed(8, size - 8, true);
  }

  drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.fixed(a, b, dark);
      this.fixed(b, a, dark);
    }
  }

  drawCodewords(codewords: number[]): void {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (this.reserved[y][x] || i >= codewords.length * 8) continue;
          this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  applyMask(mask: number): void {
    const test = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) if (!this.reserved[y][x] && test(x, y)) this.modules[y][x] = !this.modules[y][x];
    }
  }
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

/** The four penalty rules of the standard; the mask with the lowest score is used. */
export function penalty(modules: QrMatrix): number {
  const size = modules.length;
  let score = 0;
  const lines: boolean[][] = [...modules, ...modules.map((_, x) => modules.map((row) => row[x]))];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      if (FINDER_LIKE.some((pattern) => pattern.every((dark, k) => line[i + k] === dark))) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const dark = modules[y][x];
      if (modules[y][x + 1] === dark && modules[y + 1][x] === dark && modules[y + 1][x + 1] === dark) score += 3;
    }
  }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** The final codeword sequence for `text`: data and error correction, interleaved. */
function qrCodewords(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  const version = versionFor(bytes.length);
  return withErrorCorrection(dataBytes(bytes, version), version);
}

/**
 * Encodes `text` as UTF-8 bytes. `mask` fixes the mask pattern (0 to 7); without it the lowest-penalty mask wins.
 */
export function encodeQr(text: string, mask?: number): QrMatrix {
  const version = versionFor(new TextEncoder().encode(text).length);
  const codewords = qrCodewords(text);
  const build = (choice: number) => {
    const grid = new Grid(version);
    grid.drawPatterns();
    grid.drawCodewords(codewords);
    grid.applyMask(choice);
    grid.drawFormat(choice);
    return grid.modules;
  };
  if (mask !== undefined) return build(mask);
  let best: QrMatrix | undefined;
  let bestScore = Infinity;
  for (let choice = 0; choice < MASKS.length; choice++) {
    const modules = build(choice);
    const score = penalty(modules);
    if (score < bestScore) {
      best = modules;
      bestScore = score;
    }
  }
  return best as QrMatrix;
}

/** One SVG path for every dark module, in module units, offset by the quiet zone. */
export function qrPath(modules: QrMatrix, quiet = 4): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`);
    }
  });
  return parts.join("");
}
