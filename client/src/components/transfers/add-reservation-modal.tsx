import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  reservationId: z.number().min(1, "Debes seleccionar una reservación"),
  originalOrigin: z.string().min(1, "El origen original es obligatorio"),
  originalDestination: z.string().min(1, "El destino original es obligatorio"),
  newOrigin: z.string().min(1, "El nuevo origen es obligatorio"),
  newDestination: z.string().min(1, "El nuevo destino es obligatorio"),
});

interface AddReservationModalProps {
  transferId: number;
  sourceTripId: number;
  isOpen: boolean;
  onClose: () => void;
  onReservationAdded: () => void;
}

export const AddReservationModal = ({ 
  transferId, 
  sourceTripId, 
  isOpen, 
  onClose, 
  onReservationAdded 
}: AddReservationModalProps) => {
  const { toast } = useToast();
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reservationId: 0,
      originalOrigin: "",
      originalDestination: "",
      newOrigin: "",
      newDestination: "",
    },
  });
  
  // Consulta para obtener reservaciones del viaje de origen
  const { data: reservations, isLoading: isLoadingReservations } = useQuery({
    queryKey: [`/api/trips/${sourceTripId}/reservations`],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${sourceTripId}/reservations`);
      if (!response.ok) {
        throw new Error("Error al cargar reservaciones");
      }
      return response.json();
    },
    enabled: isOpen,
    refetchOnWindowFocus: false,
  });
  
  // Consulta para obtener detalles de la transferencia (para las rutas)
  const { data: transfer } = useQuery({
    queryKey: [`/api/transfers/${transferId}`],
    queryFn: async () => {
      const response = await fetch(`/api/transfers/${transferId}`);
      if (!response.ok) {
        throw new Error("Error al cargar detalles de la transferencia");
      }
      return response.json();
    },
    enabled: isOpen,
    refetchOnWindowFocus: false,
  });
  
  // Mutación para añadir reservación a la transferencia
  const addReservationMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      return apiRequest("POST", `/api/transfers/${transferId}/reservations`, data);
    },
    onSuccess: () => {
      form.reset();
      onReservationAdded();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo añadir la reservación a la transferencia",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addReservationMutation.mutate(data);
  };
  
  const handleReservationChange = (value: string) => {
    const reservationId = parseInt(value);
    form.setValue("reservationId", reservationId);
    
    const reservation = reservations?.find((r: any) => r.id === reservationId);
    setSelectedReservation(reservation);
    
    if (reservation) {
      // Establecer origen y destino originales
      form.setValue("originalOrigin", reservation.boardingPoint || "");
      form.setValue("originalDestination", reservation.exitPoint || "");
      
      // Sugerir nuevos origen y destino basados en la correspondencia de rutas
      if (transfer) {
        const sourceRoute = transfer.sourceTrip.route;
        const targetRoute = transfer.targetTrip.route;
        
        // Por defecto, usar el mismo origen y destino
        let newOrigin = reservation.boardingPoint || "";
        let newDestination = reservation.exitPoint || "";
        
        // Si el origen original no existe en la ruta destino, usar el origen de la ruta destino
        const sourceStops = [sourceRoute.origin, ...sourceRoute.stops, sourceRoute.destination];
        const targetStops = [targetRoute.origin, ...targetRoute.stops, targetRoute.destination];
        
        if (!targetStops.includes(newOrigin)) {
          newOrigin = targetRoute.origin;
        }
        
        if (!targetStops.includes(newDestination)) {
          newDestination = targetRoute.destination;
        }
        
        form.setValue("newOrigin", newOrigin);
        form.setValue("newDestination", newDestination);
      }
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir reservación a la transferencia</DialogTitle>
          <DialogDescription>
            Selecciona una reservación para añadirla a la transferencia
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reservationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reservación</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={handleReservationChange}
                    disabled={isLoadingReservations}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una reservación" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reservations?.map((reservation: any) => (
                        <SelectItem key={reservation.id} value={String(reservation.id)}>
                          {reservation.id} - {reservation.email} ({reservation.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen original</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedReservation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Origen" />
                        </SelectTrigger>
                        <SelectContent>
                          {transfer?.sourceTrip.route && (
                            <>
                              <SelectItem value={transfer.sourceTrip.route.origin}>
                                {transfer.sourceTrip.route.origin}
                              </SelectItem>
                              {transfer.sourceTrip.route.stops.map((stop: string) => (
                                <SelectItem key={stop} value={stop}>
                                  {stop}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="originalDestination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino original</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedReservation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {transfer?.sourceTrip.route && (
                            <>
                              {transfer.sourceTrip.route.stops.map((stop: string) => (
                                <SelectItem key={stop} value={stop}>
                                  {stop}
                                </SelectItem>
                              ))}
                              <SelectItem value={transfer.sourceTrip.route.destination}>
                                {transfer.sourceTrip.route.destination}
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="newOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuevo origen</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedReservation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Nuevo origen" />
                        </SelectTrigger>
                        <SelectContent>
                          {transfer?.targetTrip.route && (
                            <>
                              <SelectItem value={transfer.targetTrip.route.origin}>
                                {transfer.targetTrip.route.origin}
                              </SelectItem>
                              {transfer.targetTrip.route.stops.map((stop: string) => (
                                <SelectItem key={stop} value={stop}>
                                  {stop}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="newDestination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuevo destino</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedReservation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Nuevo destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {transfer?.targetTrip.route && (
                            <>
                              {transfer.targetTrip.route.stops.map((stop: string) => (
                                <SelectItem key={stop} value={stop}>
                                  {stop}
                                </SelectItem>
                              ))}
                              <SelectItem value={transfer.targetTrip.route.destination}>
                                {transfer.targetTrip.route.destination}
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addReservationMutation.isPending || !selectedReservation}
              >
                {addReservationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Añadiendo...
                  </>
                ) : (
                  "Añadir reservación"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};