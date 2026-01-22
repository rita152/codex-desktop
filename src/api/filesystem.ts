import { invoke } from '@tauri-apps/api/core';

export interface LocalDirectoryEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified: number | null;
}

export interface LocalDirectoryListing {
    path: string;
    entries: LocalDirectoryEntry[];
}

export async function listLocalDirectory(path: string): Promise<LocalDirectoryListing> {
    return invoke<LocalDirectoryListing>('list_local_directory', { path });
}
