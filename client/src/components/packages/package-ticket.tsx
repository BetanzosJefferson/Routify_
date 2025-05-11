import React, { useRef } from "react";
import { Package, User, Clock, Calendar, PhoneCall, Truck, DollarSign, CheckCircle, ChevronsRight } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
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
  segmentOrigin?: string;
  segmentDestination?: string;
  tripOrigin?: string;
  tripDestination?: string;
}

interface PackageTicketProps {
  packageData: PackageData;
  companyName?: string;
}

// Función para generar el QR y agregarlo al PDF
async function addQRCodeToPDF(doc: jsPDF, packageId: number, yPosition: number): Promise<void> {
  try {
    // Crear URL para verificación y entrega del paquete
    const verificationUrl = `${window.location.origin}/package-verify/${packageId}`;
    
    // Generar código QR como data URL
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 120,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Calcular el tamaño y posición del QR
    const qrSize = 25; // Tamaño en mm
    const xPosition = (58 - qrSize) / 2; // Centrar horizontalmente
    
    // Añadir el código QR al PDF
    doc.addImage(qrDataUrl, 'PNG', xPosition, yPosition, qrSize, qrSize);
    
    // Añadir texto explicativo debajo del QR
    const textY = yPosition + qrSize + 3;
    doc.setFontSize(6);
    doc.setFont("courier", "normal");
    doc.text("Escanea para verificar o entregar", 29, textY, { align: "center" });
    
    return Promise.resolve();
  } catch (error) {
    console.error("Error al generar código QR:", error);
    return Promise.reject(error);
  }
}

// Función para generar el PDF con dimensiones de ticket térmico
export async function generatePackageTicketPDF(packageData: PackageData, companyName: string) {
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
  
  // Origen y destino del paquete
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Ruta", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Usar los segmentos específicos si están disponibles, si no usar los de la ruta completa
  const origen = packageData.segmentOrigin || packageData.tripOrigin || "Origen no especificado";
  const destino = packageData.segmentDestination || packageData.tripDestination || "Destino no especificado";
  
  doc.text(`De: ${origen}`, 5, y);
  
  y += 4;
  doc.text(`A: ${destino}`, 5, y);
  
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
  
  // Estado de entrega
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Estado de Entrega", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text(
    packageData.deliveryStatus === 'entregado' 
      ? 'Entregado' 
      : 'Pendiente de entrega',
    5,
    y
  );
  
  // Línea separadora antes del pie de página
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 53, y);
  
  // Pie de página (simplificado)
  y += 5;
  doc.setFontSize(7);
  doc.text(`Gracias por confiar en ${companyName}`, 29, y, { align: "center" });
  
  // Añadir código QR
  y += 8;
  await addQRCodeToPDF(doc, packageData.id, y);
  
  // Abrir en una nueva ventana e imprimir automáticamente
  window.open(URL.createObjectURL(doc.output('blob')));
  
  return doc;
}

export function PackageTicket({ packageData, companyName = "TransRoute" }: PackageTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

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
        .qr-code {
          text-align: center;
          margin-top: 0.5rem;
        }
        .qr-code-caption {
          font-size: 0.6rem;
          text-align: center;
          margin-top: 0.25rem;
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
      
      {/* Información de origen y destino */}
      <div className="ticket-section">
        <h3>Ruta</h3>
        <div className="ticket-row">
          <ChevronsRight size={12} />
          <span>De: {packageData.segmentOrigin || packageData.tripOrigin || "Origen no especificado"}</span>
        </div>
        <div className="ticket-row">
          <ChevronsRight size={12} />
          <span>A: {packageData.segmentDestination || packageData.tripDestination || "Destino no especificado"}</span>
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
      </div>
    </div>
  );
}