import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon, UserIcon } from "lucide-react";

export function UsersPage() {
  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
            <UserIcon className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Usuarios</h2>
        </div>
        <Button className="flex items-center gap-1">
          <PlusIcon className="h-4 w-4" />
          <span>Agregar Usuario</span>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <div className="text-center">
              <UserIcon className="mx-auto h-16 w-16 text-gray-300" />
              <p className="mt-4 text-lg font-medium text-gray-700">
                No hay usuarios disponibles
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Utiliza el botón "Agregar Usuario" para crear un nuevo usuario
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}