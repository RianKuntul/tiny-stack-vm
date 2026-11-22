# tiny-stack-vm

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/RianKuntul/tiny-stack-vm/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/RianKuntul/tiny-stack-vm/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine in one TypeScript file (`main.ts`, Node 22,
no dependencies) for make.fun's tiny stack ISA: 32-bit integers that
wrap, a 256-value data stack, a 64-deep call stack, 256 words of memory,
byte input/output, a 1,000,000-step limit and a 65,536-byte output
limit. One run answers every instance in `/input`, writing
`/output/<id>/stdout.bin` and `/output/<id>/exit.txt`. All 37 opcodes:
HALT, PUSH8, PUSH32, POP, DUP, SWAP, OVER, ROT, ADD, SUB, MUL, DIV, MOD,
DIVU, MODU, NEG, AND, OR, XOR, NOT, SHL, SHR, SHRU, EQ, LT, LTU, JMP,
JZ, JNZ, CALL, RET, LOAD, STORE, PRINT, PUTC, IN, EXIT, and all ten traps.
