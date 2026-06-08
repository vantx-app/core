"use client";

import es from "../messages/es.json";

export function useTranslation() {
  const t = (keyPath: string): string => {
    const keys = keyPath.split(".");
    let current: unknown = es;
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return keyPath;
      }
    }
    return typeof current === "string" ? current : keyPath;
  };

  return { t, locale: "es" };
}
