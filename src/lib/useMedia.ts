"use client";

import { useSyncExternalStore } from "react";

// True while a media query matches, e.g. "(max-width: 639px)". Server
// render: false.
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
