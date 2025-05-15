import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, Redirect } from "wouter";
import { useEffect } from "react";

// Componente de ruta protegida que requiere autenticación
export function ProtectedRoute({
  path,
  component: Component,
  requiredRoles,
}: {
  path: string;
  component: React.ComponentType<any>;
  requiredRoles?: string[]; // Roles permitidos para acceder a esta ruta
}) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <Route path={path}>
        {() => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </Route>
    );
  }

  if (!user) {
    console.log("ProtectedRoute: Usuario no autenticado, redirigiendo a /auth");
    return (
      <Route path={path}>
        {() => {
          // Para evitar un flash de contenido vacío, usamos un efecto para la redirección
          useEffect(() => {
            window.location.href = "/auth";
          }, []);
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Redirigiendo al inicio de sesión...</span>
            </div>
          );
        }}
      </Route>
    );
  }

  // Si hay roles requeridos especificados, verificar si el usuario tiene alguno de esos roles
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user.role || !requiredRoles.includes(user.role)) {
      return (
        <Route path={path}>
          {() => (
            <div className="flex flex-col items-center justify-center min-h-screen">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
              <p className="text-gray-700">No tienes los permisos necesarios para acceder a esta página.</p>
            </div>
          )}
        </Route>
      );
    }
  }

  // Usuario autenticado y con los permisos correctos
  return (
    <Route path={path}>
      {(params) => <Component {...params} />}
    </Route>
  );
}