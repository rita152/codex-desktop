import { invoke } from '@tauri-apps/api/core';

import type { RemoteDirectoryListing } from '../types/remote';

export async function listRemoteDirectories(
  serverId: string,
  path: string
): Promise<RemoteDirectoryListing> {
  return invoke<RemoteDirectoryListing>('remote_list_directory', { serverId, path });
}
