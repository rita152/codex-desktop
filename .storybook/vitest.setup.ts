import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';
import { setProjectAnnotations } from '@storybook/react-vite';
import { beforeAll } from 'vitest';
import * as projectAnnotations from './preview';

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

beforeAll(() => {
  // Story interactions run in real browsers; disable animations/transitions to avoid
  // flaky layout-driven update loops (e.g. in virtualized lists) across CI platforms.
  const style = document.createElement('style');
  style.setAttribute('data-storybook-test', 'disable-animations');
  style.textContent = `
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  `;
  document.head.appendChild(style);
});
