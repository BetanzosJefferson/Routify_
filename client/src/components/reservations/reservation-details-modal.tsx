import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Mail, Phone, MapPin, Calendar, Clock, CheckCircle, X, ArrowRightLeft, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { hasRequiredRole } from "@/lib/role-based-permissions";
import { formatTripTime, extractDayIndicator } from "@/lib/trip-utils";
import TicketCheckedModal from "@/components/reservations/ticket-checked-modal";

interface ReservationDetailsModalProps {
  reservationId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReservationDetailsModal({
  reservationId,
  isOpen,
  onOpenChange
}: ReservationDetailsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [ticketCheckResult, setTicketCheckResult] = useState<{
    isFirstScan: boolean;
    reservation?: any;
  } | null>(null);

  // Cargar los detalles de la reservación usando el endpoint público
  const { data: reservation, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/public/reservations", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const response = await fetch(`/api/public/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles de la reservación");
      }
      return response.json();
    },
    enabled: !!reservationId && isOpen,
  });

  // Verificar ticket
  const handleCheckTicket = async () => {
    if (!reservationId || !user) {
      toast({
        title: "Autenticación requerida",
        description: "Para verificar un ticket necesita iniciar sesión con una cuenta autorizada.",
        variant: "destructive",
      });
      return;
    }

    // Verificar si la reservación está cancelada
    if (reservation?.status === 'canceled') {
      toast({
        title: "Reservación cancelada",
        description: "Las reservaciones canceladas no pueden ser verificadas.",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      const response = await apiRequest("POST", `/api/reservations/${reservationId}/check`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al verificar el ticket");
      }

      const data = await response.json();
      setTicketCheckResult({
        isFirstScan: data.isFirstScan,
        reservation: data.reservation
      });
      setIsTicketModalOpen(true);

      // Refrescar los datos
      refetch();

      toast({
        title: data.isFirstScan ? "Ticket Verificado" : "Ticket Re-escaneado",
        description: data.isFirstScan
          ? "El ticket ha sido marcado como verificado correctamente."
          : "Este ticket ya había sido verificado anteriormente.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error al verificar ticket",
        description: error instanceof Error
          ? error.message
          : "No se pudo verificar el ticket. Verifica que estés autenticado con los permisos correctos.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Marcar como pagado
  const markAsPaid = async () => {
    if (!reservationId) return;

    // Verificar si la reservación está cancelada
    if (reservation?.status === 'canceled') {
      toast({
        title: "Reservación cancelada",
        description: "Las reservaciones canceladas no pueden ser marcadas como pagadas.",
        variant: "destructive",
      });
      return;
    }

    setIsMarkingAsPaid(true);
    try {
      const response = await apiRequest(
        "PUT",
        `/api/reservations/${reservationId}`,
        { paymentStatus: "pagado" }
      );

      if (!response.ok) {
        toast({
          title: "Autenticación requerida",
          description: "Para marcar como pagado necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Pago actualizado",
        description: "La reservación ha sido marcada como pagada.",
        variant: "default",
      });

      // Recargar los datos
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  // Cancelar reservación
  const cancelReservation = async () => {
    if (!reservationId) return;

    setIsCanceling(true);
    try {
      const response = await apiRequest(
        "POST",
        `/api/reservations/${reservationId}/cancel`,
        {}
      );

      if (!response.ok) {
        toast({
          title: "Error al cancelar reservación",
          description: "Para cancelar una reservación necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reservación cancelada",
        description: "La reservación ha sido cancelada correctamente y los asientos han sido liberados.",
        variant: "default",
      });

      // Recargar los datos
      await refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al cancelar la reservación",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);

      // Invalidar todas las consultas de reservaciones para actualizar la lista
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // --- Función para descargar el ticket como PDF con la nueva estructura ---
  // Función optimizada para descargar el ticket como PDF
  // Función optimizada para descargar el ticket como PDF
  const handleDownloadTicket = async () => {
    if (!reservation) {
      toast({
        title: "Error",
        description: "No se encontró la información de la reservación",
        variant: "destructive",
      });
      return;
    }

    try {
      // Mostrar loading
      toast({
        title: "Generando PDF...",
        description: "Por favor espera mientras se genera el boleto",
      });

      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const outerMargin = 10;
      const innerPadding = 15;
      const ticketWidth = pageWidth - (outerMargin * 2);
      const ticketHeight = pageHeight - (outerMargin * 2);

      // Colores del tema
      const colors = {
        primary: [59, 130, 246],    // blue-500
        text: [51, 51, 51],         // text-gray-800
        muted: [102, 102, 102],     // text-gray-500
        accent: [34, 139, 34],      // green-600
        border: [180, 180, 180],    // border-gray-300
        background: [255, 255, 255] // white
      };

      // Función auxiliar para dibujar texto con ajuste automático
      const drawTextWithWrap = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
        doc.setFontSize(fontSize);
        const splitText = doc.splitTextToSize(text, maxWidth);
        doc.text(splitText, x, y);
        return y + (splitText.length * (fontSize * 0.35)); // Retorna nueva posición Y
      };

      // Función para dibujar una sección con título
      const drawSection = (title: string, x: number, y: number, width: number) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.text);
        doc.text(title, x, y);

        // Línea debajo del título
        doc.setDrawColor(...colors.border);
        doc.line(x, y + 2, x + width, y + 2);

        return y + 10; // Retorna posición para el contenido
      };

      // Dibujar borde del boleto con esquinas redondeadas simuladas
      doc.setDrawColor(...colors.border);
      doc.setFillColor(...colors.background);
      doc.setLineWidth(1);

      // Rectángulo principal
      doc.rect(outerMargin, outerMargin, ticketWidth, ticketHeight, 'FD');

      // Esquinas redondeadas simuladas (opcional)
      const cornerRadius = 5;
      doc.setFillColor(...colors.background);

      let currentY = outerMargin + innerPadding;

      // ID de reservación (esquina superior derecha)
      doc.setFontSize(9);
      doc.setTextColor(...colors.muted);
      doc.text(
        `ID: ${generateReservationId(reservation.id)}`, 
        pageWidth - outerMargin - innerPadding, 
        currentY, 
        { align: 'right' }
      );
      currentY += 8;

      // Título principal centrado
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text('BOLETO DE VIAJE', pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;

      // Estado de la reservación si está cancelada
      if (reservation.status === 'canceled') {
        doc.setFontSize(14);
        doc.setTextColor(220, 53, 69); // red-600
        doc.text('*** CANCELADA ***', pageWidth / 2, currentY, { align: 'center' });
        currentY += 12;
      }

      // División en dos columnas
      const col1X = outerMargin + innerPadding;
      const col2X = pageWidth / 2 + 5;
      const colWidth = (ticketWidth / 2) - innerPadding - 5;

      // --- COLUMNA IZQUIERDA: QR CODE ---
      const qrSize = 80;
      const qrX = col1X + (colWidth / 2) - (qrSize / 2);
      const qrY = currentY;

      // Generar QR
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/reservation-details?id=' + reservation.id)}`;

      // --- COLUMNA DERECHA: INFORMACIÓN PRINCIPAL ---
      let infoY = currentY;

      // Información del pasajero
      infoY = drawSection('INFORMACIÓN DEL PASAJERO', col2X, infoY, colWidth);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.muted);
      doc.text('Nombre:', col2X, infoY);
      doc.setTextColor(...colors.text);
      doc.setFont('helvetica', 'bold');
      const passengerName = `${reservation.passengers[0]?.firstName || ''} ${reservation.passengers[0]?.lastName || ''}`.trim();
      doc.text(passengerName, col2X + 25, infoY);
      infoY += 8;

      // Pasajeros adicionales
      if (reservation.passengers.length > 1) {
        doc.setFont('helvetica', 'normal');
        reservation.passengers.slice(1).forEach((passenger, index) => {
          const name = `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim();
          if (name) {
            doc.text(name, col2X + 25, infoY);
            infoY += 6;
          }
        });
      }
      infoY += 5;

      // Asientos
      doc.setTextColor(...colors.muted);
      doc.text('Asientos:', col2X, infoY);
      doc.setTextColor(...colors.text);
      doc.text(`${reservation.passengers.length}`, col2X + 25, infoY);
      infoY += 8;

      // Información del viaje
      infoY += 5;
      infoY = drawSection('INFORMACIÓN DEL VIAJE', col2X, infoY, colWidth);

      // Ruta
      doc.setFontSize(10);
      doc.setTextColor(...colors.muted);
      doc.text('Ruta:', col2X, infoY);
      doc.setTextColor(...colors.text);
      const routeText = `${reservation.trip.segmentOrigin || reservation.trip.route?.origin} → ${reservation.trip.segmentDestination || reservation.trip.route?.destination}`;
      infoY = drawTextWithWrap(routeText, col2X + 20, infoY, colWidth - 20, 10);
      infoY += 3;

      // Fecha
      doc.setTextColor(...colors.muted);
      doc.text('Fecha:', col2X, infoY);
      doc.setTextColor(...colors.text);
      doc.text(formatDate(reservation.trip.departureDate), col2X + 20, infoY);
      infoY += 8;

      // Hora de salida
      doc.setTextColor(...colors.muted);
      doc.text('Salida:', col2X, infoY);
      doc.setTextColor(...colors.text);
      doc.text(formatTripTime(reservation.trip.departureTime, true, 'pretty'), col2X + 20, infoY);
      infoY += 8;

      // Hora de llegada (si existe)
      if (reservation.trip.arrivalTime) {
        doc.setTextColor(...colors.muted);
        doc.text('Llegada:', col2X, infoY);
        doc.setTextColor(...colors.text);
        doc.text(formatTripTime(reservation.trip.arrivalTime, true, 'pretty'), col2X + 20, infoY);
        infoY += 8;
      }

      // Función para cargar y dibujar el QR
      const drawTicketContent = () => {
        // Línea divisoria
        currentY = Math.max(qrY + qrSize + 10, infoY + 10);
        doc.setDrawColor(...colors.border);
        doc.line(outerMargin + innerPadding, currentY, pageWidth - outerMargin - innerPadding, currentY);
        currentY += 15;

        // --- SECCIÓN INFERIOR: PAGO Y TÉRMINOS ---
        const paymentX = outerMargin + innerPadding;
        const termsX = pageWidth / 2 + 5;

        // Información de pago
        let paymentY = drawSection('INFORMACIÓN DE PAGO', paymentX, currentY, colWidth);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        // Método de pago
        if (reservation.advanceAmount && reservation.advanceAmount > 0) {
          doc.setTextColor(...colors.muted);
          doc.text('Anticipo:', paymentX, paymentY);
          doc.setTextColor(...colors.text);
          doc.text(`${formatPrice(reservation.advanceAmount)} (${reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})`, paymentX + 25, paymentY);
          paymentY += 8;

          if (reservation.advanceAmount < reservation.totalAmount) {
            doc.setTextColor(...colors.muted);
            doc.text('Restante:', paymentX, paymentY);
            doc.setTextColor(...colors.text);
            doc.text(`${formatPrice(reservation.totalAmount - reservation.advanceAmount)} (${reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})`, paymentX + 25, paymentY);
            paymentY += 8;
          }
        } else {
          doc.setTextColor(...colors.muted);
          doc.text('Método:', paymentX, paymentY);
          doc.setTextColor(...colors.text);
          doc.text(reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia', paymentX + 25, paymentY);
          paymentY += 8;
        }

        // Total
        doc.setTextColor(...colors.muted);
        doc.text('Total:', paymentX, paymentY);
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(formatPrice(reservation.totalAmount), paymentX + 20, paymentY);
        paymentY += 10;

        // Estado de pago
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.muted);
        doc.text('Estado:', paymentX, paymentY);

        // Establecer color según el estado de pago
        if (reservation.paymentStatus === 'pagado') {
          doc.setTextColor(...colors.accent);
        } else {
          doc.setTextColor(255, 140, 0); // Naranja para pendiente
        }

        doc.setFont('helvetica', 'bold');
        doc.text(
          reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE', 
          paymentX + 22, 
          paymentY
        );

        // Términos y condiciones
        let termsY = drawSection('TÉRMINOS Y CONDICIONES', termsX, currentY, colWidth);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.muted);

        const terms = [
          '• Llegar 15 min antes de la salida',
          '• Llevar cambio exacto para pagos en efectivo',
          '• Máximo 1 maleta mediana por persona',
          '• Solo artículos personales (ropa, calzado, higiene)',
          '• Cajas/bolsas grandes tienen cargo extra',
          '• Prohibido alcohol y fumar en la unidad',
          '• No responsables por objetos perdidos',
          '• Verificar pertenencias al descender',
          '• Cancelación 5hrs antes: 100% devolución',
          '• Cancelación 3hrs antes: 50% devolución',
          '• Menos de 2hrs: Sin devolución'
        ];

        const maxTermsY = pageHeight - outerMargin - innerPadding - 10;
        const lineHeight = 4;

        terms.forEach(term => {
          if (termsY + lineHeight < maxTermsY) {
            const splitText = doc.splitTextToSize(term, colWidth - 5);
            doc.text(splitText, termsX, termsY);
            termsY += splitText.length * lineHeight + 1;
          }
        });

        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text(
          'Conserve este boleto durante todo el viaje', 
          pageWidth / 2, 
          pageHeight - outerMargin - 5, 
          { align: 'center' }
        );

        // Guardar PDF
        const fileName = `boleto-${generateReservationId(reservation.id)}.pdf`;
        doc.save(fileName);

        toast({
          title: "PDF generado exitosamente",
          description: `El boleto ${generateReservationId(reservation.id)} se ha descargado`,
        });
      };

      // Intentar cargar el QR code
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Para evitar problemas CORS

      img.onload = () => {
        try {
          doc.addImage(img, 'PNG', qrX, qrY, qrSize, qrSize);
          drawTicketContent();
        } catch (error) {
          console.warn('Error al insertar imagen QR:', error);
          // Dibujar placeholder del QR
          drawQRPlaceholder();
          drawTicketContent();
        }
      };

      img.onerror = () => {
        console.warn('Error al cargar QR code, usando placeholder');
        drawQRPlaceholder();
        drawTicketContent();
      };

      // Función para dibujar placeholder del QR
      const drawQRPlaceholder = () => {
        doc.setFillColor(100, 100, 100);
        doc.rect(qrX, qrY, qrSize, qrSize, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('QR CODE', qrX + qrSize/2, qrY + qrSize/2 - 3, { align: 'center' });
        doc.text('NO DISPONIBLE', qrX + qrSize/2, qrY + qrSize/2 + 3, { align: 'center' });
      };

      // Cargar imagen QR
      img.src = qrUrl;

      // Timeout para el QR en caso de que no cargue
      setTimeout(() => {
        if (!img.complete) {
          img.onerror();
        }
      }, 5000);

    } catch (error) {
      console.error('Error al generar PDF:', error);

      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error. Intentando método alternativo...",
        variant: "destructive",
      });

      // Método alternativo: abrir en nueva ventana para imprimir
      try {
        const ticketUrl = `/reservation-details?id=${reservation.id}&print=true`;
        const printWindow = window.open(ticketUrl, '_blank', 'width=800,height=600');

        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 1000);
          };
        }
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "No se pudo generar el boleto. Intente nuevamente.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center text-gray-500">Cargando detalles...</p>
            </div>
          ) : error || !reservation ? (
            <div className="flex flex-col items-center justify-center py-8">
              <X className="h-8 w-8 text-red-500 mb-4" />
              <p className="text-center text-gray-500">Error al cargar los detalles</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  Detalles de la Reservación #{generateReservationId(reservation.id)}
                  {reservation.status === 'canceled' && (
                    <span className="ml-2 text-sm text-red-600 font-normal">(CANCELADA)</span>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Información completa de la reservación
                </p>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-3 sm:mt-4">
                <div className="space-y-3 sm:space-y-4">
                  {/* Indicador de transferencia si aplica */}
                  {reservation.notes && reservation.notes.includes("Transferido desde") && (
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-md border border-blue-100">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-blue-700" />
                        <h3 className="font-medium text-sm sm:text-base text-blue-700">Transferencia recibida</h3>
                      </div>
                      <p className="text-sm text-blue-700 mt-2">
                        {reservation.notes}
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Información del pasajero</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">NOMBRE</div>
                        <div>
                          {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">EMAIL</div>
                        <div>{reservation.email || '-'}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">TELÉFONO</div>
                        <div>{reservation.phone || '-'}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">PASAJEROS</div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" /> {reservation.passengers.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalles del viaje */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Detalles del viaje</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">RUTA</div>
                        <div>
                          {reservation.trip.route?.name || `${reservation.trip.segmentOrigin} - ${reservation.trip.segmentDestination}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">ORIGEN</div>
                        <div>
                          {reservation.trip.segmentOrigin || reservation.trip.route?.origin}{" "}
                          {reservation.trip.route?.originDetails && `- ${reservation.trip.route.originDetails}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">DESTINO</div>
                        <div>
                          {reservation.trip.segmentDestination || reservation.trip.route?.destination}{" "}
                          {reservation.trip.route?.destinationDetails && `- ${reservation.trip.route.destinationDetails}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">FECHA</div>
                        <div>{formatDate(reservation.trip.departureDate)}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 font-medium">HORA DE SALIDA</div>
                        <div>{formatTripTime(reservation.trip.departureTime, true, 'pretty')}</div>
                      </div>

                      {reservation.trip.arrivalTime && (
                        <div>
                          <div className="text-sm text-gray-500 font-medium">HORA DE LLEGADA</div>
                          <div>{formatTripTime(reservation.trip.arrivalTime, true, 'pretty')}</div>
                        </div>
                      )}

                      {/* Mensaje descriptivo para viajes que cruzan la medianoche */}
                      {(extractDayIndicator(reservation.trip.departureTime) > 0 || extractDayIndicator(reservation.trip.arrivalTime) > 0) && (
                        <div className="mt-2">
                          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            {formatTripTime(reservation.trip.departureTime, true, 'descriptive', reservation.trip.departureDate)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Información de pago */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Información de pago</h3>
                    <div className="space-y-2 sm:space-y-3">
                      {/* Estado de reservación eliminado como solicitado */}

                      <div className="grid grid-cols-2 items-center">
                        <div className="text-sm text-gray-500 font-medium">ESTADO DE PAGO</div>
                        <div className="text-right">
                          <Badge
                            className={reservation.paymentStatus === 'pagado'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                          >
                            {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                          </Badge>
                        </div>
                      </div>

                      {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                        <>
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">ANTICIPÓ</div>
                            <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                          </div>

                          {reservation.advanceAmount < reservation.totalAmount && (
                            <div className="grid grid-cols-2 items-center">
                              <div className="text-sm text-gray-500 font-medium">RESTA</div>
                              <div className="text-right font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                            </div>
                          )}
                        </>
                      )}

                      {(!reservation.advanceAmount || reservation.advanceAmount <= 0) && (
                        <div className="grid grid-cols-2 items-center">
                          <div className="text-sm text-gray-500 font-medium">MÉTODO DE PAGO</div>
                          <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                        </div>
                      )}

                      {/* Información de descuento si hay cupón aplicado */}
                      {reservation.couponCode && reservation.discountAmount > 0 && (
                        <>
                          <div className="grid grid-cols-2 items-center mt-2 pt-2 border-t border-gray-200">
                            <div className="text-sm text-gray-500 font-medium">CUPÓN APLICADO</div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                {reservation.couponCode}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">PRECIO ORIGINAL</div>
                            <div className="text-right font-medium text-gray-500 line-through">
                              {formatPrice(reservation.originalAmount || (reservation.totalAmount + reservation.discountAmount))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">DESCUENTO</div>
                            <div className="text-right font-medium text-green-600">
                              -{formatPrice(reservation.discountAmount)}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 items-center border-t border-gray-200 pt-2 mt-2">
                        <div className="text-sm text-gray-500 font-medium">TOTAL</div>
                        <div className="text-right font-medium">{formatPrice(reservation.totalAmount)}</div>
                      </div>

                      {user && reservation.paymentStatus !== 'pagado' && reservation.status === 'confirmed' && (
                        <Button
                          onClick={markAsPaid}
                          disabled={isMarkingAsPaid}
                          variant="default"
                          className="w-full mt-3 bg-green-600 hover:bg-green-700 border-green-700 border-2"
                        >
                          {isMarkingAsPaid ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Marcar como pagado
                            </>
                          )}
                        </Button>
                      )}

                      {user && reservation.status === 'canceled' && (
                        <div className="w-full mt-3 p-2 bg-gray-100 border border-gray-200 rounded text-center text-gray-500 text-sm">
                          Esta reservación está cancelada
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Código QR */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Código QR</h3>
                    <div className="text-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.origin}/reservation-details?id=${reservation.id}`}
                        alt="QR Code"
                        className="mx-auto my-2 sm:my-4 w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48"
                      />
                      <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">
                        Este código QR contiene los detalles de la reservación.
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Escanea para ver o compartir el boleto.
                      </p>

                      <div className="mt-2 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                        <a
                          href={`/reservation-details?id=${reservation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                          Ver boleto completo
                        </a>

                        {/* Botón de descarga actualizado para usar handleDownloadTicket */}
                        <Button
                          onClick={handleDownloadTicket} // <-- Aquí se usa la nueva función
                          variant="default"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Download className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                          Descargar Boleto
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Sección de Bitácora eliminada como solicitado */}
                </div>
              </div>

              <DialogFooter className="mt-2 sm:mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button className="w-full sm:w-auto text-sm" onClick={handleClose}>Cerrar</Button>

                {user && hasRequiredRole(user, ["checker", "driver", "owner", "admin"]) && reservation.status !== 'canceled' && (
                  <Button
                    className={`w-full sm:w-auto text-sm ${reservation.checkedBy ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                    onClick={handleCheckTicket}
                    disabled={isChecking || reservation.checkedBy !== null}
                    title={reservation.checkedBy ? "Este ticket ya ha sido verificado" : "Verificar ticket"}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : reservation.checkedBy ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Ya Verificado
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verificar Ticket
                      </>
                    )}
                  </Button>
                )}

                {user && reservation.status !== 'canceled' && (
                  <Button
                    className="w-full sm:w-auto text-sm bg-red-600 hover:bg-red-700"
                    onClick={cancelReservation}
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar Reservación
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>

        {/* Modal de verificación de ticket */}
        {ticketCheckResult && (
          <TicketCheckedModal
            isOpen={isTicketModalOpen}
            onClose={() => setIsTicketModalOpen(false)}
            reservation={ticketCheckResult.reservation}
            isFirstScan={ticketCheckResult.isFirstScan}
          />
        )}
      </Dialog>
    </>
  );
}