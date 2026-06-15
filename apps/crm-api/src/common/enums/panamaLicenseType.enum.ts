/**
 * Clasificación oficial de licencias de conducir de la ATTT de Panamá.
 * Ref: Ley de Tránsito de Panamá.
 */
export enum PanamaLicenseType {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E1 = 'E1',
  E2 = 'E2',
  E3 = 'E3',
  F = 'F',
  G = 'G',
  H = 'H',
  I = 'I',
  J = 'J',
}

/** All valid single-category values as a tuple, useful for class-validator @IsIn(). */
export const PANAMA_LICENSE_TYPE_VALUES = Object.values(PanamaLicenseType);
