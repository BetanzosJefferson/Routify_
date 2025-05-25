import { jsPDF } from 'jspdf';

interface TicketConfig {
  title: string;
  date: string;
  user: string;
  company: string;
  transactions: any[];
  totals: {
    totalIngresos: number;
    totalEfectivo: number;
    totalTransferencias: number;
  };
  cutoffId: number;
  startDate: string;
  endDate: string;
}

export const generateTicket = async (config: TicketConfig): Promise<string> => {
  // Crear documento PDF con tamaño de ticket (60mm de ancho)
  // Convertir mm a puntos (1mm = 2.83465 puntos)
  const ticketWidth = 60 * 2.83465;  // 60mm en puntos
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [ticketWidth, 600]  // Altura inicial, se ajustará automáticamente
  });

  // Configurar fuente y tamaño
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  let yPos = 20; // Posición inicial Y
  const margin = 10;
  const lineHeight = 12;
  const contentWidth = ticketWidth - (margin * 2);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const title = "CORTE DE CAJA";
  doc.text(title, ticketWidth / 2, yPos, { align: 'center' });
  yPos += lineHeight * 1.5;

  // Información básica
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  doc.text(`ID Corte: ${config.cutoffId}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Fecha: ${config.date}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Usuario: ${config.user}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Empresa: ${config.company}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Período: ${config.startDate} - ${config.endDate}`, margin, yPos);
  yPos += lineHeight * 1.5;

  // Separador
  doc.setDrawColor(0);
  doc.line(margin, yPos - lineHeight / 2, ticketWidth - margin, yPos - lineHeight / 2);
  
  // Encabezado de transacciones
  doc.setFont('helvetica', 'bold');
  doc.text("TRANSACCIONES", margin, yPos);
  yPos += lineHeight * 1.2;

  // Listar transacciones
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  for (const tx of config.transactions) {
    const details = tx.detalles?.details || {};
    
    // Tipo de transacción
    const type = tx.detalles?.type === 'reservation' ? 'Reservación' : 
                 tx.detalles?.type === 'package' ? 'Paquetería' : 'Otro';
    doc.text(`Tipo: ${type}`, margin, yPos);
    yPos += lineHeight;
    
    // ID de la transacción
    const entityId = details.id || 'N/A';
    doc.text(`ID: ${entityId}`, margin, yPos);
    yPos += lineHeight;
    
    // Detalles adicionales según tipo
    if (tx.detalles?.type === 'reservation') {
      doc.text(`Pasajero: ${details.pasajeros || 'N/A'}`, margin, yPos);
      yPos += lineHeight;
      
      doc.text(`Origen: ${details.origen || 'N/A'}`, margin, yPos);
      yPos += lineHeight;
      
      doc.text(`Destino: ${details.destino || 'N/A'}`, margin, yPos);
      yPos += lineHeight;
    } else if (tx.detalles?.type === 'package') {
      doc.text(`Remitente: ${details.sender || 'N/A'}`, margin, yPos);
      yPos += lineHeight;
      
      doc.text(`Destinatario: ${details.recipient || 'N/A'}`, margin, yPos);
      yPos += lineHeight;
    }
    
    // Monto
    doc.setFont('helvetica', 'bold');
    doc.text(`Monto: $${details.monto || 0} - ${details.metodoPago || 'N/A'}`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += lineHeight;
    
    // Fecha de creación
    const createdAt = details.dateCreated ? new Date(details.dateCreated).toLocaleString() : tx.createdAt;
    doc.text(`Fecha: ${createdAt}`, margin, yPos);
    yPos += lineHeight * 1.5;
    
    // Línea separadora entre transacciones
    doc.setDrawColor(200);
    doc.line(margin, yPos - lineHeight / 2, ticketWidth - margin, yPos - lineHeight / 2);
  }
  
  // Resumen de totales
  yPos += lineHeight / 2;
  doc.setDrawColor(0);
  doc.line(margin, yPos - lineHeight / 2, ticketWidth - margin, yPos - lineHeight / 2);
  yPos += lineHeight;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("RESUMEN", margin, yPos);
  yPos += lineHeight * 1.2;
  
  doc.setFontSize(8);
  doc.text(`Total Ingresos: $${config.totals.totalIngresos.toFixed(2)}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Total Efectivo: $${config.totals.totalEfectivo.toFixed(2)}`, margin, yPos);
  yPos += lineHeight;
  
  doc.text(`Total Transferencias: $${config.totals.totalTransferencias.toFixed(2)}`, margin, yPos);
  yPos += lineHeight * 2;
  
  // Pie de página
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text("Documento generado automáticamente", ticketWidth / 2, yPos, { align: 'center' });
  yPos += lineHeight;
  doc.text(`Fecha de impresión: ${new Date().toLocaleString()}`, ticketWidth / 2, yPos, { align: 'center' });
  
  // Ajustar la altura del documento según el contenido
  const finalHeight = yPos + 20; // Agregar margen inferior
  doc.internal.pageSize.height = finalHeight;
  
  // Generar el PDF como cadena de datos en base64
  const pdfBase64 = doc.output('datauristring');
  return pdfBase64;
};