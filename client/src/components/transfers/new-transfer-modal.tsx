import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Definir el esquema para el formulario
const transferFormSchema = z.object({
  sourceCompanyId: z.string().min(1, "La empresa origen es requerida"),
  targetCompanyId: z.string().min(1, "La empresa destino es requerida"),
  sourceTripId: z.string().min(1, "El viaje origen es requerido"),
  targetTripId: z.string().optional(),
  reason: z.string().min(10, "Por favor proporciona un motivo detallado").max(500, "El motivo no puede exceder los 500 caracteres"),
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

const NewTransferModal = ({ isOpen, onClose, onTransferCreated }: NewTransferModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [tripId, setTripId] = useState<string | undefined>(undefined);
  
  // Consultar las compañías
  const { data: companiesData, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["/api/companies/available-for-transfer"],
    queryFn: async () => {
      const response = await fetch("/api/companies/available-for-transfer");
      if (!response.ok) {
        throw new Error("Error al cargar las compañías");
      }
      return response.json();
    },
    enabled: isOpen,
  });
  
  // Consultar los viajes de la compañía actual
  const { data: tripsData, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["/api/trips/available-for-transfer"],
    queryFn: async () => {
      const response = await fetch("/api/trips/available-for-transfer");
      if (!response.ok) {
        throw new Error("Error al cargar los viajes");
      }
      return response.json();
    },
    enabled: isOpen,
  });
  
  // Actualizar el estado cuando los datos carguen
  useEffect(() => {
    if (companiesData) {
      setCompanies(companiesData);
    }
    if (tripsData) {
      setTrips(tripsData);
    }
  }, [companiesData, tripsData]);
  
  // Configurar el formulario
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      sourceCompanyId: user?.companyId || "",
      targetCompanyId: "",
      sourceTripId: "",
      targetTripId: "",
      reason: "",
    },
  });
  
  // Mutación para crear una transferencia
  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      const response = await apiRequest("POST", "/api/transfers", {
        sourceCompanyId: data.sourceCompanyId,
        targetCompanyId: data.targetCompanyId,
        sourceTripId: parseInt(data.sourceTripId),
        targetTripId: data.targetTripId ? parseInt(data.targetTripId) : null,
        reason: data.reason,
        createdBy: user?.id
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia creada",
        description: "La solicitud de transferencia ha sido creada exitosamente",
      });
      form.reset();
      onTransferCreated();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la transferencia",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransferFormValues) => {
    createTransferMutation.mutate(data);
  };
  
  // Obtener detalles del viaje seleccionado
  const getTripDetails = () => {
    if (!tripId) return null;
    
    const trip = trips.find((t: Trip) => t.id.toString() === tripId);
    if (!trip) return null;
    
    return (
      <div className="rounded-md border p-4 mt-2 bg-muted/20">
        <div className="text-sm font-medium">Detalles del viaje:</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Fecha: </span>
            {new Date(trip.departureDate).toLocaleDateString('es-MX')}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Hora: </span>
            {trip.departureTime}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Origen: </span>
            {trip.origin}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Destino: </span>
            {trip.destination}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Asientos disponibles: </span>
            {trip.availableSeats}
          </div>
        </div>
      </div>
    );
  };

  const formatTripOption = (trip: Trip) => {
    const date = new Date(trip.departureDate).toLocaleDateString('es-MX');
    return `${date} - ${trip.departureTime} (${trip.origin} → ${trip.destination})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de transferencia</DialogTitle>
          <DialogDescription>
            Crea una solicitud para transferir pasajeros entre compañías
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="sourceTripId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Viaje origen</FormLabel>
                  <Select
                    disabled={isLoadingTrips || createTransferMutation.isPending}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setTripId(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un viaje" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingTrips ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">Cargando viajes...</span>
                        </div>
                      ) : (
                        trips.map((trip: Trip) => (
                          <SelectItem key={trip.id} value={trip.id.toString()}>
                            {formatTripOption(trip)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {tripId && getTripDetails()}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sourceCompanyId"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <input type="hidden" {...field} value={user?.companyId || ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetCompanyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa destino</FormLabel>
                  <Select
                    disabled={isLoadingCompanies || createTransferMutation.isPending}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingCompanies ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">Cargando empresas...</span>
                        </div>
                      ) : (
                        companies.map((company: Company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Selecciona la empresa a la que quieres transferir pasajeros
                  </FormDescription>
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
                      placeholder="Explica el motivo de la transferencia"
                      className="min-h-[100px]"
                      disabled={createTransferMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Proporciona un motivo detallado para esta solicitud
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={createTransferMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={createTransferMutation.isPending || isLoadingCompanies || isLoadingTrips}
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewTransferModal;