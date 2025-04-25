import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";
import { TripWithRouteInfo } from "@shared/schema";
import QRCode from "qrcode";

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

interface ReservationFormData {
  tripId: number;
  numPassengers: number;
  passengers: Passenger[];
  email: string;
  phone: string;
  paymentMethod: "cash" | "transfer";
  notes: string;
}

export function ReservationStepsModal({ trip, isOpen, onClose }: ReservationStepsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ticketRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [numPassengers, setNumPassengers] = useState(1);
  const [passengers, setPassengers] = useState<Passenger[]>([{ firstName: "", lastName: "" }]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [notes, setNotes] = useState("");
  
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
      const response = await apiRequest("POST", "/api/reservations", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create reservation");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Generate QR code for the reservation
      const reservationUrl = `${window.location.origin}/reservations/${data.id}`;
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
        title: "Error creating reservation",
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
        title: "Missing information",
        description: "Please enter names for all passengers",
        variant: "destructive",
      });
      setCurrentStep(1); // Go back to passenger step
      return;
    }
    
    // Validate email and phone
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      setCurrentStep(2); // Go back to contact step
      return;
    }
    
    const reservationData: ReservationFormData = {
      tripId: trip.id,
      numPassengers,
      passengers,
      email,
      phone,
      paymentMethod,
      notes
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
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast({
            title: "Error",
            description: "No se pudo abrir la ventana de impresión. Por favor, desactive el bloqueador de ventanas emergentes.",
            variant: "destructive",
          });
          return;
        }
        
        // Agregamos el contenido del ticket a la nueva ventana con estilos mejorados
        printWindow.document.write(`
          <html>
            <head>
              <title>Ticket de Reservación</title>
              <style>
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .ticket { border: 1px solid #ccc; padding: 20px; max-width: 400px; margin: 0 auto; background-color: white; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #333; }
                .qr-code { text-align: center; margin: 20px 0; }
                .qr-code img { max-width: 150px; }
                .details { margin-bottom: 20px; }
                .detail-row { display: flex; margin-bottom: 10px; }
                .detail-label { font-weight: bold; width: 120px; color: #555; }
                .passengers { margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; }
                .passenger-item { padding: 5px 0; }
                .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="ticket">
                ${content.innerHTML}
              </div>
              <script>
                // Esperar un poco para que se carguen los estilos y el contenido
                setTimeout(() => {
                  try {
                    window.print();
                    window.onfocus = function() { 
                      setTimeout(function() { window.close(); }, 500);
                    };
                  } catch (e) {
                    console.error("Error al imprimir:", e);
                  }
                }, 500);
              </script>
            </body>
          </html>
        `);
        
        printWindow.document.close();
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
      // Abrimos una nueva ventana con estilos controlados para evitar problemas de formato
      // Usamos setTimeout para desacoplar la apertura de la ventana del evento principal
      setTimeout(() => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast({
            title: "Error",
            description: "No se pudo abrir la ventana de impresión. Por favor, desactive el bloqueador de ventanas emergentes.",
            variant: "destructive",
          });
          return;
        }
        
        // Agregamos el contenido del ticket a la nueva ventana con estilos mejorados
        printWindow.document.write(`
          <html>
            <head>
              <title>Ticket de Reservación</title>
              <style>
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .ticket { border: 1px solid #ccc; padding: 20px; max-width: 400px; margin: 0 auto; background-color: white; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #333; }
                .qr-code { text-align: center; margin: 20px 0; }
                .qr-code img { max-width: 150px; }
                .details { margin-bottom: 20px; }
                .detail-row { display: flex; margin-bottom: 10px; }
                .detail-label { font-weight: bold; width: 120px; color: #555; }
                .passengers { margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; }
                .passenger-item { padding: 5px 0; }
                .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="ticket">
                ${content.innerHTML}
              </div>
              <script>
                // Esperar un poco para que se carguen los estilos y el contenido
                setTimeout(() => {
                  try {
                    window.print();
                    window.onfocus = function() { 
                      setTimeout(function() { window.close(); }, 500);
                    };
                  } catch (e) {
                    console.error("Error al imprimir:", e);
                  }
                }, 500);
              </script>
            </body>
          </html>
        `);
        
        printWindow.document.close();
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
  
  // Handle modal close
  const handleClose = () => {
    // Reset form only if we're not on the last step
    if (currentStep < 4) {
      setCurrentStep(0);
      setNumPassengers(1);
      setPassengers([{ firstName: "", lastName: "" }]);
      setEmail("");
      setPhone("");
      setPaymentMethod("cash");
      setNotes("");
    }
    
    onClose();
  };
  
  // Calculate total price
  const totalPrice = numPassengers * trip.price;
  
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
            
            {/* Step 3: Contact Information */}
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
                  
                  <div>
                    <Label htmlFor="payment-method">Método de Pago</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value: "cash" | "transfer") => setPaymentMethod(value)}
                    >
                      <SelectTrigger id="payment-method">
                        <SelectValue placeholder="Seleccione método de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <div>{paymentMethod === "cash" ? "Efectivo" : "Transferencia Bancaria"}</div>
                  </div>
                </div>
                
                <div className="bg-primary/10 p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">Total ({numPassengers} pasajeros):</div>
                    <div className="text-lg font-bold">{formatPrice(totalPrice)}</div>
                  </div>
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
                
                <div className="mb-5 bg-gray-50 p-3 rounded-md border border-gray-200">
                  <h4 className="font-bold text-sm text-gray-500 mb-1">Código de Reservación</h4>
                  <p className="text-2xl font-mono text-primary font-bold tracking-wider">
                    {submittedReservation && formatReservationId(submittedReservation.id)}
                  </p>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Ruta:</span>
                    <span className="col-span-2">{trip.route.name}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Origen:</span>
                    <span className="col-span-2">{trip.segmentOrigin || trip.route.origin}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Destino:</span>
                    <span className="col-span-2">{trip.segmentDestination || trip.route.destination}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Fecha:</span>
                    <span className="col-span-2">{formatDate(trip.departureDate)}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Salida:</span>
                    <span className="col-span-2">{trip.departureTime}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Llegada:</span>
                    <span className="col-span-2">{trip.arrivalTime}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm border-t pt-2 mt-2">
                    <span className="font-semibold text-gray-500">Pasajeros:</span>
                    <span className="col-span-2">{numPassengers}</span>
                  </div>
                  <div className="space-y-1 ml-4 mt-1">
                    {passengers.map((passenger, index) => (
                      <div key={index} className="text-sm">
                        {index + 1}. {passenger.firstName} {passenger.lastName}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 text-sm border-t pt-2 mt-2">
                    <span className="font-semibold text-gray-500">Contacto:</span>
                    <span className="col-span-2">{email}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Teléfono:</span>
                    <span className="col-span-2">{phone}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="font-semibold text-gray-500">Pago:</span>
                    <span className="col-span-2">{paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm border-t pt-2 mt-2">
                    <span className="font-semibold text-gray-500">Total:</span>
                    <span className="col-span-2 font-bold">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 text-xs text-center text-gray-500">
                  <p>Presente este boleto al abordar el vehículo</p>
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