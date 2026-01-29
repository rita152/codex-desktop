// Hook for managing remote servers

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RemoteServerConfig } from '../types/remote';

function hasTauriInvokeAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  const tauriGlobal = window as typeof window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };

  return (
    typeof tauriGlobal.__TAURI__?.core?.invoke === 'function' ||
    typeof tauriGlobal.__TAURI_INTERNALS__?.invoke === 'function'
  );
}

export function useRemoteServers() {
  const [servers, setServers] = useState<RemoteServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    if (!hasTauriInvokeAvailable()) {
      setServers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const serverList = await invoke<RemoteServerConfig[]>('remote_list_servers');
      setServers(serverList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const addServer = useCallback(
    async (config: RemoteServerConfig) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        await invoke('remote_add_server', { config });
        await loadServers();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadServers]
  );

  const removeServer = useCallback(
    async (serverId: string) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        await invoke('remote_remove_server', { serverId });
        await loadServers();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadServers]
  );

  const testConnection = useCallback(async (serverId: string): Promise<string> => {
    if (!hasTauriInvokeAvailable()) {
      const message = 'Tauri runtime not available';
      setError(message);
      throw new Error(message);
    }
    try {
      setLoading(true);
      const result = await invoke<string>('remote_test_connection', { serverId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return {
    servers,
    loading,
    error,
    loadServers,
    addServer,
    removeServer,
    testConnection,
  };
}
