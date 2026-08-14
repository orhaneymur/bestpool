import { useCallback, useState } from 'react';
import { downloadFile } from '@/api/client.js';
import { useToast } from '@/components/ui/toast.jsx';

/**
 * One place for every PDF / Excel button.
 *
 * Before this, exports were fired as `onClick={() => downloadFile(...)}`: no
 * await, no catch, no busy state. A failed render rejected into nowhere and the
 * user saw an ordinary-looking button that simply never did anything.
 *
 * Returns `busyKey` so the caller can disable and spin the exact button that is
 * working, rather than the whole row.
 */
export function useDownload() {
  const { notify, update } = useToast();
  const [busyKey, setBusyKey] = useState(null);

  const download = useCallback(
    async (key, url, filename) => {
      // Double-clicking a slow export must not queue a second render.
      if (busyKey) return false;
      setBusyKey(key);
      const id = notify({
        title: `Preparing ${filename}`,
        description: 'The server is building the document…',
        variant: 'progress',
        timeout: 0,
      });

      try {
        await downloadFile(url, filename, {
          onProgress: (percent) => {
            if (percent === null) return;
            update(id, {
              title: `Downloading ${filename}`,
              description: '',
              progress: percent,
            });
          },
        });
        update(id, {
          title: `${filename} downloaded`,
          description: '',
          variant: 'success',
          progress: null,
          timeout: 4000,
        });
        return true;
      } catch (err) {
        update(id, {
          title: 'Download failed',
          description: err.message,
          variant: 'error',
          progress: null,
          timeout: 10000,
        });
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, notify, update]
  );

  return { busyKey, downloading: busyKey !== null, download };
}
