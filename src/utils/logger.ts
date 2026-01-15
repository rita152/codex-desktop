type DebugLogger = (...args: unknown[]) => void;

export const devDebug: DebugLogger = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
};
