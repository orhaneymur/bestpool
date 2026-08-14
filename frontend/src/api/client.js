import axios from 'axios';

// In production, nginx proxies /api to the backend on the same origin.
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/**
 * An error response to a blob request arrives as a Blob, not as parsed JSON, so
 * the server's message ("Could not build the PDF: …") is invisible unless we
 * read it back out. Without this every export failure looked like nothing
 * happening at all.
 */
async function blobErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.error) return parsed.error;
    } catch {
      // Not JSON — fall through to the generic message below.
    }
  }
  if (data?.error) return data.error;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
  return err?.message || 'Download failed.';
}

/**
 * Download a blob response (PDF / Excel) as a file.
 *
 * @param {string} url
 * @param {string} filename
 * @param {{ onProgress?: (percent: number|null) => void, signal?: AbortSignal }} [options]
 *
 * The server buffers the whole document before the first byte moves, so
 * onProgress reports null while the contract is still being rendered and a
 * percentage once bytes are actually flowing. Callers use that to show
 * "Preparing…" and then a real progress bar — the browser's own download
 * indicator only appears at the very end, which is why an export used to feel
 * like nothing was happening.
 */
export async function downloadFile(url, filename, { onProgress, signal } = {}) {
  let res;
  try {
    res = await api.get(url, {
      responseType: 'blob',
      signal,
      // Long enough for the slowest contract plus the render queue, short enough
      // that a wedged request eventually reports instead of spinning forever.
      timeout: 90000,
      onDownloadProgress: (e) => {
        if (!onProgress) return;
        const total = e.total || Number(e.event?.target?.getResponseHeader?.('Content-Length')) || 0;
        onProgress(total > 0 ? Math.min(100, Math.round((e.loaded / total) * 100)) : null);
      },
    });
  } catch (err) {
    throw new Error(await blobErrorMessage(err));
  }

  const blobUrl = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download in some browsers before
  // they have finished reading the object URL.
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
}

export default api;
