import { useCallback, useEffect, useRef, useState } from 'react';

export function useResponsiveSidebar(maxWidth: number) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  const sidebarVisibilityRef = useRef(true);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handleChange = () => setIsNarrowLayout(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [maxWidth]);

  useEffect(() => {
    if (isNarrowLayout) {
      setSidebarVisible(false);
      return;
    }
    setSidebarVisible(sidebarVisibilityRef.current);
  }, [isNarrowLayout]);

  useEffect(() => {
    if (isNarrowLayout) return;
    sidebarVisibilityRef.current = sidebarVisible;
  }, [isNarrowLayout, sidebarVisible]);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
  }, []);

  return {
    sidebarVisible,
    isNarrowLayout,
    toggleSidebar,
  };
}
