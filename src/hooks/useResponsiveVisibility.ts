import { useCallback, useEffect, useRef, useState } from 'react';

export function useResponsiveVisibility(maxWidth: number, defaultVisible = true) {
  const [visible, setVisible] = useState(defaultVisible);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  const visibilityRef = useRef(defaultVisible);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handleChange = () => setIsNarrowLayout(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [maxWidth]);

  useEffect(() => {
    if (isNarrowLayout) {
      setVisible(false);
      return;
    }
    // Restore previous state when leaving narrow mode
    setVisible(visibilityRef.current);
  }, [isNarrowLayout]);

  useEffect(() => {
    // When in wide mode, track manual toggles
    if (isNarrowLayout) return;
    visibilityRef.current = visible;
  }, [isNarrowLayout, visible]);

  const toggle = useCallback(() => {
    setVisible((prev) => !prev);
  }, []);

  const setVisibility = useCallback((isVisible: boolean) => {
    setVisible(isVisible);
  }, []);

  return {
    visible,
    setVisible: setVisibility,
    isNarrowLayout,
    toggle,
  };
}
