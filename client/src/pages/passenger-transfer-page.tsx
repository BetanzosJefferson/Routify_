import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { 
  ArrowLeftRight, 
  Users, 
  Building, 
  ArrowRight, 
  Bus, 
  UserPlus 
} from "lucide-react";

export default function PassengerTransferPage() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Transferencia de Pasajeros</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transferencia de Pasajeros Entre Empresas</CardTitle>
          <CardDescription>
            Esta funcionalidad estará disponible próximamente. Aquí podrás transferir pasajeros
            entre diferentes empresas asociadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
          <div className="rounded-full bg-primary/10 p-6">
            <ArrowLeftRight className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-xl font-semibold mb-2">Próximamente</h3>
            <p className="text-muted-foreground mb-6">
              Estamos desarrollando un sistema que permitirá la transferencia segura y eficiente
              de pasajeros entre empresas colaboradoras.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8">
              <div className="bg-background border rounded-lg p-4 w-full md:w-40">
                <Building className="h-6 w-6 mb-2 text-primary mx-auto" />
                <p className="text-center font-medium">Tu empresa</p>
              </div>
              
              <div className="flex flex-col items-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Transferir</span>
              </div>
              
              <div className="bg-background border rounded-lg p-4 w-full md:w-40">
                <Building className="h-6 w-6 mb-2 text-blue-500 mx-auto" />
                <p className="text-center font-medium">Empresa asociada</p>
              </div>
            </div>
            
            <h4 className="font-medium mb-2">Características próximas:</h4>
            <ul className="text-left space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <Users className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Transferencia de múltiples pasajeros a la vez</span>
              </li>
              <li className="flex items-start gap-2">
                <Bus className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Reasignación automática de asientos</span>
              </li>
              <li className="flex items-start gap-2">
                <UserPlus className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Integración con notificaciones a pasajeros</span>
              </li>
            </ul>
            
            <div className={badgeVariants({ variant: "outline" })}>
              En desarrollo
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}