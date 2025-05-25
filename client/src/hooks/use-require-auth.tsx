import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./use-auth";

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      // Redirigir al usuario a la página de inicio de sesión si no está autenticado
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  return { user, loading: isLoading };
}