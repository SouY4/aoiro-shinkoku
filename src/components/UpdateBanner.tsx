'use client';

import { useEffect, useState } from 'react';

export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { onUpdateDownloaded?: (cb: (info: { version: string }) => void) => void } }).electronAPI;
    if (!api?.onUpdateDownloaded) return;
    api.onUpdateDownloaded((info) => setVersion(info.version));
  }, []);

  if (!version || dismissed) return null;

  const handleInstall = () => {
    const api = (window as unknown as { electronAPI?: { installUpdate?: () => void } }).electronAPI;
    api?.installUpdate?.();
  };

  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg text-sm">
      <span className="text-blue-800">
        新しいバージョン <strong>v{version}</strong> が利用可能です
      </span>
      <button
        onClick={handleInstall}
        className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 transition-colors"
      >
        再起動して更新
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="rounded border border-blue-300 px-3 py-1 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        後で
      </button>
    </div>
  );
}
