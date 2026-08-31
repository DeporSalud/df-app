"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
          // Check for immediate SW updates
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.log("PWA Service Worker registration skipped:", err);
        });

      // Purge any legacy caches
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key !== "df-pwa-v3") {
              caches.delete(key);
            }
          });
        });
      }
    }
  }, []);

  return null;
}
