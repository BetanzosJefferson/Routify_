import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, type InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
};

type LoginData = {
  email: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: async ({ queryKey }) => {
      try {
        const path = queryKey[0] as string;
        const response = await fetch(path, {
          credentials: "include", // Importante: incluir cookies en la petición
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error fetching user:", error);
        return null;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Credenciales inválidas");
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      // Primero, limpiar cualquier dato en caché de sesiones anteriores
      // Esto es especialmente importante cuando se cambia entre cuentas de diferentes compañías
      console.log("Limpiando caché antes de iniciar sesión...");
      queryClient.removeQueries();
      
      // Luego, establecer los datos del usuario actual
      queryClient.setQueryData(["/api/auth/user"], user);
      
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido, ${user.firstName} ${user.lastName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Error en el registro");
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      // Limpiar caché previa antes de establecer el nuevo usuario
      console.log("Limpiando caché antes de registrar usuario...");
      queryClient.removeQueries();
      
      // Luego, establecer los datos del usuario actual
      queryClient.setQueryData(["/api/auth/user"], user);
      
      toast({
        title: "Registro exitoso",
        description: `Bienvenido, ${user.firstName} ${user.lastName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Error al cerrar sesión");
      }
    },
    onSuccess: () => {
      // Primero, establecer el usuario actual como null
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // IMPORTANTE: Invalidar TODAS las consultas en caché
      // Esto forzará una recarga de datos cuando el usuario inicie sesión nuevamente
      // y evitará problemas de datos de diferentes cuentas mezclados
      console.log("Limpiando caché de todas las consultas...");
      queryClient.removeQueries();
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}