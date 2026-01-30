/**
 * Hook for managing MCP (Model Context Protocol) servers.
 */

import { useState, useCallback, useEffect } from 'react';

import * as mcpApi from '../api/mcp';
import type { McpServer, AddMcpServerRequest, UpdateMcpServerRequest } from '../types/mcp';

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

export function useMcpServers() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configExists, setConfigExists] = useState(true);

  const loadServers = useCallback(async () => {
    if (!hasTauriInvokeAvailable()) {
      setServers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Check if config exists
      const exists = await mcpApi.mcpConfigExists();
      setConfigExists(exists);

      if (exists) {
        const serverList = await mcpApi.listMcpServers();
        setServers(serverList);
      } else {
        setServers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const addServer = useCallback(
    async (request: AddMcpServerRequest) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        const newServer = await mcpApi.addMcpServer(request);
        setServers((prev) => [...prev, newServer].sort((a, b) => a.base.id.localeCompare(b.base.id)));
        return newServer;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addServerFromToml = useCallback(
    async (tomlText: string) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        const newServers = await mcpApi.addMcpServerFromToml(tomlText);
        setServers((prev) => [...prev, ...newServers].sort((a, b) => a.base.id.localeCompare(b.base.id)));
        return newServers;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateServer = useCallback(
    async (request: UpdateMcpServerRequest) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        const updatedServer = await mcpApi.updateMcpServer(request);
        setServers((prev) =>
          prev
            .map((s) => (s.base.id === request.id ? updatedServer : s))
            .sort((a, b) => a.base.id.localeCompare(b.base.id))
        );
        return updatedServer;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteServer = useCallback(
    async (id: string) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setLoading(true);
        setError(null);
        await mcpApi.deleteMcpServer(id);
        setServers((prev) => prev.filter((s) => s.base.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const toggleServer = useCallback(
    async (id: string, enabled: boolean) => {
      if (!hasTauriInvokeAvailable()) {
        const message = 'Tauri runtime not available';
        setError(message);
        throw new Error(message);
      }
      try {
        setError(null);
        const updatedServer = await mcpApi.toggleMcpServer(id, enabled);
        setServers((prev) =>
          prev.map((s) => (s.base.id === id ? updatedServer : s))
        );
        return updatedServer;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return {
    servers,
    loading,
    error,
    configExists,
    refresh: loadServers,
    addServer,
    addServerFromToml,
    updateServer,
    deleteServer,
    toggleServer,
  };
}
