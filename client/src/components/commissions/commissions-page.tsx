import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PercentIcon } from "lucide-react";

export function CommissionsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Comisiones</h1>
      </div>
      
      <Card className="border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Módulo en Desarrollo</CardTitle>
          <CardDescription>
            Esta sección estará disponible próximamente
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <PercentIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="text-center text-muted-foreground max-w-md">
            Estamos trabajando en la implementación del sistema de gestión de comisiones. 
            Pronto podrás configurar y administrar las comisiones para rutas y viajes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default CommissionsPage;