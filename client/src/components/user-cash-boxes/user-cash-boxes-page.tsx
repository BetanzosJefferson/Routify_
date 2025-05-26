import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Users, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function UserCashBoxesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
          <p className="text-muted-foreground">
            Gestión de cajas individuales de usuarios del sistema
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Wallet className="h-6 w-6 text-primary" />
          <Users className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Esta sección está en desarrollo. Aquí podrás gestionar las cajas individuales de cada usuario,
          ver balances, historial de transacciones y realizar operaciones de caja por usuario.
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