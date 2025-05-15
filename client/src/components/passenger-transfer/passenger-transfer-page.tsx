import React from "react";
import { PageTitle } from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PassengerTransferPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Transferencia de pasajeros" description="Gestión de transferencias de pasajeros entre viajes" />
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transferencia de pasajeros</CardTitle>
          <CardDescription>
            Esta sección está en desarrollo. Próximamente podrá gestionar la transferencia de pasajeros entre viajes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sección vacía por ahora, como se solicitó */}
        </CardContent>
      </Card>
    </div>
  );
}