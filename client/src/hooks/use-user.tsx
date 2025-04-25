import { useAuth } from "./use-auth";
import { User, UserRole } from "@shared/schema";

/**
 * Hook que extiende useAuth proporcionando funciones para la gestión de permisos y roles
 */
export function useUser() {
  const auth = useAuth();
  const user = auth.user;

  // Verifica si el usuario tiene un rol específico
  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  // Verifica si el usuario tiene alguno de los roles especificados
  const hasAnyRole = (roles: string[]): boolean => {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  };

  // Verifica si el usuario pertenece a una compañía específica
  const belongsToCompany = (companyId: number): boolean => {
    if (!user || !user.companyId) return false;
    return user.companyId === companyId;
  };

  // Verifica si el usuario tiene acceso a recursos de una compañía específica
  const hasCompanyAccess = (companyId: number): boolean => {
    // Si es super admin o admin, tiene acceso a todas las compañías
    if (hasAnyRole([UserRole.SUPER_ADMIN, UserRole.ADMIN])) return true;
    // Si es dueño de la compañía, solo tiene acceso a su propia compañía
    return belongsToCompany(companyId);
  };

  // Verifica si el usuario puede ver información de todas las compañías
  const canViewAllCompanies = (): boolean => {
    return hasAnyRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  };

  return {
    ...auth,
    user,
    hasRole,
    hasAnyRole,
    belongsToCompany,
    hasCompanyAccess,
    canViewAllCompanies
  };
}