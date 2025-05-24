import React from "react";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Package,
  User,
  Phone,
  Map,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  Truck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PackageDetailModalProps {
  packageData: any;
}

export function PackageDetailModal({ packageData }: PackageDetailModalProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Sección de remitente y destinatario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-3 rounded-md">
          <h3 className="text-md font-semibold mb-2 flex items-center">
            <User className="mr-2 h-5 w-5 text-primary" />
            Remitente
          </h3>
          <div className="pl-7 space-y-1">
            <p className="text-base font-medium">
              {packageData.senderName} {packageData.senderLastName}
            </p>
            <p className="text-sm flex items-center">
              <Phone className="mr-2 h-4 w-4" /> 
              {packageData.senderPhone}
            </p>
          </div>
        </div>
        
        <div className="bg-slate-50 p-3 rounded-md">
          <h3 className="text-md font-semibold mb-2 flex items-center">
            <User className="mr-2 h-5 w-5 text-primary" />
            Destinatario
          </h3>
          <div className="pl-7 space-y-1">
            <p className="text-base font-medium">
              {packageData.recipientName} {packageData.recipientLastName}
            </p>
            <p className="text-sm flex items-center">
              <Phone className="mr-2 h-4 w-4" /> 
              {packageData.recipientPhone}
            </p>
          </div>
        </div>
      </div>
      
      {/* Sección de origen y destino */}
      <div className="bg-slate-50 p-3 rounded-md">
        <h3 className="text-md font-semibold mb-2 flex items-center">
          <Map className="mr-2 h-5 w-5 text-primary" />
          Ruta
        </h3>
        <div className="pl-7 space-y-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <p className="text-sm">
              <span className="font-medium">Origen:</span> {packageData.segmentOrigin || packageData.tripOrigin || "No disponible"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Destino:</span> {packageData.segmentDestination || packageData.tripDestination || "No disponible"}
            </p>
          </div>
          <p className="text-sm mt-1">
            <Calendar className="mr-2 inline-block h-4 w-4" />
            <span className="font-medium">Fecha de envío:</span> {packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : formatDate(new Date(packageData.createdAt))}
          </p>
        </div>
      </div>
      
      {/* Sección de detalles del paquete */}
      <div className="bg-slate-50 p-3 rounded-md">
        <h3 className="text-md font-semibold mb-2 flex items-center">
          <Package className="mr-2 h-5 w-5 text-primary" />
          Descripción del Paquete
        </h3>
        <div className="pl-7 space-y-1">
          <p className="text-base">
            {packageData.packageDescription}
          </p>
          <p className="text-sm mt-2 flex items-center">
            <DollarSign className="mr-2 h-4 w-4" /> 
            <span className="font-medium">Precio:</span> 
            <span className="ml-1">{formatCurrency(packageData.price)}</span>
          </p>
        </div>
      </div>
      
      {/* Sección de estados y quién realizó acciones */}
      <div className="bg-slate-50 p-3 rounded-md">
        <h3 className="text-md font-semibold mb-2 flex items-center">
          <CheckCircle className="mr-2 h-5 w-5 text-primary" />
          Estados y Seguimiento
        </h3>
        <div className="pl-7 space-y-3">
          {/* Estado de pago */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-medium mr-2">Estado de pago:</span>
              {packageData.isPaid ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" /> 
                  Pagado {packageData.paymentMethod ? `(${packageData.paymentMethod})` : ''}
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" /> 
                  Pendiente de pago
                </Badge>
              )}
            </div>
            
            {packageData.isPaid && packageData.markedAsPaidBy && (
              <div className="mt-1 text-sm text-muted-foreground">
                <span>Marcado como pagado por: </span>
                <span className="font-medium">
                  {packageData.markedAsPaidByUser ? 
                    `${packageData.markedAsPaidByUser.firstName} ${packageData.markedAsPaidByUser.lastName}` : 
                    'Usuario desconocido'}
                </span>
                {packageData.markedAsPaidAt && (
                  <span className="ml-1">
                    el {formatDate(new Date(packageData.markedAsPaidAt))}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Estado de entrega */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-medium mr-2">Estado de entrega:</span>
              {packageData.deliveryStatus === 'entregado' ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <Truck className="mr-1 h-3 w-3" /> 
                  Entregado
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" /> 
                  Pendiente de entrega
                </Badge>
              )}
            </div>
            
            {packageData.deliveryStatus === 'entregado' && packageData.markedAsDeliveredBy && (
              <div className="mt-1 text-sm text-muted-foreground">
                <span>Marcado como entregado por: </span>
                <span className="font-medium">
                  {packageData.markedAsDeliveredByUser ? 
                    `${packageData.markedAsDeliveredByUser.firstName} ${packageData.markedAsDeliveredByUser.lastName}` : 
                    'Usuario desconocido'}
                </span>
                {packageData.deliveredAt && (
                  <span className="ml-1">
                    el {formatDate(new Date(packageData.deliveredAt))}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Información de creación */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-medium mr-2">Creado por:</span>
              <span>
                {packageData.createdByUser ? 
                  `${packageData.createdByUser.firstName} ${packageData.createdByUser.lastName}` : 
                  'Usuario desconocido'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Fecha de creación: {formatDate(new Date(packageData.createdAt))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}