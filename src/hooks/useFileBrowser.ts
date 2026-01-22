import { useCallback, useEffect, useState } from 'react';

import { usePanelResize } from './usePanelResize';

const DEFAULT_FILE_BROWSER_WIDTH = 360;
const MIN_FILE_BROWSER_WIDTH = 240;
const MIN_CONVERSATION_WIDTH = 240;

export function useFileBrowser({
    bodyRef,
}: {
    bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
    const [fileBrowserVisible, setFileBrowserVisible] = useState(false);
    const [fileBrowserWidth, setFileBrowserWidth] = useState(DEFAULT_FILE_BROWSER_WIDTH);

    const handleFileBrowserResize = usePanelResize({
        isOpen: fileBrowserVisible,
        width: fileBrowserWidth,
        setWidth: setFileBrowserWidth,
        minWidth: MIN_FILE_BROWSER_WIDTH,
        minContentWidth: MIN_CONVERSATION_WIDTH,
        getContainerWidth: () => bodyRef.current?.getBoundingClientRect().width ?? 0,
    });

    const handleFileBrowserClose = useCallback(() => {
        setFileBrowserVisible(false);
    }, []);

    const toggleFileBrowser = useCallback(() => {
        setFileBrowserVisible((prev) => !prev);
    }, []);

    useEffect(() => {
        if (!fileBrowserVisible) {
            setFileBrowserWidth(DEFAULT_FILE_BROWSER_WIDTH);
        }
    }, [fileBrowserVisible]);

    return {
        fileBrowserVisible,
        fileBrowserWidth,
        setFileBrowserVisible,
        handleFileBrowserClose,
        handleFileBrowserResize,
        toggleFileBrowser,
    };
}
