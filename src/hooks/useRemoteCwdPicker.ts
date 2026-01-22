import { useCallback } from 'react';

export type RemoteCwdPicker = () => Promise<string | null>;

export function useRemoteCwdPicker(): RemoteCwdPicker {
  return useCallback(async () => {
    // TODO: implement remote working directory selection.
    return null;
  }, []);
}
