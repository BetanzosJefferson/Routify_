import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Clock, MapPin, Package, PhoneCall, User, CreditCard, Calendar, Truck, ShieldCheck } from "lucide-react";
import { formatCurrency, formatDate } from '@/lib/utils';

interface PackageDetailModalProps {
  packageData: any;
}

export default function PackageDetailModal({ packageData }: PackageDetailModalProps) {
  // Función para mostrar información del usuario
  const formatUserInfo = (user: any) => {
    if (!user) return "No registrado";
    return `${user.firstName} ${user.lastName}`;
  };

  return (
    <div className="space-y-6">
      {/* Información principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Información General</CardTitle>
          <CardDescription>Detalles básicos del paquete</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">ID del Paquete</p>
            <p className="text-base">{packageData.id}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
            <p className="text-base flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDateTime(new Date(packageData.createdAt))}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Precio</p>
            <p className="text-base font-semibold">
              <CreditCard className="h-4 w-4 mr-1 inline" />
              {formatCurrency(packageData.price)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Estado de Pago</p>
            <div>
              {packageData.isPaid ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <Check className="mr-1 h-3 w-3" /> Pagado
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" /> Pendiente
                </Badge>
              )}
              {packageData.paymentMethod && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({packageData.paymentMethod})
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Estado de Entrega</p>
            <div>
              {packageData.deliveryStatus === "entregado" ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <Check className="mr-1 h-3 w-3" /> Entregado
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" /> Pendiente
                </Badge>
              )}
              {packageData.markedAsDeliveredAt && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({formatDate(new Date(packageData.markedAsDeliveredAt))})
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Usa Asientos</p>
            <div>
              {packageData.usesSeats ? (
                <Badge className="bg-orange-500 hover:bg-orange-600">
                  {packageData.seatsQuantity} {packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                </Badge>
              ) : (
                <Badge variant="outline">No usa</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información del remitente y destinatario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <User className="h-4 w-4 mr-2" />
              Remitente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-base">{packageData.senderName} {packageData.senderLastName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
              <p className="text-base flex items-center">
                <PhoneCall className="h-4 w-4 mr-1" />
                {packageData.senderPhone}
              </p>
            </div>
            {packageData.senderEmail && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-base">{packageData.senderEmail}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <User className="h-4 w-4 mr-2" />
              Destinatario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-base">{packageData.recipientName} {packageData.recipientLastName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
              <p className="text-base flex items-center">
                <PhoneCall className="h-4 w-4 mr-1" />
                {packageData.recipientPhone}
              </p>
            </div>
            {packageData.recipientEmail && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-base">{packageData.recipientEmail}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información de la ruta */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            Ruta y Viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Origen</p>
            <p className="text-base">{packageData.segmentOrigin || packageData.tripOrigin || "No disponible"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Destino</p>
            <p className="text-base">{packageData.segmentDestination || packageData.tripDestination || "No disponible"}</p>
          </div>
          {packageData.tripId && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">ID de Viaje</p>
              <p className="text-base">{packageData.tripId}</p>
            </div>
          )}
          {packageData.tripDate && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Viaje</p>
              <p className="text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(new Date(packageData.tripDate))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de descripción y notas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Package className="h-4 w-4 mr-2" />
            Descripción del Paquete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Descripción</p>
            <p className="text-base">{packageData.description || "Sin descripción"}</p>
          </div>
          
          {packageData.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notas Adicionales</p>
              <p className="text-base">{packageData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de usuarios y acciones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Historial de Acciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Creado por</p>
            <p className="text-base">
              {packageData.createdByUser 
                ? `${packageData.createdByUser.firstName} ${packageData.createdByUser.lastName}`
                : "Usuario no registrado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(new Date(packageData.createdAt))}
            </p>
          </div>
          
          <Separator />
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Marcado como pagado por</p>
            {packageData.isPaid ? (
              <>
                <p className="text-base">
                  {packageData.markedAsPaidByUser 
                    ? `${packageData.markedAsPaidByUser.firstName} ${packageData.markedAsPaidByUser.lastName}`
                    : "Usuario no registrado"}
                </p>
                {packageData.markedAsPaidAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(packageData.markedAsPaidAt))}
                  </p>
                )}
              </>
            ) : (
              <p className="text-base text-muted-foreground italic">Pendiente de pago</p>
            )}
          </div>
          
          <Separator />
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Marcado como entregado por</p>
            {packageData.deliveryStatus === "entregado" ? (
              <>
                <p className="text-base">
                  {packageData.markedAsDeliveredByUser 
                    ? `${packageData.markedAsDeliveredByUser.firstName} ${packageData.markedAsDeliveredByUser.lastName}`
                    : "Usuario no registrado"}
                </p>
                {packageData.markedAsDeliveredAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(packageData.markedAsDeliveredAt))}
                  </p>
                )}
              </>
            ) : (
              <p className="text-base text-muted-foreground italic">Pendiente de entrega</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}