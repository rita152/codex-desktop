import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';

import { usePanelResize } from './usePanelResize';

const DEFAULT_REMOTE_PANEL_WIDTH = 360;
const REMOTE_PANEL_MIN_WIDTH = 240;
const REMOTE_PANEL_MIN_CONVERSATION_WIDTH = 240;

type UseRemotePanelArgs = {
  bodyRef: RefObject<HTMLDivElement | null>;
  initialWidth?: number;
};

export function useRemotePanel({ bodyRef, initialWidth = DEFAULT_REMOTE_PANEL_WIDTH }: UseRemotePanelArgs) {
  const [remoteServerPanelVisible, setRemoteServerPanelVisible] = useState(false);
  const [remoteServerPanelWidth, setRemoteServerPanelWidth] = useState(initialWidth);

  const handleRemoteServerPanelClose = useCallback(() => {
    setRemoteServerPanelVisible(false);
  }, []);

  const getContainerWidth = useCallback(
    () => bodyRef.current?.getBoundingClientRect().width ?? 0,
    [bodyRef]
  );

  const handleRemoteServerPanelResize = usePanelResize({
    isOpen: remoteServerPanelVisible,
    width: remoteServerPanelWidth,
    setWidth: setRemoteServerPanelWidth,
    minWidth: REMOTE_PANEL_MIN_WIDTH,
    minContentWidth: REMOTE_PANEL_MIN_CONVERSATION_WIDTH,
    getContainerWidth,
  });

  const toggleRemoteServerPanel = useCallback(() => {
    setRemoteServerPanelVisible((prev) => !prev);
  }, []);

  return useMemo(
    () => ({
      remoteServerPanelVisible,
      setRemoteServerPanelVisible,
      remoteServerPanelWidth,
      handleRemoteServerPanelClose,
      handleRemoteServerPanelResize,
      toggleRemoteServerPanel,
    }),
    [
      handleRemoteServerPanelClose,
      handleRemoteServerPanelResize,
      remoteServerPanelVisible,
      setRemoteServerPanelVisible,
      remoteServerPanelWidth,
      toggleRemoteServerPanel,
    ]
  );
}
