import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, Redirect } from "wouter";

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
    return (
      <Route path={path}>
        {() => <Redirect to="/auth" />}
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