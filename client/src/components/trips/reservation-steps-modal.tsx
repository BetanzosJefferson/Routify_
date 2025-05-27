import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice, normalizeToStartOfDay, formatDateLong } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TripWithRouteInfo, UserRole } from "@shared/schema";
import QRCode from "qrcode";
import { openPrintWindow } from "./enhanced-ticket";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PrinterIcon,
  DownloadIcon,
  UsersIcon,
  InfoIcon,
  CreditCardIcon,
} from "lucide-react";

interface ReservationStepsModalProps {
  trip: TripWithRouteInfo;
  isOpen: boolean;
  onClose: () => void;
}

interface Passenger {
  firstName: string;
  lastName: string;
}

import { PaymentMethod, PaymentStatus, PaymentStatusType } from "@shared/schema";

interface ReservationFormData {
  tripId: number;
  numPassengers: number;
  passengers: Passenger[];
  email: string | null; // Ahora puede ser null para hacerlo opcional
  phone: string;
  totalAmount: number;
  paymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER;
  paymentStatus: typeof PaymentStatus.PENDING | typeof PaymentStatus.PAID;
  advanceAmount: number;
  advancePaymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER;
  notes: string;
  createdBy?: number;
  couponCode?: string; // Código de cupón opcional
}

export function ReservationStepsModal({ trip, isOpen, onClose }: ReservationStepsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ticketRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [numPassengers, setNumPassengers] = useState(1);
  const [passengers, setPassengers] = useState<Passenger[]>([{ firstName: "", lastName: "" }]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER>(PaymentMethod.CASH);
  const [notes, setNotes] = useState("");
  
  // Nuevos campos para pago
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER>(PaymentMethod.CASH);
  const [paymentStatus, setPaymentStatus] = useState<typeof PaymentStatus.PENDING | typeof PaymentStatus.PAID>(PaymentStatus.PENDING);
  
  // Campos para cupones
  const [hasCoupon, setHasCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponVerified, setCouponVerified] = useState(false);
  const [isVerifyingCoupon, setIsVerifyingCoupon] = useState(false);
  
  // Steps state
  const [currentStep, setCurrentStep] = useState(0);
  const [submittedReservation, setSubmittedReservation] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // Update passengers array when number of passengers changes
  const handlePassengersChange = (value: string) => {
    const count = parseInt(value, 10);
    setNumPassengers(count);
    
    // Resize passengers array
    if (count > passengers.length) {
      // Add empty passengers
      setPassengers([
        ...passengers,
        ...Array(count - passengers.length).fill(0).map(() => ({ firstName: "", lastName: "" })),
      ]);
    } else if (count < passengers.length) {
      // Remove excess passengers
      setPassengers(passengers.slice(0, count));
    }
  };
  
  // Update passenger information
  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = {
      ...updatedPassengers[index],
      [field]: value,
    };
    setPassengers(updatedPassengers);
  };
  
  // Validate the current step
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Trip details - nothing to validate
        return true;
      case 1: // Passenger info
        return passengers.every(p => p.firstName.trim() && p.lastName.trim());
      case 2: // Contact info
        // Email es opcional, si está vacío se considera válido
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Teléfono flexible - eliminar espacios, guiones y paréntesis antes de validar
        const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
        const phoneRegex = /^[0-9]{10}$/;
        return (email === '' || emailRegex.test(email)) && phoneRegex.test(normalizedPhone);
      default:
        return true;
    }
  };
  
  // Error messages for validation
  const getStepErrorMessage = () => {
    switch (currentStep) {
      case 1:
        return "Por favor, complete el nombre y apellido de todos los pasajeros";
      case 2:
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Normalizar teléfono eliminando espacios, guiones y paréntesis
        const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
        const phoneRegex = /^[0-9]{10}$/;
        
        // Solo validar email si no está vacío
        if (email !== '' && !emailRegex.test(email)) 
          return "Por favor, ingrese un correo electrónico válido o déjelo en blanco";
        
        if (!phoneRegex.test(normalizedPhone)) 
          return "Por favor, ingrese un número de teléfono válido de 10 dígitos (se aceptan espacios, guiones o paréntesis)";
        
        return "";
      default:
        return "";
    }
  };
  
  // Navigate between steps
  const goToNextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep === 3) {
        // Last step - submit reservation
        handleCompleteReservation();
      } else {
        setCurrentStep(currentStep + 1);
      }
    } else {
      toast({
        title: "Error de validación",
        description: getStepErrorMessage(),
        variant: "destructive",
      });
    }
  };
  
  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  // Reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: async (data: ReservationFormData) => {
      // Determinar el endpoint según el rol del usuario
      const isCommissioner = user?.role === UserRole.COMMISSIONER;
      const endpoint = isCommissioner ? "/api/reservation-requests" : "/api/reservations";
      
      console.log(`Usuario con rol ${user?.role} enviando solicitud a ${endpoint}`);
      console.log("Datos que se están enviando:", JSON.stringify(data, null, 2));
      
      // Si es comisionista, adaptar los datos al formato que espera el endpoint de solicitudes
      let response;
      if (isCommissioner) {
        // El endpoint /api/reservation-requests espera passengersData en lugar de passengers
        const adaptedData = {
          tripId: data.tripId,
          passengersData: data.passengers,
          totalAmount: data.totalAmount,
          email: data.email,
          phone: data.phone,
          paymentStatus: data.paymentStatus,
          advanceAmount: data.advanceAmount,
          advancePaymentMethod: data.advancePaymentMethod,
          paymentMethod: data.paymentMethod,
          notes: data.notes
        };
        
        console.log("Datos adaptados para solicitud:", JSON.stringify(adaptedData, null, 2));
        response = await apiRequest("POST", endpoint, adaptedData);
      } else {
        response = await apiRequest("POST", endpoint, data);
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create reservation");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Verificamos si el usuario es comisionista para mostrar un mensaje diferente
      if (user?.role === UserRole.COMMISSIONER) {
        toast({
          title: "Solicitud enviada",
          description: "Tu solicitud de reservación ha sido enviada y está pendiente de aprobación",
          variant: "default",
        });
        
        // Invalidar las consultas relevantes
        queryClient.invalidateQueries({ queryKey: ["/api/reservation-requests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
        
        // Cerrar el modal y regresar al paso inicial
        setCurrentStep(0);
        onClose();
        return;
      }
      
      // Para otros roles, continuar con el flujo normal
      // Generate QR code for the reservation with public endpoint
      const reservationUrl = `${window.location.origin}/reservation-details?id=${data.id}`;
      console.log(`Generando código QR para URL: ${reservationUrl}`);
      QRCode.toDataURL(reservationUrl)
        .then((url: string) => {
          setQrCodeUrl(url);
          setSubmittedReservation(data);
          setCurrentStep(4); // Move to ticket screen
          
          queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
          queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
        })
        .catch((err: Error) => {
          console.error("Error generating QR code", err);
          setSubmittedReservation(data);
          setCurrentStep(4); // Move to ticket screen even without QR
        });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al procesar la solicitud",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle submitting the reservation
  const handleCompleteReservation = () => {
    // Validate all passengers have names
    if (!passengers.every(p => p.firstName && p.lastName)) {
      toast({
        title: "Información incompleta",
        description: "Por favor ingrese nombre y apellido para todos los pasajeros",
        variant: "destructive",
      });
      setCurrentStep(1); // Go back to passenger step
      return;
    }
    
    // Validar email solo si no está vacío
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email !== '' && !emailRegex.test(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor ingrese un correo electrónico válido o déjelo en blanco",
        variant: "destructive",
      });
      setCurrentStep(2); // Go back to contact step
      return;
    }
    
    // Validar teléfono normalizado
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      toast({
        title: "Teléfono inválido",
        description: "Por favor ingrese un número de teléfono válido de 10 dígitos",
        variant: "destructive",
      });
      setCurrentStep(2); // Go back to contact step
      return;
    }
    
    // Validate advance payment
    if (advanceAmount > totalPrice) {
      toast({
        title: "Monto de anticipo inválido",
        description: "El anticipo no puede ser mayor que el precio total",
        variant: "destructive",
      });
      setCurrentStep(2); // Go back to payment step
      return;
    }
    
    // Determine payment status based on advance amount
    let currentPaymentStatus: typeof PaymentStatus.PENDING | typeof PaymentStatus.PAID = PaymentStatus.PENDING;
    const finalPrice = couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice;
    if (advanceAmount >= finalPrice) {
      currentPaymentStatus = PaymentStatus.PAID;
    }
    
    // Obtener el ID del usuario autenticado actual usando el hook useAuth
    // Este ID se usará para registrar quién creó la reservación (para comisiones y temas administrativos)
    
    // Usamos el teléfono ya normalizado de la validación anterior
    
    // Calcular el precio total aplicando el descuento del cupón si corresponde
    const finalTotalPrice = couponVerified && couponDiscount > 0 
      ? totalPrice - couponDiscount 
      : totalPrice;
    
    const reservationData: ReservationFormData = {
      tripId: trip.id,
      numPassengers,
      passengers,
      email: email.trim() || null, // Guardar null si está vacío para consistencia
      phone: normalizedPhone, // Usar el teléfono ya normalizado
      totalAmount: finalTotalPrice,
      paymentMethod,
      paymentStatus: currentPaymentStatus,
      advanceAmount: advanceAmount,
      advancePaymentMethod: advanceAmount > 0 ? advancePaymentMethod : PaymentMethod.CASH,
      notes,
      createdBy: user?.id, // Usamos el ID del usuario actual desde el context de autenticación
      // Solo incluir el código de cupón si ha sido verificado
      couponCode: couponVerified ? couponCode : undefined
    };
    
    createReservationMutation.mutate(reservationData);
  };
  
  // Handle printing the ticket
  const handlePrintTicket = () => {
    const content = ticketRef.current;
    if (!content) {
      toast({
        title: "Error",
        description: "No se pudo generar el ticket",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Usamos setTimeout para desacoplar la apertura de la ventana del evento principal
      setTimeout(() => {
        const printWindow = openPrintWindow(content.innerHTML);
        if (!printWindow) {
          toast({
            title: "Error",
            description: "No se pudo abrir la ventana de impresión. Por favor, desactive el bloqueador de ventanas emergentes.",
            variant: "destructive",
          });
          return;
        }
      }, 100);
    } catch (error) {
      console.error("Error al imprimir:", error);
      toast({
        title: "Error al imprimir",
        description: "Ocurrió un error al intentar imprimir el ticket. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    }
  };
  
  // Handle downloading the ticket as PDF
  const handleDownloadTicket = async () => {
    // 1. Validar la existencia de la información de la reservación
    if (!reservation) {
      toast({
        title: "Error",
        description: "No se encontró la información de la reservación",
        variant: "destructive",
      });
      return;
    }

    try {
      // 2. Mostrar mensaje de carga mientras se genera el PDF
      toast({
        title: "Generando PDF...",
        description: "Por favor espera mientras se genera el boleto",
      });

      // 3. Importar jsPDF dinámicamente
      const { jsPDF } = await import('jspdf');

      // 4. Inicializar documento PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const outerMargin = 10;
      const innerPadding = 15;
      const ticketWidth = pageWidth - (outerMargin * 2);
      const ticketHeight = pageHeight - (outerMargin * 2);

      // 5. Definición de colores para el tema del boleto
      const colors = {
        primary: [59, 130, 246],    // blue-500
        text: [51, 51, 51],         // text-gray-800
        muted: [102, 102, 102],     // text-gray-500
        accent: [34, 139, 34],      // green-600
        border: [180, 180, 180],    // border-gray-300
        background: [255, 255, 255] // white
      };

      // 6. Funciones auxiliares para dibujar en el PDF
      // Función para dibujar texto con ajuste automático (word wrap)
      const drawTextWithWrap = (text, x, y, maxWidth, fontSize = 10) => {
        doc.setFontSize(fontSize);
        // `splitTextToSize` es un método de jsPDF que divide el texto para que quepa en un ancho dado
        const splitText = doc.splitTextToSize(text, maxWidth);
        doc.text(splitText, x, y);
        return y + (splitText.length * (fontSize * 0.35)); // Retorna la nueva posición Y después del texto
      };

      // Función para dibujar una sección con título y una línea divisoria
      const drawSection = (title, x, y, width) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.text);
        doc.text(title, x, y);

        doc.setDrawColor(...colors.border);
        doc.line(x, y + 2, x + width, y + 2); // Línea debajo del título

        return y + 10; // Retorna la posición inicial para el contenido de la sección
      };

      // Función para generar el ID de la reservación (ajusta según tu lógica)
      const generateReservationId = (id) => `R-${String(id).padStart(6, '0')}`;

      // Función para formatear fechas
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      // Función para formatear horas de viaje
      const formatTripTime = (timeString, showAmPm = true, style = 'short') => {
        if (!timeString) return 'N/A';
        // jsPDF tiene problemas con fechas sin día/mes/año, así que creamos una fecha dummy
        const date = new Date(`2000/01/01 ${timeString}`);
        if (isNaN(date.getTime())) return 'N/A'; // Validar si la fecha es inválida

        if (style === 'pretty') {
          return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: showAmPm });
        }
        return timeString; // Opcional: retornar solo la cadena si no se necesita formato
      };

      // Función para formatear precios
      const formatPrice = (price) => {
        if (typeof price !== 'number') return 'N/A';
        return price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      };

      // 7. Lógica principal para dibujar el contenido del ticket
      const drawTicketContent = () => {
        // Dibujar borde del boleto con esquinas redondeadas simuladas
        doc.setDrawColor(...colors.border);
        doc.setFillColor(...colors.background);
        doc.setLineWidth(1);
        doc.rect(outerMargin, outerMargin, ticketWidth, ticketHeight, 'FD'); // Dibuja y rellena el rectángulo principal

        // Establecer la posición Y inicial para el contenido
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

        // 8. División en dos columnas para el contenido principal
        const col1X = outerMargin + innerPadding;
        const col2X = pageWidth / 2 + 5;
        const colWidth = (ticketWidth / 2) - innerPadding - 5;

        // --- COLUMNA IZQUIERDA: Código QR ---
        const qrSize = 80;
        const qrX = col1X + (colWidth / 2) - (qrSize / 2); // Centrar QR en la columna
        const qrY = currentY;

        // Dibujar la imagen QR (o el placeholder si no se cargó)
        // (La lógica de carga/dibujo del QR se maneja fuera de esta función principal)

        // --- COLUMNA DERECHA: Información Principal ---
        let infoY = currentY; // Posición Y para el contenido de la columna derecha

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

        // Pasajeros adicionales (si existen)
        if (reservation.passengers.length > 1) {
          doc.setFont('helvetica', 'normal');
          reservation.passengers.slice(1).forEach((p, idx) => {
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            if (name) {
              doc.text(name, col2X + 25, infoY);
              infoY += 6;
            }
          });
        }
        infoY += 5;

        // Cantidad de asientos
        doc.setTextColor(...colors.muted);
        doc.text('Asientos:', col2X, infoY);
        doc.setTextColor(...colors.text);
        doc.text(`${reservation.passengers.length}`, col2X + 25, infoY);
        infoY += 8;

        // Información del viaje
        infoY += 5; // Espacio antes de la siguiente sección
        infoY = drawSection('INFORMACIÓN DEL VIAJE', col2X, infoY, colWidth);

        // Ruta (Origen - Destino)
        doc.setFontSize(10);
        doc.setTextColor(...colors.muted);

        const origin = reservation.trip.segmentOrigin || reservation.trip.route?.origin || 'N/A';
        const destination = reservation.trip.segmentDestination || reservation.trip.route?.destination || 'N/A';

        doc.text('Origen:', col2X, infoY);
        doc.setTextColor(...colors.text);
        infoY = drawTextWithWrap(origin, col2X + 25, infoY, colWidth - 25, 10);

        doc.setTextColor(...colors.muted);
        doc.text('Destino:', col2X, infoY + 5);
        doc.setTextColor(...colors.text);
        infoY = drawTextWithWrap(destination, col2X + 25, infoY + 5, colWidth - 25, 10);
        infoY += 3; // Ajusta el salto de línea final según sea necesario

        // Fecha del viaje
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

        // 9. Línea divisoria horizontal
        // Asegurar que la línea esté por debajo de ambas columnas
        currentY = Math.max(qrY + qrSize + 10, infoY + 10);
        doc.setDrawColor(...colors.border);
        doc.line(outerMargin + innerPadding, currentY, pageWidth - outerMargin - innerPadding, currentY);
        currentY += 15; // Espacio después de la línea

        // --- SECCIÓN INFERIOR: PAGO Y TÉRMINOS ---
        const paymentX = outerMargin + innerPadding;
        const termsX = pageWidth / 2 + 5;

        // Información de pago
        let paymentY = drawSection('INFORMACIÓN DE PAGO', paymentX, currentY, colWidth);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        // Detalles del pago (anticipo vs. total)
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

        // Monto Total
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

        const lineHeight = 4; // Espacio entre líneas para los términos
        const maxTermsY = pageHeight - outerMargin - innerPadding - 10; // Límite inferior para los términos

        terms.forEach(term => {
          if (termsY + lineHeight < maxTermsY) { // Asegurar que no se salga de la página
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

        // 10. Guardar el PDF
        const fileName = `boleto-${generateReservationId(reservation.id)}.pdf`;
        doc.save(fileName);

        // 11. Mostrar notificación de éxito
        toast({
          title: "PDF generado exitosamente",
          description: `El boleto ${generateReservationId(reservation.id)} se ha descargado`,
        });
      }; // Fin de drawTicketContent

      // 12. Generar URL del QR (asumiendo que `window.location.origin` está disponible)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/reservation-details?id=' + reservation.id)}`;

      // 13. Intentar cargar la imagen del QR
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Necesario para evitar problemas CORS

      img.onload = () => {
        try {
          // Si la imagen carga correctamente, la añadimos al PDF
          doc.addImage(img, 'PNG', qrX, qrY, qrSize, qrSize);
          drawTicketContent(); // Una vez el QR está listo, se dibuja el resto del contenido
        } catch (error) {
          console.warn('Error al insertar imagen QR:', error);
          // Si hay un error al añadir la imagen (ej. corrupción), dibujar placeholder
          drawQRPlaceholder();
          drawTicketContent();
        }
      };

      img.onerror = () => {
        // Si la imagen no carga, dibujar un placeholder para el QR
        console.warn('Error al cargar QR code, usando placeholder');
        drawQRPlaceholder();
        drawTicketContent();
      };

      // 14. Función para dibujar el placeholder del QR
      const drawQRPlaceholder = () => {
        doc.setFillColor(100, 100, 100); // Color gris oscuro
        doc.rect(qrX, qrY, qrSize, qrSize, 'F'); // Dibuja un rectángulo
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255); // Texto blanco
        doc.text('QR CODE', qrX + qrSize / 2, qrY + qrSize / 2 - 3, { align: 'center' });
        doc.text('NO DISPONIBLE', qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: 'center' });
      };

      // 15. Asignar la URL a la imagen para que comience la carga
      img.src = qrUrl;

      // 16. Implementar un timeout para manejar casos en los que el QR no carga
      // Esto asegura que el PDF se genere incluso si el servicio de QR falla
      setTimeout(() => {
        if (!img.complete && img.src === qrUrl) { // Solo si la imagen no se ha completado y es la misma URL
          img.onerror(); // Forzar el error para dibujar el placeholder
        }
      }, 5000); // 5 segundos de espera para la carga del QR

    } catch (error) {
      // 17. Manejo de errores generales al generar el PDF
      console.error('Error general al generar PDF:', error);

      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error. Intentando método alternativo...",
        variant: "destructive",
      });

      // 18. Método alternativo: abrir la página de detalles de la reservación en una nueva ventana para imprimir
      try {
        const ticketUrl = `/reservation-details?id=${reservation.id}&print=true`;
        const printWindow = window.open(ticketUrl, '_blank', 'width=800,height=600');

        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print(); // Intentar imprimir automáticamente
            }, 1000); // Pequeño retraso para asegurar que la página se cargue
          };
        }
      } catch (fallbackError) {
        // Si el método alternativo también falla
        toast({
          title: "Error",
          description: "No se pudo generar el boleto. Por favor, intente nuevamente.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Función para verificar el código del cupón
  const verifyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Código vacío",
        description: "Por favor ingrese un código de cupón",
        variant: "destructive",
      });
      return;
    }
    
    setIsVerifyingCoupon(true);
    
    try {
      const response = await apiRequest("GET", `/api/coupons/validate/${couponCode.trim()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Cupón inválido",
          description: errorData.message || "El código de cupón no es válido",
          variant: "destructive",
        });
        setCouponVerified(false);
        setCouponDiscount(0);
      } else {
        const couponData = await response.json();
        setCouponVerified(true);
        
        // Calcular el descuento basado en el tipo de cupón
        let discountAmount = 0;
        if (couponData.discountType === 'percentage') {
          discountAmount = (totalPrice * couponData.discountValue) / 100;
        } else {
          discountAmount = Math.min(couponData.discountValue, totalPrice);
        }
        
        setCouponDiscount(discountAmount);
        
        toast({
          title: "Cupón válido",
          description: couponData.discountType === 'percentage'
            ? `Descuento del ${couponData.discountValue}% aplicado`
            : `Descuento de ${formatPrice(couponData.discountValue)} aplicado`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error al verificar el cupón:", error);
      toast({
        title: "Error",
        description: "No se pudo verificar el código de cupón",
        variant: "destructive",
      });
      setCouponVerified(false);
      setCouponDiscount(0);
    } finally {
      setIsVerifyingCoupon(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    // Reset form only if we're not on the last step
    if (currentStep < 4) {
      setCurrentStep(0);
      setNumPassengers(1);
      setPassengers([{ firstName: "", lastName: "" }]);
      setEmail("");
      setPhone("");
      setPaymentMethod(PaymentMethod.CASH);
      setNotes("");
      // Reset payment-related fields
      setAdvanceAmount(0);
      setAdvancePaymentMethod(PaymentMethod.CASH);
      setPaymentStatus(PaymentStatus.PENDING);
      // Reset coupon-related fields
      setHasCoupon(false);
      setCouponCode("");
      setCouponDiscount(0);
      setCouponVerified(false);
    }
    
    onClose();
  };
  
  // Calculate total price
  const totalPrice = numPassengers * (trip.price || 0);
  
  // Format reservation ID
  const formatReservationId = (id: number) => {
    return `R-${id.toString().padStart(6, '0')}`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {currentStep < 4 ? (
          <>
            <DialogHeader>
              <DialogTitle>Reservar Viaje</DialogTitle>
              <DialogDescription>
                {currentStep === 0 && "Confirme los detalles del viaje"}
                {currentStep === 1 && "Ingrese la información de los pasajeros"}
                {currentStep === 2 && "Ingrese la información de contacto"}
                {currentStep === 3 && "Confirme la reservación"}
              </DialogDescription>
            </DialogHeader>
            
            {/* Progress Indicator */}
            <div className="w-full bg-gray-200 h-2 rounded-full mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((currentStep + 1) / 4) * 100}%` }}
              ></div>
            </div>
            
            {/* Step 1: Trip Details */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <InfoIcon className="w-12 h-12 text-primary opacity-80 mb-2" />
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Ruta:</div>
                    <div className="font-medium">{trip.route.name}</div>
                    <div className="text-gray-500">Fecha:</div>
                    <div className="font-medium">{formatDate(trip.departureDate)}</div>
                    <div className="text-gray-500">Salida:</div>
                    <div className="font-medium">{formatTripTime(trip.departureTime, true, "pretty")}</div>
                    <div className="text-gray-500">Llegada:</div>
                    <div className="font-medium">{formatTripTime(trip.arrivalTime, true, "pretty")}</div>
                    <div className="text-gray-500">Precio por pasajero:</div>
                    <div className="font-medium">{formatPrice(trip.price)}</div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-md p-4">
                  <Label htmlFor="num-passengers" className="block mb-2">Número de Pasajeros</Label>
                  <Select
                    value={numPassengers.toString()}
                    onValueChange={handlePassengersChange}
                  >
                    <SelectTrigger id="num-passengers">
                      <SelectValue placeholder="Seleccionar cantidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} {i === 0 ? "Pasajero" : "Pasajeros"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {/* Step 2: Passenger Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <UsersIcon className="w-12 h-12 text-primary opacity-80 mb-2" />
                </div>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {passengers.map((passenger, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-4">
                      <div className="font-medium mb-3">
                        Pasajero {index + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`first-name-${index}`}>Nombre</Label>
                          <Input
                            id={`first-name-${index}`}
                            value={passenger.firstName}
                            onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                            placeholder="Nombre"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`last-name-${index}`}>Apellido</Label>
                          <Input
                            id={`last-name-${index}`}
                            value={passenger.lastName}
                            onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                            placeholder="Apellido"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Step 3: Contact Information and Payment */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <InfoIcon className="w-12 h-12 text-primary opacity-80 mb-2" />
                </div>
                
                <div className="border border-gray-200 rounded-md p-4 space-y-4">
                  <div>
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="1234567890"
                    />
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 mt-2">
                    <h3 className="font-medium text-gray-800 mb-3">Información de Pago</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="advance-amount">Monto de Anticipo</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="advance-amount"
                            type="number"
                            min="0"
                            max={couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice}
                            step="0.01"
                            className={`pl-8 ${advanceAmount > (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? 'border-red-500' : ''}`}
                            value={advanceAmount}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              // Calcular el precio final considerando el descuento
                              const finalPrice = couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice;
                              
                              // No permitir que el anticipo sea mayor al precio total con descuento aplicado
                              if (value <= finalPrice) {
                                setAdvanceAmount(value);
                                // Actualizar el estado de pago automáticamente
                                if (value === finalPrice) {
                                  setPaymentStatus(PaymentStatus.PAID);
                                } else {
                                  setPaymentStatus(PaymentStatus.PENDING);
                                }
                              } else {
                                // Mostrar mensaje de error
                                toast({
                                  title: "Error en el anticipo",
                                  description: "El anticipo no puede ser mayor al precio total",
                                  variant: "destructive"
                                });
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="mt-1 text-xs text-gray-500 flex justify-between">
                          <span>Mínimo: $0</span>
                          <span>Máximo: {formatPrice(couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice)}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="advance-payment-method">Método de Pago del Anticipo</Label>
                        <Select
                          value={advancePaymentMethod}
                          onValueChange={(value: typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER) => setAdvancePaymentMethod(value)}
                          disabled={advanceAmount <= 0}
                        >
                          <SelectTrigger id="advance-payment-method">
                            <SelectValue placeholder="Seleccione método de pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                            <SelectItem value={PaymentMethod.TRANSFER}>Transferencia Bancaria</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="payment-method">Método de Pago</Label>
                        <Select
                          value={paymentMethod}
                          onValueChange={(value: typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER) => setPaymentMethod(value)}
                          disabled={advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice)}
                        >
                          <SelectTrigger id="payment-method">
                            <SelectValue placeholder="Seleccione método de pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                            <SelectItem value={PaymentMethod.TRANSFER}>Transferencia Bancaria</SelectItem>
                          </SelectContent>
                        </Select>
                        {advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) && (
                          <p className="text-xs text-gray-500 mt-1">
                            No es necesario método de pago adicional ya que el anticipo cubre el monto total.
                          </p>
                        )}
                      </div>
                      
                      {/* Sección de cupón - Movida aquí después del método de pago */}
                      <div className="border-t border-gray-200 pt-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="has-coupon"
                              checked={hasCoupon}
                              onChange={(e) => {
                                setHasCoupon(e.target.checked);
                                if (!e.target.checked) {
                                  setCouponCode("");
                                  setCouponVerified(false);
                                  setCouponDiscount(0);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="has-coupon" className="cursor-pointer">Tengo un cupón</Label>
                          </div>
                        </div>
                        
                        {hasCoupon && (
                          <div className="mt-3 space-y-2">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Input
                                  id="coupon-code"
                                  value={couponCode}
                                  onChange={(e) => {
                                    setCouponCode(e.target.value);
                                    // Si ya estaba verificado, al cambiar el código se invalida
                                    if (couponVerified) {
                                      setCouponVerified(false);
                                      setCouponDiscount(0);
                                    }
                                  }}
                                  placeholder="Ingrese código de cupón"
                                  className={couponVerified ? "border-green-500 bg-green-50" : ""}
                                  disabled={isVerifyingCoupon}
                                />
                              </div>
                              <Button 
                                onClick={verifyCoupon}
                                disabled={!couponCode.trim() || isVerifyingCoupon || couponVerified}
                                variant={couponVerified ? "outline" : "default"}
                                className={couponVerified ? "border-green-500 text-green-600" : ""}
                              >
                                {isVerifyingCoupon ? (
                                  <>Verificando...</>
                                ) : couponVerified ? (
                                  <>Verificado</>
                                ) : (
                                  <>Verificar</>
                                )}
                              </Button>
                            </div>
                            
                            {couponVerified && couponDiscount > 0 && (
                              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                                Descuento aplicado: {formatPrice(couponDiscount)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded border border-blue-200 text-blue-800 text-sm mt-4">
                        {/* Calcular el precio final considerando el descuento del cupón */}
                        {advanceAmount === (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? (
                          <p>El pago será registrado como <strong>PAGADO</strong> ya que el anticipo cubre el monto total.</p>
                        ) : advanceAmount > 0 ? (
                          <p>El pago será registrado como <strong>PENDIENTE</strong> con un anticipo de {formatPrice(advanceAmount)}. Saldo restante: {formatPrice((couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) - advanceAmount)}.</p>
                        ) : (
                          <p>El pago será registrado como <strong>PENDIENTE</strong> por un monto total de {formatPrice(couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice)}.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notas adicionales</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas o instrucciones especiales"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 4: Confirmation */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <CreditCardIcon className="w-12 h-12 text-primary opacity-80 mb-2" />
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Ruta:</div>
                    <div className="font-medium">{trip.route.name}</div>
                    <div className="text-gray-500">Origen:</div>
                    <div className="font-medium">{trip.segmentOrigin || trip.route.origin}</div>
                    <div className="text-gray-500">Destino:</div>
                    <div className="font-medium">{trip.segmentDestination || trip.route.destination}</div>
                    <div className="text-gray-500">Fecha:</div>
                    <div className="font-medium">{formatDate(trip.departureDate)}</div>
                    <div className="text-gray-500">Salida:</div>
                    <div className="font-medium">{formatTripTime(trip.departureTime, true, "pretty")}</div>
                    <div className="text-gray-500">Llegada:</div>
                    <div className="font-medium">{formatTripTime(trip.arrivalTime, true, "pretty")}</div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-md p-4">
                  <h4 className="font-medium mb-2">Pasajeros</h4>
                  <div className="text-sm space-y-1">
                    {passengers.map((passenger, index) => (
                      <div key={index}>
                        {index + 1}. {passenger.firstName} {passenger.lastName}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-md p-4">
                  <h4 className="font-medium mb-2">Información de Contacto</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Correo:</div>
                    <div>{email}</div>
                    <div className="text-gray-500">Teléfono:</div>
                    <div>{phone}</div>
                    <div className="text-gray-500">Método de Pago:</div>
                    <div>{paymentMethod === PaymentMethod.CASH ? "Efectivo" : "Transferencia Bancaria"}</div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-md p-4">
                  <h4 className="font-medium mb-2">Información de Pago</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="text-gray-500">Subtotal:</div>
                    <div className={`${couponVerified && couponDiscount > 0 ? '' : 'font-bold'}`}>{formatPrice(totalPrice)}</div>
                    
                    {couponVerified && couponDiscount > 0 && (
                      <>
                        <div className="text-gray-500">Cupón aplicado:</div>
                        <div className="text-green-600 font-mono">{couponCode}</div>
                        
                        <div className="text-gray-500">Descuento:</div>
                        <div className="text-green-600">-{formatPrice(couponDiscount)}</div>
                        
                        <div className="text-gray-500">Total con descuento:</div>
                        <div className="font-bold">{formatPrice(totalPrice - couponDiscount)}</div>
                      </>
                    )}
                    
                    {advanceAmount > 0 && (
                      <>
                        <div className="text-gray-500">Anticipo:</div>
                        <div>{formatPrice(advanceAmount)}</div>
                        
                        <div className="text-gray-500">Método de anticipo:</div>
                        <div>{advancePaymentMethod === PaymentMethod.CASH ? "Efectivo" : "Transferencia Bancaria"}</div>
                        
                        <div className="text-gray-500">Saldo pendiente:</div>
                        <div>{formatPrice((couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) - advanceAmount)}</div>
                        
                        <div className="text-gray-500">Estado de pago:</div>
                        <div className={advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                          {advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? "PAGADO" : "PENDIENTE"}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {paymentMethod === PaymentMethod.TRANSFER || (advanceAmount > 0 && advancePaymentMethod === PaymentMethod.TRANSFER) ? (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-blue-800">
                      <p className="font-medium mb-1">Información bancaria para transferencias:</p>
                      <p>Banco: BBVA</p>
                      <p>Titular: TransRoute S.A. de C.V.</p>
                      <p>CLABE: 0123 4567 8901 2345 67</p>
                      <p>Concepto: REF-{sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')!).id : 'USUARIO'}-{new Date().getTime().toString().slice(-6)}</p>
                    </div>
                  ) : null}
                </div>
                
                <div className="bg-primary/10 p-4 rounded-md">
                  {couponVerified && couponDiscount > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">Subtotal ({numPassengers} pasajeros):</div>
                        <div className="text-md">{formatPrice(totalPrice)}</div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-sm font-medium text-green-600">Descuento:</div>
                        <div className="text-md text-green-600">-{formatPrice(couponDiscount)}</div>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-primary/20">
                        <div className="text-sm font-medium">Total con descuento:</div>
                        <div className="text-lg font-bold text-green-600">{formatPrice(totalPrice - couponDiscount)}</div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Total ({numPassengers} pasajeros):</div>
                      <div className="text-lg font-bold">{formatPrice(totalPrice)}</div>
                    </div>
                  )}
                  
                  {advanceAmount > 0 && advanceAmount < (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary/20">
                      <div className="text-sm font-medium">Saldo por pagar:</div>
                      <div className="text-lg font-bold">{formatPrice((couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) - advanceAmount)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              {currentStep > 0 && (
                <Button 
                  variant="outline" 
                  onClick={goToPreviousStep}
                  className="sm:mr-auto"
                >
                  <ChevronLeftIcon className="w-4 h-4 mr-2" />
                  Atrás
                </Button>
              )}
              
              <Button 
                onClick={currentStep < 3 ? goToNextStep : handleCompleteReservation}
                disabled={createReservationMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createReservationMutation.isPending ? (
                  "Procesando..."
                ) : currentStep < 3 ? (
                  <>
                    Siguiente
                    <ChevronRightIcon className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  "Confirmar Reservación"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Step 5: Ticket */}
            <DialogHeader>
              <div className="flex items-center justify-center mb-2">
                <CheckCircleIcon className="w-10 h-10 text-green-500" />
              </div>
              <DialogTitle className="text-center">¡Reservación Confirmada!</DialogTitle>
              <DialogDescription className="text-center">
                Su reservación ha sido procesada exitosamente.
              </DialogDescription>
            </DialogHeader>
            
            <div className="my-6">
              {/* Ticket Preview */}
              <div 
                ref={ticketRef}
                className="border-2 border-gray-200 rounded-lg p-6 max-w-md mx-auto bg-white"
              >
                <div className="text-center border-b border-gray-200 pb-4 mb-6">
                  <h3 className="text-2xl font-bold text-primary">TransRoute</h3>
                  <p className="text-sm text-gray-600 mt-1">Boleto de Viaje Oficial</p>
                </div>
                
                {qrCodeUrl && (
                  <div className="flex justify-center mb-6">
                    <div className="p-2 bg-white border border-gray-200 rounded shadow-sm">
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        className="w-40 h-40"
                      />
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">
                    #{submittedReservation && formatReservationId(submittedReservation.id)}
                  </h3>
                  <div className="text-lg font-semibold">
                    {passengers.map((passenger, index) => (
                      <span key={index}>
                        {passenger.firstName} {passenger.lastName}
                        {index < passengers.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4 mb-6">
                  {/* Información del pasajero */}
                  <div>
                    <h4 className="text-lg font-medium mb-2">Información del Pasajero</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Contacto:</div>
                        <div className="break-words">{email}</div>
                        <div>{phone}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Pasajeros:</div>
                        <div>{numPassengers}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detalles del viaje */}
                  <div>
                    <h4 className="text-lg font-medium mb-2">Detalles del Viaje</h4>
                    <div className="space-y-2">                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Origen:</div>
                          <div>{trip.segmentOrigin || trip.route.origin}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Destino:</div>
                          <div>{trip.segmentDestination || trip.route.destination}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Fecha:</div>
                          <div>{formatDateLong(trip.departureDate)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Hora:</div>
                          <div>{formatTripTime(trip.departureTime, true, "pretty")}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Información de pago */}
                  <div>
                    <h4 className="text-lg font-medium mb-2">Información de Pago</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
                      <div>
                        <div className="text-sm text-gray-500">Subtotal:</div>
                        <div className={`${couponVerified && couponDiscount > 0 ? '' : 'text-lg font-bold'}`}>
                          {formatPrice(totalPrice)}
                        </div>
                      </div>
                      
                      {couponVerified && couponDiscount > 0 && (
                        <>
                          <div className="col-span-1 sm:col-span-2">
                            <div className="text-sm text-gray-500">Cupón aplicado:</div>
                            <div className="text-green-600 font-mono">{couponCode}</div>
                          </div>
                          <div>
                            <div className="text-sm text-green-600">Descuento:</div>
                            <div className="text-green-600">-{formatPrice(couponDiscount)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Total con descuento:</div>
                            <div className="text-lg font-bold text-green-600">{formatPrice(totalPrice - couponDiscount)}</div>
                          </div>
                        </>
                      )}
                      
                      {!couponVerified && (
                        <div>
                          <div className="text-sm text-gray-500">Método de pago:</div>
                          <div>{paymentMethod === PaymentMethod.CASH ? "Efectivo" : "Transferencia"}</div>
                        </div>
                      )}
                      
                      {advanceAmount > 0 && (
                        <>
                          <div>
                            <div className="text-sm text-gray-500">Anticipo:</div>
                            <div className="font-medium">{formatPrice(advanceAmount)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Método anticipo:</div>
                            <div>{advancePaymentMethod === PaymentMethod.CASH ? "Efectivo" : "Transferencia"}</div>
                          </div>
                          
                          {advanceAmount < (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) && (
                            <>
                              <div>
                                <div className="text-sm text-gray-500">Pendiente:</div>
                                <div className="font-medium">
                                  {formatPrice((couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) - advanceAmount)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Método pago final:</div>
                                <div>{paymentMethod === PaymentMethod.CASH ? "Efectivo" : "Transferencia"}</div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Estado de pago grande */}
                <div className="text-center mb-6">
                  <h5 className="text-sm text-gray-500 mb-2">Estado:</h5>
                  <div className={`text-2xl font-bold ${advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? 'text-green-500' : 'text-amber-500'}`}>
                    {advanceAmount >= (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) ? 'PAGADO' : 'PENDIENTE'}
                  </div>
                </div>
                
                {(paymentMethod === PaymentMethod.TRANSFER || (advanceAmount > 0 && advancePaymentMethod === PaymentMethod.TRANSFER)) && (
                  <div className="mt-4 mb-4 p-3 border border-blue-200 rounded bg-blue-50 text-xs text-blue-800">
                    <p className="font-semibold mb-1">Información Bancaria:</p>
                    <p>Banco: BBVA</p>
                    <p>Titular: TransRoute S.A. de C.V.</p>
                    <p>CLABE: 0123 4567 8901 2345 67</p>
                    <p className="mt-1">Verifica tu pago: 555-123-4567</p>
                  </div>
                )}
                
                <div className="border-t pt-4 text-xs text-center text-gray-500">
                  <p>Presente este boleto al abordar el vehículo</p>
                  {advanceAmount > 0 && advanceAmount < (couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) && (
                    <p className="mt-1 text-amber-600 font-semibold">
                      IMPORTANTE: Complete el pago restante de {formatPrice((couponVerified && couponDiscount > 0 ? totalPrice - couponDiscount : totalPrice) - advanceAmount)} antes de abordar
                    </p>
                  )}
                  <p className="mt-1">TransRoute © {new Date().getFullYear()}</p>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrintTicket} 
                className="w-full sm:w-auto"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Imprimir Boleto
              </Button>
              <Button 
                onClick={handleDownloadTicket}
                className="w-full sm:w-auto"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Descargar Boleto
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}