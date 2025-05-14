import React, { useRef, useEffect, useState } from "react";
import { Package, User, Clock, Calendar, PhoneCall, Truck, DollarSign, CheckCircle, ChevronsRight, MapPin } from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
  tripOrigin?: string;
  tripDestination?: string;
  segmentOrigin?: string;
  segmentDestination?: string;
  tripDate?: string | Date;
  shippingDate?: string | Date;
  departureTime?: string;
  companyId?: string;
}

interface PackageTicketProps {
  packageData: PackageData;
  companyName?: string;
}

// Función para generar el PDF con dimensiones de ticket térmico
export async function generatePackageTicketPDF(packageData: PackageData, companyName: string) {
  // Generar código QR para añadir al PDF
  let qrCodeDataUrl;
  try {
    const verificationUrl = `${window.location.origin}/package/${packageData.id}`;
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100 });
  } catch (error) {
    console.error("Error al generar código QR:", error);
    qrCodeDataUrl = null;
  }

  // Crear un documento PDF con las dimensiones de un ticket térmico (58mm x 160mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [58, 160], // 58mm de ancho, 160mm de alto (formato estándar para tickets térmicos)
  });

  // Configuración de fuentes
  doc.setFont("courier", "normal");
  doc.setFontSize(10);

  // Margen superior
  let y = 10;

  // Encabezado
  doc.setFontSize(12);
  doc.setFont("courier", "bold");
  const companyNameWidth = doc.getStringUnitWidth(companyName) * 12 / doc.internal.scaleFactor;
  const companyNameX = (58 - companyNameWidth) / 2;
  doc.text(companyName, companyNameX, y);
  
  y += 5;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text("Servicio de paquetería", 29, y, { align: "center" });
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 53, y);
  
  // ID del paquete
  y += 5;
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  doc.text(`PAQUETE #${packageData.id}`, 29, y, { align: "center" });
  
  y += 4;
  doc.setFontSize(8);
  doc.text(formatDate(new Date(packageData.createdAt)), 29, y, { align: "center" });
  
  // Remitente
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Remitente", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text(`${packageData.senderName} ${packageData.senderLastName}`, 5, y);
  
  y += 4;
  doc.text(`Tel: ${packageData.senderPhone}`, 5, y);
  
  // Destinatario
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Destinatario", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text(`${packageData.recipientName} ${packageData.recipientLastName}`, 5, y);
  
  y += 4;
  doc.text(`Tel: ${packageData.recipientPhone}`, 5, y);
  
  // Ruta y Origen/Destino (Nuevo)
  if ((packageData.segmentOrigin || packageData.tripOrigin) && 
      (packageData.segmentDestination || packageData.tripDestination)) {
    y += 6;
    doc.setFontSize(9);
    doc.setFont("courier", "bold");
    doc.text("Ruta", 5, y);
    
    y += 4;
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    
    // Origen con ajuste de texto
    const origen = packageData.segmentOrigin || packageData.tripOrigin || "";
    const origenCompleto = `Origen: ${origen}`;
    
    // Dividir origen en múltiples líneas si es necesario
    const maxWidthOrigen = 48; // Ancho máximo en mm
    if (doc.getStringUnitWidth(origenCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
      // Primera línea: "Origen:"
      doc.text("Origen:", 5, y);
      y += 3;
      
      // Dividir el resto en múltiples líneas
      const words = origen.split(' ');
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
          doc.text(line, 5, y);
          line = words[i] + ' ';
          y += 3;
        } else {
          line = testLine;
        }
      }
      doc.text(line, 5, y);
      y += 4;
    } else {
      // Si cabe en una línea
      doc.text(origenCompleto, 5, y);
      y += 4;
    }
    
    // Destino con ajuste de texto
    const destino = packageData.segmentDestination || packageData.tripDestination || "";
    const destinoCompleto = `Destino: ${destino}`;
    
    // Dividir destino en múltiples líneas si es necesario
    if (doc.getStringUnitWidth(destinoCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
      // Primera línea: "Destino:"
      doc.text("Destino:", 5, y);
      y += 3;
      
      // Dividir el resto en múltiples líneas
      const words = destino.split(' ');
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
          doc.text(line, 5, y);
          line = words[i] + ' ';
          y += 3;
        } else {
          line = testLine;
        }
      }
      doc.text(line, 5, y);
      y += 4;
    } else {
      // Si cabe en una línea
      doc.text(destinoCompleto, 5, y);
      y += 4;
    }
    
    // Fecha del viaje (siempre mostrar la fecha de salida del viaje)
    if (packageData.shippingDate || packageData.tripDate) {
      y += 4;
      const dateToUse = packageData.shippingDate ? new Date(packageData.shippingDate) : 
                        (packageData.tripDate ? new Date(packageData.tripDate) : new Date());
      doc.text(`Fecha de envío: ${formatDate(dateToUse)}`, 5, y);
    }
    
    // Hora de envío (usando la hora de salida del viaje)
    if (packageData.departureTime) {
      y += 4;
      doc.text(`Hora de salida: ${formatTripTime(packageData.departureTime, true, 'standard')}`, 5, y);
    } else if (packageData.createdAt) {
      // Si no hay hora de salida disponible, usar la hora de creación como fallback
      y += 4;
      const date = new Date(packageData.createdAt);
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      doc.text(`Hora de envío: ${timeStr}`, 5, y);
    }
  }
  
  // Detalles del paquete
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Detalles del Paquete", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  const descripcion = packageData.packageDescription || "Sin descripción";
  
  // Dividir descripción larga en múltiples líneas si es necesario
  const maxWidth = 48; // Ancho máximo en mm
  if (doc.getStringUnitWidth(descripcion) * 8 / doc.internal.scaleFactor > maxWidth) {
    const words = descripcion.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidth) {
        doc.text(line, 5, y);
        line = words[i] + ' ';
        y += 3;
      } else {
        line = testLine;
      }
    }
    doc.text(line, 5, y);
  } else {
    doc.text(descripcion, 5, y);
  }
  
  y += 4;
  doc.text(`Precio: ${formatCurrency(packageData.price)}`, 5, y);
  
  if (packageData.usesSeats) {
    y += 4;
    doc.text(`Ocupa ${packageData.seatsQuantity} ${packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}`, 5, y);
  }
  
  y += 4;
  doc.text(
    packageData.isPaid 
      ? `Pagado (${packageData.paymentMethod || 'efectivo'})` 
      : 'Pendiente de pago', 
    5, 
    y
  );
  
  // Código QR
  if (qrCodeDataUrl) {
    y += 8;
    const qrX = (58 - 25) / 2; // Centrar el QR (25mm de ancho)
    try {
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, 25, 25);
      y += 27; // Espacio para el QR + margen
    } catch (error) {
      console.error("Error al añadir QR al PDF:", error);
      y += 5;
    }
  }
  
  // Pie de página
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 53, y);

  // Abrir en una nueva ventana e imprimir automáticamente
  window.open(URL.createObjectURL(doc.output('blob')));
  
  return doc;
}

export function PackageTicket({ packageData, companyName = "TransRoute" }: PackageTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  
  // Generar el código QR para el enlace de verificación del paquete
  useEffect(() => {
    if (packageData && packageData.id) {
      const verificationUrl = `${window.location.origin}/package/${packageData.id}`;
      QRCode.toDataURL(verificationUrl, { width: 100 })
        .then(url => {
          setQrUrl(url);
        })
        .catch(err => {
          console.error("Error al generar código QR:", err);
        });
    }
  }, [packageData]);

  // Obtener la hora de la fecha de creación
  const getCreationTime = () => {
    if (!packageData.createdAt) return "";
    const date = new Date(packageData.createdAt);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="thermal-ticket" ref={ticketRef}>
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
        .ticket-qr {
          display: flex;
          justify-content: center;
          margin-top: 10px;
          margin-bottom: 10px;
        }
        .ticket-qr img {
          width: 100px;
          height: 100px;
        }
        .ticket-route {
          display: flex;
          flex-direction: column;
          align-items: center;
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
      
      {(packageData.segmentOrigin || packageData.tripOrigin) && (packageData.segmentDestination || packageData.tripDestination) && (
        <div className="ticket-section">
          <h3>Ruta</h3>
          <div className="ticket-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <MapPin size={12} style={{ minWidth: '12px', marginRight: '0.25rem' }} />
              <span style={{ display: 'block', wordBreak: 'break-word' }}>Origen: {packageData.segmentOrigin || packageData.tripOrigin}</span>
            </div>
          </div>
          <div className="ticket-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <MapPin size={12} style={{ minWidth: '12px', marginRight: '0.25rem' }} />
              <span style={{ display: 'block', wordBreak: 'break-word' }}>Destino: {packageData.segmentDestination || packageData.tripDestination}</span>
            </div>
          </div>
          {packageData.tripDate && (
            <div className="ticket-row">
              <Calendar size={12} />
              <span>Fecha: {formatDate(new Date(packageData.tripDate))}</span>
            </div>
          )}
          <div className="ticket-row">
            <Clock size={12} />
            <span>Hora de envío: {getCreationTime()}</span>
          </div>
        </div>
      )}
      
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
      
      {/* Código QR */}
      {qrUrl && (
        <div className="ticket-qr">
          <img src={qrUrl} alt="Código QR de verificación" />
        </div>
      )}
      
      {/* Línea separadora */}
      <div className="ticket-route"></div>
    </div>
  );
}