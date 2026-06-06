/**
 * Mapea una cadena de tipo de licencia (que puede provenir de OCR o Didit, ej. "Tipo D", "Driver License", "D")
 * a los valores válidos de la clasificación oficial de la ATTT de Panamá: 'A', 'B', 'C', 'D', 'E1', 'E2', 'E3', 'F', 'G', 'H', 'I', 'J'.
 */
export function mapToPanamaLicenseType(
  val: string | null | undefined,
): string | null {
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

  const validTypes = [
    'A',
    'B',
    'C',
    'D',
    'E1',
    'E2',
    'E3',
    'F',
    'G',
    'H',
    'I',
    'J',
  ];
  const matchedTypes: string[] = [];

  // 1. Coincidencia exacta
  if (validTypes.includes(normalized)) {
    return normalized;
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
      return 'D';
    }
  }

  if (matchedTypes.length > 0) {
    return Array.from(new Set(matchedTypes)).sort().join(', ');
  }

  return null;
}
