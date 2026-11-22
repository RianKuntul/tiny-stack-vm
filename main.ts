// tiny-stack-vm: an interpreter for make.fun's tiny stack ISA (spec: the
// kit's ISA.md; where it could be read two ways, the reference VM rules).
// One run answers every instance in /input: it runs each program.bin on
// its input.bin and writes the output bytes to /output/<id>/stdout.bin
// and the exit code (traps included) to /output/<id>/exit.txt. Traps
// are exit codes 2-11 (underflow to output limit; see ISA.md).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// An opcode byte's shape, packed as imm + 8*pops + 64*pushes, by byte
// 0-83; -1 is an unknown opcode.
const SHAPE = [
  0, 65, 68, 8, 136, 144, 208, 216, -1, -1, -1, -1, -1, -1, -1, -1, 80, 80, 80, 80, 80, 80, 80, 72, 80, 80, 80,
  72, 80, 80, 80, -1, 80, 80, 80, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 10, 10, 2, 0, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, 72, 16, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 8, 64,
  8,
];

// The binary operators, in opcode order 16-34 (the gaps are the unary
// 23 NEG and 27 NOT, handled in the loop): ADD, SUB, MUL, DIV, MOD,
// DIVU, MODU, -, AND, OR, XOR, -, SHL, SHR, SHRU, -, EQ, LT, LTU.
const BIN: (((a: number, b: number) => number) | undefined)[] = [
  (a, b) => (a + b) | 0,
  (a, b) => (a - b) | 0,
  (a, b) => Math.imul(a, b),
  (a, b) => (a === -2147483648 && b === -1 ? a : Math.trunc(a / b)),
  (a, b) => (b === -1 ? 0 : (a % b) | 0),
  (a, b) => Math.floor((a >>> 0) / (b >>> 0)) | 0,
  (a, b) => ((a >>> 0) % (b >>> 0)) | 0,
  undefined,
  (a, b) => a & b,
  (a, b) => a | b,
  (a, b) => a ^ b,
  undefined,
  (a, b) => a << (b & 31),
  (a, b) => a >> (b & 31),
  (a, b) => (a >>> (b & 31)) | 0,
  undefined,
  (a, b) => (a === b ? 1 : 0),
  (a, b) => (a < b ? 1 : 0),
  (a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0),
];

function run(prog: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = prog.length;
  const D = new Int32Array(256); // data stack
  const C = new Int32Array(64); // call stack
  const M = new Int32Array(256); // memory: 256 words, zeroed
  const buf = new Uint8Array(65_536); // the output limit
  let sp = 0, csp = 0, olen = 0, inPos = 0, pc = 0, steps = 0;
  const done = (code: number) => ({ out: buf.slice(0, olen), code });
  for (;;) {
    // One step, in the spec's order: limits, bounds, stack needs, effect.
    if (steps === 1_000_000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const byte = prog[pc];
    const sh = byte < SHAPE.length ? SHAPE[byte] : -1;
    if (sh < 0) return done(5);
    const imm = sh & 7;
    if (pc + imm >= n) return done(9);
    steps++;
    const next = pc + 1 + imm;
    if (sp < ((sh >> 3) & 7)) return done(2);
    if (sp - ((sh >> 3) & 7) + (sh >> 6) > 256) return done(3);
    pc = next;
    switch (byte) {
      case 0: return done(0); // HALT
      case 1: D[sp++] = (prog[next - 1] << 24) >> 24; break; // PUSH8
      case 2: { // PUSH32: four bytes, little-endian, signed
        let v = 0;
        for (let k = 0; k < 4; k++) v |= prog[next - 4 + k] << (8 * k);
        D[sp++] = v;
        break;
      }
      case 3: sp--; break; // POP
      case 4: D[sp] = D[sp - 1]; sp++; break; // DUP
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; } // SWAP
      case 6: D[sp] = D[sp - 2]; sp++; break; // OVER
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; } // ROT
      case 48: case 49: case 50: { // JMP, JZ, JNZ
        const rel = ((prog[next - 2] | (prog[next - 1] << 8)) << 16) >> 16;
        let take = byte === 48;
        if (!take) take = (byte === 49) === (D[--sp] === 0);
        if (take) pc = next + rel;
        break;
      }
      case 51: // CALL: unsigned absolute address
        if (csp === 64) return done(7);
        C[csp++] = next;
        pc = prog[next - 2] | (prog[next - 1] << 8);
        break;
      case 52: // RET
        if (csp === 0) return done(8);
        pc = C[--csp];
        break;
      case 64: case 65: { // LOAD; STORE: ( v addr -- )
        const addr = D[sp - 1];
        if (addr < 0 || addr > 255) return done(6);
        if (byte === 64) D[sp - 1] = M[addr];
        else {
          M[addr] = D[sp - 2];
          sp -= 2;
        }
        break;
      }
      case 80: { // PRINT: decimal ASCII
        const s = String(D[sp - 1]);
        if (olen + s.length > 65_536) return done(11);
        sp--;
        for (let i = 0; i < s.length; i++) buf[olen++] = s.charCodeAt(i);
        break;
      }
      case 81: // PUTC
        if (olen === 65_536) return done(11);
        buf[olen++] = D[--sp] & 255;
        break;
      case 82: // IN: -1 once the input is used up
        D[sp++] = inPos < inp.length ? inp[inPos++] : -1;
        break;
      case 83: return done(D[--sp] & 255); // EXIT
      default: { // 16-34: arithmetic and comparison
        if (byte === 23) { D[sp - 1] = -D[sp - 1] | 0; break; } // NEG, wraps
        if (byte === 27) { D[sp - 1] = ~D[sp - 1]; break; } // NOT
        const b = D[sp - 1];
        if (b === 0 && byte >= 19 && byte <= 22) return done(4); // DIV, MOD, DIVU, MODU
        D[sp - 2] = BIN[byte - 16]!(D[sp - 2], b);
        sp--;
      }
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
