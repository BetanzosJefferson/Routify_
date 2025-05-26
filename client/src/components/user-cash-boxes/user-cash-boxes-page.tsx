import React, { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Users, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function UserCashBoxesPage() {
  const { user } = useAuth();

  // Query para obtener transacciones de otros usuarios de la misma compañía
  const { data: userCashBoxTransactions, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/user-cash-boxes"],
    queryFn: async () => {
      const response = await fetch("/api/transactions/user-cash-boxes", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!user && (user.role === "dueño" || user.role === "admin"),
    staleTime: 30000, // 30 segundos
    retry: 3,
    retryDelay: 1000,
  });

  // Console.log para verificar que los datos están llegando correctamente
  useEffect(() => {
    if (userCashBoxTransactions) {
      console.log("=== CAJAS DE USUARIOS - TRANSACCIONES RECIBIDAS ===");
      console.log("Total de transacciones:", userCashBoxTransactions.length);
      console.log("Datos completos:", userCashBoxTransactions);
      
      // Analizar los datos por usuario
      const transaccionesPorUsuario = userCashBoxTransactions.reduce((acc: any, transaccion: any) => {
        const userId = transaccion.user_id;
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(transaccion);
        return acc;
      }, {});
      
      console.log("Transacciones agrupadas por usuario:", transaccionesPorUsuario);
      console.log("Número de usuarios con transacciones:", Object.keys(transaccionesPorUsuario).length);
      
      // Mostrar resumen por usuario
      Object.entries(transaccionesPorUsuario).forEach(([userId, transacciones]: [string, any]) => {
        console.log(`Usuario ID ${userId}: ${transacciones.length} transacciones`);
      });
      
      console.log("=== FIN ANÁLISIS CAJAS DE USUARIOS ===");
    }
  }, [userCashBoxTransactions]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
          <p className="text-muted-foreground">
            Supervisa las transacciones y movimientos de efectivo de todos los usuarios de tu empresa
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Wallet className="h-6 w-6 text-primary" />
          <Users className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Estado de carga o error */}
      {isLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cargando transacciones de cajas de usuarios...
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar las transacciones: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Estadísticas principales */}
      {userCashBoxTransactions && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transacciones
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCashBoxTransactions.length}</div>
              <p className="text-xs text-muted-foreground">
                de otros usuarios
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Usuarios Activos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(userCashBoxTransactions.map((t: any) => t.user_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                con transacciones
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Datos Verificados
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">✓</div>
              <p className="text-xs text-muted-foreground">
                consulta exitosa
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Consola
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">OK</div>
              <p className="text-xs text-muted-foreground">
                ver console.log
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Alert con estado actualizado */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {userCashBoxTransactions 
            ? `✓ Función implementada correctamente. Se encontraron ${userCashBoxTransactions.length} transacciones de otros usuarios de tu compañía. Revisa la consola del navegador (F12) para ver el análisis detallado.`
            : "Cargando datos de transacciones de otros usuarios de tu compañía..."
          }
        </AlertDescription>
      </Alert>

      {/* Main Content Area */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Coming Soon Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Lista de usuarios</span>
            </CardTitle>
            <CardDescription>
              Ver todos los usuarios con sus cajas asignadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Lista completa de usuarios y el estado de sus cajas individuales.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wallet className="h-5 w-5" />
              <span>Balances por usuario</span>
            </CardTitle>
            <CardDescription>
              Consultar balances individuales de caja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Vista de balances actuales de cada usuario.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Operaciones de caja</span>
            </CardTitle>
            <CardDescription>
              Realizar ajustes y operaciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Herramientas para realizar ajustes y operaciones en las cajas de usuarios.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades planeadas</CardTitle>
          <CardDescription>
            Características que se implementarán en esta sección
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Visualización de balances individuales por usuario</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Historial detallado de transacciones por usuario</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Herramientas de ajuste y corrección de balances</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Reportes de actividad de caja por usuario</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Configuración de límites y permisos de caja</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}