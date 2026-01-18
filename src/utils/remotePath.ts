const REMOTE_PREFIX = 'remote://';

export type ParsedRemotePath = {
  isRemote: boolean;
  serverId?: string;
  path?: string;
  error?: string;
};

export function isRemotePath(value: string): boolean {
  return value.startsWith(REMOTE_PREFIX);
}

export function parseRemotePath(value: string): ParsedRemotePath {
  if (!isRemotePath(value)) {
    return { isRemote: false };
  }

  const remainder = value.slice(REMOTE_PREFIX.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex <= 0) {
    return { isRemote: true, error: 'Invalid remote path format' };
  }

  const serverId = remainder.slice(0, slashIndex);
  const path = remainder.slice(slashIndex);
  if (!serverId || !path) {
    return { isRemote: true, error: 'Invalid remote path format' };
  }

  return { isRemote: true, serverId, path };
}

export function buildRemotePath(serverId: string, remotePath: string): string {
  const normalized = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  return `${REMOTE_PREFIX}${serverId}${normalized}`;
}
