import React from "react";
import { Package } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface PackageTicketProps {
  packageData: Package;
}

export function PackageTicket({ packageData }: PackageTicketProps) {
  const { user } = useAuth();
  
  // Formatear nombre completo
  const formatFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`;
  };
  
  // Formatear fecha
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  };

  return (
    <div className="p-2 font-mono text-xs w-[58mm] mx-auto">
      {/* Estilos específicos para impresión térmica */}
      <style jsx global>
        {`
          @media print {
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              width: 58mm;
              margin: 0;
              padding: 0;
            }
            .print-section {
              width: 100%;
              padding: 0;
            }
          }
        `}
      </style>
      
      {/* Encabezado del ticket */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase">TRANSROUTE</h1>
        <p>{user?.company || "Sistema de Paqueterías"}</p>
        <p className="text-[10px]">
          {formatDate(packageData.createdAt)}
        </p>
        <div className="border-b border-black my-2"></div>
      </div>
      
      {/* Información del paquete */}
      <div className="mb-4">
        <h2 className="font-bold text-center mb-2 uppercase">RECIBO DE PAQUETERÍA</h2>
        <p className="font-bold">FOLIO: {packageData.id}</p>
        
        <div className="border-t border-black my-2"></div>
        
        <p className="font-bold mt-2">REMITENTE:</p>
        <p>{formatFullName(packageData.senderName, packageData.senderLastName)}</p>
        <p>Tel: {packageData.senderPhone}</p>
        
        <div className="border-t border-dashed my-2"></div>
        
        <p className="font-bold">DESTINATARIO:</p>
        <p>{formatFullName(packageData.recipientName, packageData.recipientLastName)}</p>
        <p>Tel: {packageData.recipientPhone}</p>
        
        <div className="border-t border-dashed my-2"></div>
        
        <p className="font-bold">DESCRIPCIÓN:</p>
        <p className="whitespace-pre-wrap">{packageData.packageDescription}</p>
        
        <div className="border-t border-dashed my-2"></div>
        
        <div className="flex justify-between">
          <span className="font-bold">PRECIO:</span>
          <span>{formatCurrency(packageData.price)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="font-bold">ESTADO DE PAGO:</span>
          <span>{packageData.isPaid ? "PAGADO" : "PENDIENTE"}</span>
        </div>
        
        {packageData.isPaid && packageData.paymentMethod && (
          <div className="flex justify-between">
            <span className="font-bold">MÉTODO DE PAGO:</span>
            <span className="uppercase">{packageData.paymentMethod}</span>
          </div>
        )}
        
        <div className="border-t border-dashed my-2"></div>
        
        <div className="flex justify-between">
          <span className="font-bold">ESTADO DE ENTREGA:</span>
          <span>{packageData.deliveryStatus === "entregado" ? "ENTREGADO" : "PENDIENTE"}</span>
        </div>
        
        {packageData.deliveryStatus === "entregado" && packageData.deliveredAt && (
          <div className="flex justify-between">
            <span className="font-bold">FECHA DE ENTREGA:</span>
            <span>{formatDate(packageData.deliveredAt)}</span>
          </div>
        )}
      </div>
      
      {/* Firma y pie de página */}
      <div className="mb-4">
        <div className="border-t border-black my-4 pt-4"></div>
        <p className="text-center">____________________________</p>
        <p className="text-center">Firma de recibido</p>
      </div>
      
      {/* Pie de página */}
      <div className="text-center text-[10px] mt-4">
        <p>CONSERVE ESTE RECIBO</p>
        <p>NECESARIO PARA RECLAMAR SU PAQUETE</p>
        <div className="border-t border-black my-2"></div>
        <p>GRACIAS POR SU PREFERENCIA</p>
      </div>
    </div>
  );
}