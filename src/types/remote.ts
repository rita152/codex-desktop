// Types for remote server connection functionality

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth: SshAuth;
}

export type SshAuth =
  | { type: 'key_file'; privateKeyPath: string; passphrase?: string }
  | { type: 'agent' }
  | { type: 'password'; password: string };

export interface RemoteSessionConfig {
  serverId: string;
  remoteCwd: string;
}

export interface RemoteDirectoryEntry {
  name: string;
  path: string;
}

export interface RemoteDirectoryListing {
  path: string;
  entries: RemoteDirectoryEntry[];
}

export interface RemoteFilesystemEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface RemoteFilesystemListing {
  path: string;
  entries: RemoteFilesystemEntry[];
}
