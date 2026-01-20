import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type TerminalOutputEvent = {
  terminalId: string;
  data: string;
};

export function TerminalPanel({
  terminalId,
  visible = false,
  onClose,
  onResizeStart,
}: TerminalPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // 获取xterm主题配置
  const getTerminalTheme = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark
      ? {
        background: '#212121',
        foreground: '#ececec',
        cursor: '#ececec',
        cursorAccent: '#212121',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      }
      : {
        background: '#ffffff',
        foreground: '#111111',
        cursor: '#111111',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(0, 0, 0, 0.2)',
        black: '#000000',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec',
      };
  };

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
      theme: getTerminalTheme(),
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

    // 监听主题变化
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          term.options.theme = getTerminalTheme();
        }
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      themeObserver.disconnect();
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
      {visible && (
        <div
          className="terminal-panel__resize-handle"
          role="separator"
          aria-label={t('terminalPanel.resizeAria')}
          aria-orientation="vertical"
          onPointerDown={onResizeStart}
          tabIndex={0}
        />
      )}
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
