import { useCallback, useState } from 'react';

import { usePanelResize } from './usePanelResize';

const DEFAULT_GIT_PANEL_WIDTH = 420;
const MIN_GIT_PANEL_WIDTH = 260;
const MIN_CONVERSATION_WIDTH = 240;

export function useGitPanel({
  bodyRef,
}: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [gitPanelVisible, setGitPanelVisible] = useState(false);
  const [gitPanelWidth, setGitPanelWidth] = useState(DEFAULT_GIT_PANEL_WIDTH);

  const handleGitPanelResize = usePanelResize({
    isOpen: gitPanelVisible,
    width: gitPanelWidth,
    setWidth: setGitPanelWidth,
    minWidth: MIN_GIT_PANEL_WIDTH,
    minContentWidth: MIN_CONVERSATION_WIDTH,
    getContainerWidth: () => bodyRef.current?.getBoundingClientRect().width ?? 0,
  });

  const handleGitPanelClose = useCallback(() => {
    setGitPanelVisible(false);
  }, []);

  const toggleGitPanel = useCallback(() => {
    setGitPanelVisible((prev) => !prev);
  }, []);

  return {
    gitPanelVisible,
    gitPanelWidth,
    setGitPanelVisible,
    handleGitPanelClose,
    handleGitPanelResize,
    toggleGitPanel,
  };
}
