import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Esquema de validación para el formulario
const transferFormSchema = z.object({
  tripId: z.string().min(1, "Debes seleccionar un viaje"),
  targetCompanyId: z.string().min(1, "Debes seleccionar una empresa destino"),
  reason: z.string().min(10, "Proporciona una razón detallada para la transferencia").max(500, "La razón no puede exceder los 500 caracteres"),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

interface Trip {
  id: number;
  departureDate: Date;
  departureTime: string;
  origin: string;
  destination: string;
  availableSeats: number;
}

interface Company {
  id: string;
  name: string;
}

interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferCreated: () => void;
}

export const NewTransferModal = ({ isOpen, onClose, onTransferCreated }: NewTransferModalProps) => {
  const { user } = useAuth();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Consultar viajes disponibles para transferir
  const { data: trips, isLoading: isLoadingTrips } = useQuery({ 
    queryKey: ["/api/trips/transferable"], 
    queryFn: async () => {
      const response = await fetch("/api/trips/transferable");
      if (!response.ok) throw new Error("Error al cargar viajes");
      return response.json();
    },
    enabled: isOpen
  });

  // Consultar empresas disponibles para transferir
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({ 
    queryKey: ["/api/companies/available"], 
    queryFn: async () => {
      const response = await fetch("/api/companies/available");
      if (!response.ok) throw new Error("Error al cargar empresas");
      return response.json();
    },
    enabled: isOpen
  });

  // Configurar el formulario con react-hook-form
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      tripId: "",
      targetCompanyId: "",
      reason: "",
    },
  });

  // Manejar la creación de la transferencia
  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      const response = await apiRequest("POST", "/api/transfers", {
        ...data,
        tripId: parseInt(data.tripId)
      });
      return await response.json();
    },
    onSuccess: () => {
      onTransferCreated();
      form.reset();
    }
  });

  const onSubmit = (data: TransferFormValues) => {
    createTransferMutation.mutate(data);
  };

  const handleTripChange = (tripId: string) => {
    if (tripId && trips) {
      const trip = trips.find((t: Trip) => t.id.toString() === tripId);
      setSelectedTrip(trip || null);
    } else {
      setSelectedTrip(null);
    }
  };

  const formatTripOption = (trip: Trip) => {
    return `${format(new Date(trip.departureDate), "dd/MM/yyyy")} - ${trip.departureTime} - ${trip.origin} a ${trip.destination}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva transferencia</DialogTitle>
          <DialogDescription>
            Crea una solicitud para transferir reservaciones a otra empresa
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tripId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Viaje a transferir</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleTripChange(value);
                      }}
                      value={field.value}
                      disabled={isLoadingTrips || createTransferMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un viaje" />
                      </SelectTrigger>
                      <SelectContent>
                        {trips && trips.length > 0 ? (
                          trips.map((trip: Trip) => (
                            <SelectItem key={trip.id} value={trip.id.toString()}>
                              {formatTripOption(trip)}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-trips" disabled>
                            No hay viajes disponibles para transferir
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedTrip && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <p><strong>Viaje seleccionado:</strong> {formatTripOption(selectedTrip)}</p>
                <p><strong>Asientos disponibles:</strong> {selectedTrip.availableSeats}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="targetCompanyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa destino</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoadingCompanies || createTransferMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies && companies.length > 0 ? (
                          companies.map((company: Company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-companies" disabled>
                            No hay empresas disponibles
                          </SelectItem>
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de la transferencia</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explica la razón por la que necesitas transferir este viaje"
                      className="min-h-[100px]"
                      {...field}
                      disabled={createTransferMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                type="button"
                disabled={createTransferMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={createTransferMutation.isPending}
              >
                {createTransferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear transferencia"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewTransferModal;