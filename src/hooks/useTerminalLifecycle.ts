import { useEffect, useRef } from 'react';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { listen } from '@tauri-apps/api/event';

import { terminalKill, terminalSpawn } from '../api/terminal';
import { formatError } from '../utils/codexParsing';
import { devDebug } from '../utils/logger';

import type { SessionNotice } from './useSessionMeta';

type TerminalExitEvent = {
  terminalId: string;
};

type UseTerminalLifecycleArgs = {
  terminalVisible: boolean;
  selectedSessionId: string;
  activeTerminalId?: string;
  selectedCwd?: string;
  setTerminalBySession: Dispatch<SetStateAction<Record<string, string>>>;
  setTerminalVisible: Dispatch<SetStateAction<boolean>>;
  setSessionNotices: Dispatch<SetStateAction<Record<string, SessionNotice>>>;
  t: TFunction;
};

export function useTerminalLifecycle({
  terminalVisible,
  selectedSessionId,
  activeTerminalId,
  selectedCwd,
  setTerminalBySession,
  setTerminalVisible,
  setSessionNotices,
  t,
}: UseTerminalLifecycleArgs) {
  const activeTerminalIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeTerminalId]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen<TerminalExitEvent>('terminal-exit', (event) => {
        const terminalId = event.payload.terminalId;
        setTerminalBySession((prev) => {
          const entries = Object.entries(prev);
          const next = entries.reduce<Record<string, string>>((acc, [sessionId, id]) => {
            if (id !== terminalId) {
              acc[sessionId] = id;
            }
            return acc;
          }, {});
          return next;
        });
        void terminalKill(terminalId);
        if (activeTerminalIdRef.current === terminalId) {
          setTerminalVisible(false);
        }
      });
    };

    void setupListener();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [setTerminalBySession, setTerminalVisible]);

  useEffect(() => {
    if (!terminalVisible) return;
    if (!selectedSessionId) return;
    if (activeTerminalId) return;

    const spawnTerminalSession = async () => {
      try {
        const terminalId = await terminalSpawn({ cwd: selectedCwd });
        setTerminalBySession((prev) => ({ ...prev, [selectedSessionId]: terminalId }));
      } catch (err) {
        devDebug('[terminal] spawn failed', err);
        setSessionNotices((prev) => ({
          ...prev,
          [selectedSessionId]: {
            kind: 'error',
            message: t('errors.genericError', { error: formatError(err) }),
          },
        }));
      }
    };

    void spawnTerminalSession();
  }, [
    activeTerminalId,
    selectedCwd,
    selectedSessionId,
    setSessionNotices,
    setTerminalBySession,
    terminalVisible,
    t,
  ]);
}
