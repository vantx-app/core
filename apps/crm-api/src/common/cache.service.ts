import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  // Almacenamiento en memoria usando un Map
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Obtiene un valor del caché. Si no existe o ha expirado, retorna null.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Verificar si el elemento ha expirado
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /**
   * Guarda un valor en el caché con un tiempo de vida (TTL) en milisegundos.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Elimina una clave específica del caché.
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Elimina del caché todas las claves que coincidan con un patrón de prefijo.
   */
  delByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpia todo el caché.
   */
  clear(): void {
    this.cache.clear();
  }
}
