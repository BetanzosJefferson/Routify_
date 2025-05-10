import React from "react";
import { Package, User, Clock, Calendar, PhoneCall, Truck, DollarSign, CheckCircle, ChevronsRight } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

// Define la estructura del paquete
interface PackageData {
  id: number;
  tripId?: number;
  senderName: string;
  senderLastName: string;
  senderPhone: string;
  recipientName: string;
  recipientLastName: string;
  recipientPhone: string;
  packageDescription: string;
  price: number;
  usesSeats?: boolean;
  seatsQuantity?: number;
  isPaid: boolean;
  paymentMethod?: string;
  deliveryStatus: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  createdBy?: number;
}

interface PackageTicketProps {
  packageData: PackageData;
  companyName?: string;
}

export function PackageTicket({ packageData, companyName = "TransRoute" }: PackageTicketProps) {
  return (
    <div className="thermal-ticket">
      <style>{`
        .thermal-ticket {
          width: 58mm;
          font-family: 'Courier New', monospace;
          background-color: white;
          padding: 0.5rem;
          border: 1px dashed #ccc;
          color: black;
        }
        .ticket-header {
          text-align: center;
          border-bottom: 1px dashed #ccc;
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ticket-section {
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
        }
        .ticket-section h3 {
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          font-weight: bold;
          border-bottom: 1px solid #eee;
        }
        .ticket-row {
          display: flex;
          align-items: center;
          margin-bottom: 0.25rem;
        }
        .ticket-row svg {
          width: 12px;
          height: 12px;
          margin-right: 0.25rem;
        }
        .ticket-footer {
          margin-top: 0.5rem;
          border-top: 1px dashed #ccc;
          padding-top: 0.5rem;
          text-align: center;
          font-size: 0.7rem;
        }
        .ticket-id {
          text-align: center;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .thermal-ticket, .thermal-ticket * {
            visibility: visible;
          }
          .thermal-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm;
            border: none;
          }
        }
      `}</style>
      
      <div className="ticket-header">
        <div className="font-bold text-lg">{companyName}</div>
        <div className="text-xs">Servicio de paquetería</div>
      </div>
      
      <div className="ticket-id">
        <div>PAQUETE #{packageData.id}</div>
        <div className="text-xs">{formatDate(new Date(packageData.createdAt))}</div>
      </div>
      
      <div className="ticket-section">
        <h3>Remitente</h3>
        <div className="ticket-row">
          <User size={12} />
          <span>{packageData.senderName} {packageData.senderLastName}</span>
        </div>
        <div className="ticket-row">
          <PhoneCall size={12} />
          <span>{packageData.senderPhone}</span>
        </div>
      </div>
      
      <div className="ticket-section">
        <h3>Destinatario</h3>
        <div className="ticket-row">
          <User size={12} />
          <span>{packageData.recipientName} {packageData.recipientLastName}</span>
        </div>
        <div className="ticket-row">
          <PhoneCall size={12} />
          <span>{packageData.recipientPhone}</span>
        </div>
      </div>
      
      <div className="ticket-section">
        <h3>Detalles del Paquete</h3>
        <div className="ticket-row">
          <Package size={12} />
          <span className="text-xs">{packageData.packageDescription}</span>
        </div>
        <div className="ticket-row">
          <DollarSign size={12} />
          <span>{formatCurrency(packageData.price)}</span>
        </div>
        {packageData.usesSeats && (
          <div className="ticket-row">
            <ChevronsRight size={12} />
            <span>
              Ocupa {packageData.seatsQuantity} {packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}
            </span>
          </div>
        )}
        <div className="ticket-row">
          <CheckCircle size={12} />
          <span>
            {packageData.isPaid 
              ? `Pagado (${packageData.paymentMethod || 'efectivo'})` 
              : 'Pendiente de pago'}
          </span>
        </div>
      </div>
      
      <div className="ticket-section">
        <h3>Estado de Entrega</h3>
        <div className="ticket-row">
          <Truck size={12} />
          <span>
            {packageData.deliveryStatus === 'entregado' 
              ? 'Entregado' 
              : 'Pendiente de entrega'}
          </span>
        </div>
      </div>
      
      <div className="ticket-footer">
        <div>Gracias por confiar en {companyName}</div>
        <div>Este ticket es su comprobante de envío</div>
        <div>www.transroute.mx</div>
      </div>
    </div>
  );
}