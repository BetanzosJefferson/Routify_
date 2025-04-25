import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { UserRole, type UserRoleType } from "@shared/schema";

interface ProtectedRouteProps {
  path: string;
  component: () => React.JSX.Element;
  allowedRoles?: UserRoleType[];
}

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/login" />
      </Route>
    );
  }

  // Si es un usuario con rol DESARROLLO o SUPER_ADMIN, siempre permitir acceso
  const hasFullAccess = user.role === UserRole.DESARROLLO || user.role === UserRole.SUPER_ADMIN;
  
  // Si hay roles permitidos definidos y el usuario no tiene acceso completo,
  // verificar si su rol está en la lista de roles permitidos
  if (allowedRoles && allowedRoles.length > 0 && !hasFullAccess) {
    if (!allowedRoles.includes(user.role as UserRoleType)) {
      return (
        <Route path={path}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-2xl font-bold text-destructive">Acceso denegado</h1>
            <p className="text-muted-foreground">
              No tienes permiso para acceder a esta página.
            </p>
            <Redirect to="/dashboard" />
          </div>
        </Route>
      );
    }
  }

  return <Route path={path} component={Component} />;
}