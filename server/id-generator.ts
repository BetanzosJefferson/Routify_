/**
 * Utilidad para generar IDs de compañía
 * Genera IDs alfanuméricos sin caracteres especiales
 */

/**
 * Genera un ID de compañía único de 10 caracteres alfanuméricos
 * @returns Un string alfanumérico único para usar como companyId
 */
export function generateCompanyId(): string {
  // Caracteres permitidos (solo letras y números, sin caracteres especiales)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  // Longitud del ID
  const idLength = 10;
  
  let result = '';
  const randomValues = new Uint8Array(idLength);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < idLength; i++) {
    // Usar módulo para asegurarnos de que el índice esté dentro del rango
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

/**
 * Verifica si un ID de compañía tiene el formato correcto
 * @param id El ID a verificar
 * @returns true si el ID tiene el formato correcto, false en caso contrario
 */
export function isValidCompanyId(id: string): boolean {
  // Verificar que el ID tenga la longitud correcta y solo contenga caracteres permitidos
  return /^[a-z0-9]{10}$/.test(id);
}