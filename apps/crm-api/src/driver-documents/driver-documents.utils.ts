import {
  PanamaLicenseType,
  PANAMA_LICENSE_TYPE_VALUES,
} from '../common/enums/panamaLicenseType.enum';
import { DiditIdVerification } from './driver-documents.types';

/**
 * Extrae el tipo de licencia de Panamá a partir de los códigos QR del reverso
 * de la licencia de conducir devueltos por Didit.
 *
 * El texto crudo tiene formato de campos separados por '|'. Se itera sobre
 * todos los QR decodificados, se divide el raw_text por '|' y se pasa cada
 * segmento al mapper existente. Se retorna el primer match válido.
 *
 * @example
 * // raw_text: "IRVIN EMMANUEL MENESES|CEDULA|B"
 * // → mapToPanamaLicenseType('B') → PanamaLicenseType.B
 */
export function extractLicenseTypeFromBarcodes(
  verification: DiditIdVerification,
): PanamaLicenseType | string | null {
  if (!verification.barcodes?.length) return null;

  for (const barcode of verification.barcodes) {
    if (!barcode.was_decoded || !barcode.raw_text) continue;

    const segments = barcode.raw_text.split('|');
    for (const segment of segments) {
      const mapped = mapToPanamaLicenseType(segment.trim());
      if (mapped) return mapped;
    }
  }

  return null;
}
/**
 * Mapea una cadena de tipo de licencia (que puede provenir de OCR o Didit, ej. "Tipo D", "Driver License", "D")
 * a los valores válidos de la clasificación oficial de la ATTT de Panamá.
 *
 * Retorna un valor del enum {@link PanamaLicenseType} para licencias de categoría única,
 * una cadena con categorías separadas por coma (ej. "C, D") para licencias multi-categoría,
 * o null si no se pudo determinar la categoría.
 */
export function mapToPanamaLicenseType(
  val: string | null | undefined,
): PanamaLicenseType | string | null {
  if (!val) return null;

  // Normalizar: quitar acentos, espacios y pasar a mayúsculas
  let normalized = val
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Normalizar variantes de E1, E2, E3 (ej. "E-1", "E 1", "E_1" -> "E1")
  normalized = normalized
    .replace(/E\s*[-–—_]?\s*1/g, 'E1')
    .replace(/E\s*[-–—_]?\s*2/g, 'E2')
    .replace(/E\s*[-–—_]?\s*3/g, 'E3');

  const validTypes: string[] = PANAMA_LICENSE_TYPE_VALUES;
  const matchedTypes: string[] = [];

  // 1. Coincidencia exacta → devolver directamente como enum
  if (validTypes.includes(normalized)) {
    return normalized as PanamaLicenseType;
  }

  // 2. Buscar la letra/código como palabra individual (esto cubre "Tipo D", "Categoría D", "D-1", etc.)
  for (const type of validTypes) {
    const wordRegex = new RegExp(`\\b${type}\\b`, 'i');
    if (wordRegex.test(normalized)) {
      matchedTypes.push(type);
    }
  }

  // 3. Fallback específico para Didit "Driver License" (por defecto se asigna 'D' en este CRM para conductores comerciales)
  if (matchedTypes.length === 0) {
    if (
      normalized.includes('DRIVER LICENSE') ||
      normalized.includes('LICENCIA DE CONDUCIR')
    ) {
      return PanamaLicenseType.D;
    }
  }

  if (matchedTypes.length > 0) {
    const sorted = Array.from(new Set(matchedTypes)).sort();
    // Single match → return as typed enum value
    if (sorted.length === 1) {
      return sorted[0] as PanamaLicenseType;
    }
    // Multi-category → comma-joined string (e.g. "C, D")
    return sorted.join(', ');
  }

  return null;
}
