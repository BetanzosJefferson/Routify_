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
  email: string;
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9]{10}$/;
        return emailRegex.test(email) && phoneRegex.test(phone);
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
        const phoneRegex = /^[0-9]{10}$/;
        if (!emailRegex.test(email)) return "Por favor, ingrese un correo electrónico válido";
        if (!phoneRegex.test(phone)) return "Por favor, ingrese un número de teléfono válido (10 dígitos)";
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
    
    // Validate email and phone
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor ingrese un correo electrónico válido",
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
    
    // Calcular el precio total aplicando el descuento del cupón si corresponde
    const finalTotalPrice = couponVerified && couponDiscount > 0 
      ? totalPrice - couponDiscount 
      : totalPrice;
    
    const reservationData: ReservationFormData = {
      tripId: trip.id,
      numPassengers,
      passengers,
      email,
      phone,
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
  const handleDownloadTicket = () => {
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
      // Utilizamos la misma función que para imprimir, ya que el navegador
      // permite guardar como PDF al imprimir
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
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error al intentar generar el PDF. Por favor, intente nuevamente.",
        variant: "destructive",
      });
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
                    <div className="font-medium">{trip.departureTime}</div>
                    <div className="text-gray-500">Llegada:</div>
                    <div className="font-medium">{trip.arrivalTime}</div>
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
                    <div className="font-medium">{trip.departureTime}</div>
                    <div className="text-gray-500">Llegada:</div>
                    <div className="font-medium">{trip.arrivalTime}</div>
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
                          <div>{trip.departureTime}</div>
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