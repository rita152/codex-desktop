import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { terminalResize, terminalWrite } from '../../../api/terminal';
import { TerminalIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';

type TerminalPanelProps = {
  terminalId?: string | null;
  visible?: boolean;
  onClose?: () => void;
};

type TerminalOutputEvent = {
  terminalId: string;
  data: string;
};

export function TerminalPanel({ terminalId, visible = false, onClose }: TerminalPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!terminalId || !container) return;

    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      cursorBlink: true,
      theme: {
        background: '#ffffff',
        foreground: '#111111',
        cursor: '#111111',
        selection: 'rgba(0, 0, 0, 0.2)',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const performResize = () => {
      fitAddon.fit();
      void terminalResize(terminalId, term.cols, term.rows);
    };

    performResize();

    const resizeObserver = new ResizeObserver(() => {
      performResize();
    });
    resizeObserver.observe(container);

    const dataDisposable = term.onData((data) => {
      void terminalWrite(terminalId, data);
    });

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen<TerminalOutputEvent>('terminal-output', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        term.write(event.payload.data);
      });
    };
    void setupListener();

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      if (unlisten) {
        unlisten();
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    if (!visible || !terminalId) return;
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;
    requestAnimationFrame(() => {
      fitAddon.fit();
      void terminalResize(terminalId, term.cols, term.rows);
      term.focus();
    });
  }, [terminalId, visible]);

  return (
    <aside
      className={cn('terminal-panel', !visible && 'terminal-panel--hidden')}
      aria-hidden={!visible}
    >
      <header className="terminal-panel__header" data-tauri-drag-region>
        <div className="terminal-panel__title">
          <TerminalIcon size={16} />
          <span>{t('terminalPanel.title')}</span>
        </div>
        <button
          type="button"
          className="terminal-panel__close"
          onClick={onClose}
          aria-label={t('terminalPanel.close')}
        >
          {t('terminalPanel.close')}
        </button>
      </header>
      <div className="terminal-panel__body">
        {terminalId ? (
          <div ref={containerRef} className="terminal-panel__terminal" />
        ) : (
          <div className="terminal-panel__placeholder">{t('terminalPanel.starting')}</div>
        )}
      </div>
    </aside>
  );
}

export type { TerminalPanelProps };
