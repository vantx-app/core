import { mapToPanamaLicenseType } from './driver-documents.utils';

describe('driver-documents.utils', () => {
  describe('mapToPanamaLicenseType', () => {
    it('should return null for null, undefined, or empty string', () => {
      expect(mapToPanamaLicenseType(null)).toBeNull();
      expect(mapToPanamaLicenseType(undefined)).toBeNull();
      expect(mapToPanamaLicenseType('')).toBeNull();
      expect(mapToPanamaLicenseType('   ')).toBeNull();
    });

    it('should return exact match for valid types', () => {
      expect(mapToPanamaLicenseType('A')).toBe('A');
      expect(mapToPanamaLicenseType('D')).toBe('D');
      expect(mapToPanamaLicenseType('E1')).toBe('E1');
      expect(mapToPanamaLicenseType('J')).toBe('J');
    });

    it('should normalize casing and spaces', () => {
      expect(mapToPanamaLicenseType('  d  ')).toBe('D');
      expect(mapToPanamaLicenseType('e2')).toBe('E2');
    });

    it('should map phrases like Tipo X or Categoria X', () => {
      expect(mapToPanamaLicenseType('Tipo D')).toBe('D');
      expect(mapToPanamaLicenseType('Categoría D')).toBe('D');
      expect(mapToPanamaLicenseType('Categoria E1')).toBe('E1');
      expect(mapToPanamaLicenseType('Licencia Tipo F')).toBe('F');
    });

    it('should normalize subtype notation for E1, E2, E3', () => {
      expect(mapToPanamaLicenseType('E-1')).toBe('E1');
      expect(mapToPanamaLicenseType('E 2')).toBe('E2');
      expect(mapToPanamaLicenseType('E_3')).toBe('E3');
      expect(mapToPanamaLicenseType('Tipo E-1')).toBe('E1');
    });

    it('should handle Didit Driver License fallback', () => {
      expect(mapToPanamaLicenseType('Driver License')).toBe('D');
      expect(mapToPanamaLicenseType('Licencia de conducir')).toBe('D');
    });

    it('should extract standalone valid letters/codes', () => {
      expect(mapToPanamaLicenseType('License E2 standard')).toBe('E2');
      expect(mapToPanamaLicenseType('Some G type')).toBe('G');
    });

    it('should map multiple categories', () => {
      expect(mapToPanamaLicenseType('C, D')).toBe('C, D');
      expect(mapToPanamaLicenseType('C,E1')).toBe('C, E1');
      expect(mapToPanamaLicenseType('Tipo C y D')).toBe('C, D');
      expect(mapToPanamaLicenseType('Licencia E-1, F, G')).toBe('E1, F, G');
    });

    it('should return null if no valid type can be matched', () => {
      expect(mapToPanamaLicenseType('Z')).toBeNull();
      expect(mapToPanamaLicenseType('Tipo Z')).toBeNull();
      expect(mapToPanamaLicenseType('Other document type')).toBeNull();
    });
  });
});
