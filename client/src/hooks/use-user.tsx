import { useAuth } from "./use-auth";
import { type User } from "@shared/schema";

// Este hook simplifica el acceso a los datos del usuario actual
export function useUser() {
  const { user, isLoading, error } = useAuth();
  
  // Función para verificar si el usuario actual tiene un rol específico
  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.role === role;
  };
  
  // Función para verificar si el usuario pertenece a una empresa específica
  const belongsToCompany = (companyId?: number): boolean => {
    if (!user || !user.companyId) return false;
    if (!companyId) return true; // Si no se especifica companyId, solo verifica que el usuario tenga una empresa
    return user.companyId === companyId;
  };
  
  // Determina si el usuario tiene acceso a un recurso específico de una empresa
  const hasCompanyAccess = (resourceCompanyId?: number): boolean => {
    if (!user) return false;
    // Los superadmins y admins tienen acceso a todos los recursos
    if (user.role === 'superAdmin' || user.role === 'administrator') return true;
    // Los demás roles solo tienen acceso a recursos de su propia empresa
    return belongsToCompany(resourceCompanyId);
  };
  
  return {
    user,
    isLoading,
    error,
    hasRole,
    belongsToCompany,
    hasCompanyAccess
  };
}