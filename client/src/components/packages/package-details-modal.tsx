import React from "react";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PackageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: any;
}

export function PackageDetailsModal({
  isOpen,
  onClose,
  packageData,
}: PackageDetailsModalProps) {
  if (!packageData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalles del Paquete #{packageData.id}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Información general */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Fecha</p>
                  <p>{packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : formatDate(new Date(packageData.createdAt))}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Precio</p>
                  <p>{formatCurrency(packageData.price)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Descripción</p>
                  <p>{packageData.packageDescription}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Método de Pago</p>
                  <p>{packageData.paymentMethod || "No especificado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Origen y Destino */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Origen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">{packageData.segmentOrigin || packageData.tripOrigin || "No disponible"}</p>
                <div className="border-t pt-2">
                  <p className="text-sm font-medium">Remitente</p>
                  <p>{packageData.senderName} {packageData.senderLastName}</p>
                  <p className="text-sm text-muted-foreground">{packageData.senderPhone}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Destino</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">{packageData.segmentDestination || packageData.tripDestination || "No disponible"}</p>
                <div className="border-t pt-2">
                  <p className="text-sm font-medium">Destinatario</p>
                  <p>{packageData.recipientName} {packageData.recipientLastName}</p>
                  <p className="text-sm text-muted-foreground">{packageData.recipientPhone}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estados y seguimiento */}
          <Card>
            <CardHeader>
              <CardTitle>Estado y Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <div className="mr-2">
                    {packageData.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="mr-1 h-3 w-3" /> Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente de pago
                      </Badge>
                    )}
                  </div>
                  <div>
                    {packageData.isPaid && packageData.paidBy && (
                      <p className="text-xs text-muted-foreground">
                        Marcado por: {packageData.paidByUser?.firstName || "Usuario"} {packageData.paidByUser?.lastName || `ID: ${packageData.paidBy}`}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="mr-2">
                    {packageData.deliveryStatus === "entregado" ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="mr-1 h-3 w-3" /> Entregado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente de entrega
                      </Badge>
                    )}
                  </div>
                  <div>
                    {packageData.deliveryStatus === "entregado" && packageData.deliveredBy && (
                      <p className="text-xs text-muted-foreground">
                        Entregado por: {packageData.deliveredByUser?.firstName || "Usuario"} {packageData.deliveredByUser?.lastName || `ID: ${packageData.deliveredBy}`}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="col-span-2">
                  <p className="text-sm font-medium">Registrado por</p>
                  <div className="flex items-center mt-1">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>
                      {packageData.createdByUser?.firstName || "Usuario"} {packageData.createdByUser?.lastName || `ID: ${packageData.createdBy}`}
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDate(new Date(packageData.createdAt))}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}