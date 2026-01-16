import { invoke } from '@tauri-apps/api/core';

export type TerminalSpawnOptions = {
  cwd?: string | null;
  cols?: number;
  rows?: number;
};

export async function terminalSpawn(options: TerminalSpawnOptions) {
  return invoke<string>('terminal_spawn', {
    cwd: options.cwd ?? null,
    cols: options.cols ?? 80,
    rows: options.rows ?? 24,
  });
}

export async function terminalWrite(terminalId: string, data: string) {
  return invoke<void>('terminal_write', { terminalId, terminal_id: terminalId, data });
}

export async function terminalResize(terminalId: string, cols: number, rows: number) {
  return invoke<void>('terminal_resize', {
    terminalId,
    terminal_id: terminalId,
    cols,
    rows,
  });
}

export async function terminalKill(terminalId: string) {
  return invoke<void>('terminal_kill', { terminalId, terminal_id: terminalId });
}
