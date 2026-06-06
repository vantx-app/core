export enum VERIFICATION_STATUS {
  // 🟢 Rutas Felices (Avanzan al Paso 2)
  NO_RECORD_FOUND = 'NO_RECORD_FOUND', // Lienzo en blanco (Cédula y correo libres)
  UNCLAIMED_PROFILE = 'UNCLAIMED_PROFILE', // Hay un perfil creado por el Owner, listo para reclamar

  // 🔴 Rutas Bloqueantes (Frenan el Stepper y muestran error)
  EMAIL_TAKEN = 'EMAIL_TAKEN', // El correo ya pertenece a una cuenta de User
  DOCUMENT_TAKEN = 'DOCUMENT_TAKEN', // La cédula ya fue reclamada por otro User
}
