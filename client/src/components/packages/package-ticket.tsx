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

// Función para generar la URL de verificación del paquete
function createVerificationUrl(packageId: number): string {
  // Construimos la URL absoluta completa para evitar problemas de redirección
  // Aseguramos que coincida exactamente con cómo está definida la ruta en App.tsx
  const base = window.location.origin; // Ej. https://example.com
  const path = `/package-verify/${packageId}`; // Path debe coincidir con la ruta en App.tsx
  
  // Agregamos un timestamp como parámetro de consulta para evitar cachés y garantizar la unicidad
  const timestamp = Date.now();
  const fullUrl = `${base}${path}?t=${timestamp}`;
  
  console.log("URL generada para verificación de paquete:", fullUrl);
  
  return fullUrl;
}

// Función para generar el QR y agregarlo al PDF
async function addQRCodeToPDF(doc: jsPDF, packageId: number, yPosition: number): Promise<void> {
  try {
    // Obtenemos la URL de verificación
    const verificationUrl = createVerificationUrl(packageId);
    
    // Generamos el código QR con configuraciones optimizadas para escaneo
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 250, // Tamaño optimizado para mejor resolución y facilidad de escaneo
      margin: 0,   // Sin margen adicional para maximizar el área del código
      errorCorrectionLevel: 'H', // Nivel alto de corrección de errores para mejorar escaneo
      color: {
        dark: '#000000', // Negro para máximo contraste
        light: '#FFFFFF'  // Fondo blanco
      }
    });
    
    // Optimizamos el tamaño y posición del QR
    const qrSize = 35; // Tamaño en mm (maximizado para visibilidad óptima)
    const xPosition = (58 - qrSize) / 2; // Centrado horizontalmente
    
    // Añadir el código QR al PDF
    doc.addImage(qrDataUrl, 'PNG', xPosition, yPosition, qrSize, qrSize);
    
    // Añadir texto explicativo debajo del QR
    const textY = yPosition + qrSize + 3;
    doc.setFontSize(6);
    doc.setFont("courier", "normal");
    doc.text("Escanea para verificar", 29, textY, { align: "center" });
    
    return Promise.resolve();
  } catch (error) {
    console.error("Error al generar código QR:", error);
    return Promise.reject(error);
  }
}

// Función para generar el PDF con dimensiones de ticket térmico
export async function generatePackageTicketPDF(packageData: PackageData, companyName: string) {
  // Crear un documento PDF con las dimensiones de un ticket térmico (58mm x 170mm)
  // Aumentamos un poco la altura para asegurar suficiente espacio para el QR
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [58, 170], 
  });

  // Configuración de fuentes
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  
  // Función para manejar texto largo y wrap automático
  const renderWrappedText = (text: string, x: number, startY: number, maxWidth: number): number => {
    let currentY = startY;
    
    if (doc.getStringUnitWidth(text) * doc.getFontSize() / doc.internal.scaleFactor > maxWidth) {
      const words = text.split(' ');
      let line = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        if (doc.getStringUnitWidth(testLine) * doc.getFontSize() / doc.internal.scaleFactor > maxWidth) {
          doc.text(line, x, currentY);
          line = words[i] + ' ';
          currentY += 3;
        } else {
          line = testLine;
        }
      }
      
      if (line.trim()) {
        doc.text(line, x, currentY);
      }
    } else {
      doc.text(text, x, currentY);
    }
    
    return currentY + 4; // Devolvemos la nueva posición Y con un pequeño margen
  };

  // Margen superior reducido para centrar mejor el contenido
  let y = 5;

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
  
  // Renderizamos el origen con posible salto de línea
  doc.text("De:", 5, y);
  y = renderWrappedText(origen, 12, y, 40);
  
  // Renderizamos el destino con posible salto de línea
  doc.text("A:", 5, y);
  y = renderWrappedText(destino, 12, y, 40);
  
  // Detalles del paquete
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Detalles del Paquete", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  const descripcion = packageData.packageDescription || "Sin descripción";
  
  // Usar la función de texto con wrap para la descripción
  y = renderWrappedText(descripcion, 5, y, 48);
  
  y += 1; // Pequeño margen adicional
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
  
  // Línea separadora antes del pie de página - eliminamos la sección de "Estado de Entrega"
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 53, y);
  
  // Pie de página (simplificado)
  y += 5;
  doc.setFontSize(7);
  doc.text(`Gracias por confiar en ${companyName}`, 29, y, { align: "center" });
  
  // Añadir código QR - Aumentamos el espacio
  y += 6;
  await addQRCodeToPDF(doc, packageData.id, y);
  
  // Aseguramos un margen inferior después del QR para evitar cortes
  doc.setFont("courier", "normal");
  doc.setFontSize(1); // Texto muy pequeño solo para forzar un margen
  doc.text(" ", 29, y + 35, { align: "center" });
  
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
      
      {/* Eliminamos la sección de Estado de Entrega para mantener consistencia con el PDF */}
      
      <div className="ticket-footer">
        <div>Gracias por confiar en {companyName}</div>
      </div>
    </div>
  );
}