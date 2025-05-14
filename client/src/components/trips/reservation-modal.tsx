import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";
import { TripWithRouteInfo } from "@shared/schema";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReservationModalProps {
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
  notes?: string;
}

export function ReservationModal({ trip, isOpen, onClose }: ReservationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [numPassengers, setNumPassengers] = useState(1);
  const [passengers, setPassengers] = useState<Passenger[]>([{ firstName: "", lastName: "" }]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [notes, setNotes] = useState("");
  
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
  
  // Reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: async (data: ReservationFormData) => {
      return await apiRequest<any>("POST", "/api/reservations", data);
    },
    onSuccess: () => {
      toast({
        title: "Reservation completed",
        description: "Your reservation has been successfully created.",
      });
      
      // Reset form and close modal
      setNumPassengers(1);
      setPassengers([{ firstName: "", lastName: "" }]);
      setEmail("");
      setPhone("");
      setNotes("");
      onClose();
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
    },
    onError: (error) => {
      toast({
        title: "Reservation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const handleCompleteReservation = () => {
    // Basic validation
    if (!email || !phone) {
      toast({
        title: "Missing information",
        description: "Please provide email and phone number.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate passenger information
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].firstName || !passengers[i].lastName) {
        toast({
          title: "Missing passenger information",
          description: `Please provide complete information for passenger ${i + 1}.`,
          variant: "destructive",
        });
        return;
      }
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reserve Trip</DialogTitle>
          <DialogDescription>
            Please fill in the reservation details for this trip.
          </DialogDescription>
        </DialogHeader>
        
        {/* Trip Details */}
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">Route:</div>
            <div className="font-medium">{trip.route.name}</div>
            <div className="text-gray-500">Date:</div>
            <div className="font-medium">{formatDate(trip.departureDate)}</div>
            <div className="text-gray-500">Departure:</div>
            <div className="font-medium">{formatTripTime(trip.departureTime, true, 'pretty')}</div>
            <div className="text-gray-500">Arrival:</div>
            <div className="font-medium">{formatTripTime(trip.arrivalTime, true, 'pretty')}</div>
            <div className="text-gray-500">Price per passenger:</div>
            <div className="font-medium">{formatPrice(trip.price)}</div>
          </div>
        </div>
        
        {/* Reservation Form */}
        <div className="space-y-4">
          {/* Number of Passengers */}
          <div className="space-y-2">
            <Label htmlFor="numPassengers">Number of Passengers</Label>
            <Select 
              value={numPassengers.toString()} 
              onValueChange={handlePassengersChange}
            >
              <SelectTrigger id="numPassengers">
                <SelectValue placeholder="Select number of passengers" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.min(trip.availableSeats, 10) }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? "Passenger" : "Passengers"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Passenger Information */}
          <div className="space-y-3">
            {passengers.map((passenger, index) => (
              <div 
                key={index} 
                className="mb-4 p-3 border border-gray-200 rounded-md"
              >
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Passenger {index + 1}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`firstName${index}`}>First Name</Label>
                    <Input
                      id={`firstName${index}`}
                      placeholder="First name"
                      value={passenger.firstName}
                      onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`lastName${index}`}>Last Name</Label>
                    <Input
                      id={`lastName${index}`}
                      placeholder="Last name"
                      value={passenger.lastName}
                      onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Contact Information</h4>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as "cash" | "transfer")}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Seleccione método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales</Label>
              <Input
                id="notes"
                placeholder="Notas o instrucciones especiales"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          
          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total:</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatPrice(trip.price * numPassengers)}
              </span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            className="bg-primary hover:bg-primary-dark"
            onClick={handleCompleteReservation}
            disabled={createReservationMutation.isPending}
          >
            {createReservationMutation.isPending ? "Processing..." : "Complete Reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
