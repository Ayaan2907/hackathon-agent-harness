'use client';

import dynamic from 'next/dynamic';

// tldraw measures the DOM as it mounts, so there is nothing useful to render on
// the server. Loading it client-side keeps the layout read out of localStorage
// in one place instead of behind a hydration guard.
const CanvasBoard = dynamic(() => import('./_components/CanvasBoard').then((m) => m.CanvasBoard), {
  ssr: false,
  loading: () => <div className="bg-base fixed inset-0" />,
});

export function CanvasClient() {
  return <CanvasBoard />;
}
