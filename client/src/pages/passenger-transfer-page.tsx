import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SearchIcon, ArrowRightIcon, Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passengerTransferFormSchema } from "@/lib/form-schemas";
import { Reservation } from "@shared/schema";

// Tipo para empresa
interface Company {
  id: string;
  name: string;
  logoUrl?: string;
}

// Tipo personalizado para reservaciones con detalles
interface ReservationWithDetails extends Reservation {
  tripName?: string;
  passengerCount: number;
  originCity: string;
  destinationCity: string;
  departureDate: string;
  status: string;
}

// Tipos para el formulario
type TransferFormValues = z.infer<typeof passengerTransferFormSchema>;

export default function PassengerTransferPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);

  // Formulario
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(passengerTransferFormSchema),
    defaultValues: {
      reservationId: 0,
      targetCompanyId: "",
      transferReason: "",
    },
  });

  // Consulta para obtener empresas
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Error al cargar las empresas");
      }
      return response.json() as Promise<Company[]>;
    },
  });

  // Consulta para buscar reservaciones
  const { data: reservations, isLoading: isLoadingReservations, refetch } = useQuery({
    queryKey: ["/api/reservations/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await fetch(`/api/reservations/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error("Error al buscar reservaciones");
      }
      return response.json() as Promise<ReservationWithDetails[]>;
    },
    enabled: !!searchQuery,
  });

  // Mutación para transferir pasajeros
  const transferMutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      const response = await apiRequest("POST", "/api/passenger-transfer", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al transferir la reservación");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia exitosa",
        description: "La reservación ha sido transferida correctamente.",
        variant: "default",
      });
      setSelectedReservation(null);
      form.reset();
      setSearchQuery("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la transferencia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejar búsqueda
  const handleSearch = () => {
    if (searchQuery) {
      refetch();
    }
  };

  // Manejar selección de reservación
  const handleSelectReservation = (reservation: ReservationWithDetails) => {
    setSelectedReservation(reservation);
    form.setValue("reservationId", reservation.id);
  };

  // Manejar envío del formulario
  function onSubmit(data: TransferFormValues) {
    transferMutation.mutate(data);
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Transferencia de Pasajeros</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Buscador de reservaciones */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Buscar Reservación</CardTitle>
            <CardDescription>
              Busca una reservación por código, nombre de pasajero o información de contacto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Código o nombre del pasajero"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={!searchQuery || isLoadingReservations}
              >
                {isLoadingReservations ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              </Button>
            </div>

            <div className="h-[300px] overflow-y-auto border rounded-md">
              {isLoadingReservations ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !reservations || reservations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No se encontraron reservaciones" : "Busca una reservación para transferir"}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors
                        ${selectedReservation?.id === reservation.id
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent"
                        }`}
                      onClick={() => handleSelectReservation(reservation)}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">#{reservation.id}</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(reservation.departureDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm mt-1">
                        <div className="flex justify-between">
                          <span>{reservation.passengerCount} pasajero(s)</span>
                          <span>{reservation.status}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <span>{reservation.originCity}</span>
                          <ArrowRightIcon className="h-3 w-3" />
                          <span>{reservation.destinationCity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Formulario de transferencia */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Transferir Reservación</CardTitle>
            <CardDescription>
              Selecciona la empresa destino y proporciona la razón de la transferencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedReservation ? (
              <div className="text-center py-10 border rounded-lg">
                <p className="text-muted-foreground mb-2">Selecciona primero una reservación</p>
                <p className="text-xs text-muted-foreground">
                  Usa el buscador de la izquierda para encontrar la reservación que deseas transferir
                </p>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-md mb-4">
                    <h3 className="font-medium mb-2">Detalles de la Reservación</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-muted-foreground">ID:</span>
                      <span>#{selectedReservation.id}</span>
                      
                      <span className="text-muted-foreground">Viaje:</span>
                      <span>{selectedReservation.tripName || `Viaje #${selectedReservation.tripId}`}</span>
                      
                      <span className="text-muted-foreground">Ruta:</span>
                      <span className="flex items-center gap-1">
                        {selectedReservation.originCity}
                        <ArrowRightIcon className="h-3 w-3" />
                        {selectedReservation.destinationCity}
                      </span>
                      
                      <span className="text-muted-foreground">Pasajeros:</span>
                      <span>{selectedReservation.passengerCount}</span>
                      
                      <span className="text-muted-foreground">Fecha:</span>
                      <span>{new Date(selectedReservation.departureDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="targetCompanyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa Destino</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingCompanies ? (
                              <div className="flex justify-center p-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : !companies || companies.length === 0 ? (
                              <SelectItem value="no-companies" disabled>
                                No hay empresas disponibles
                              </SelectItem>
                            ) : (
                              companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          La empresa a la que se transferirá esta reservación
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transferReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razón de la Transferencia (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explica por qué se está transfiriendo esta reservación"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={transferMutation.isPending || !form.getValues().targetCompanyId}
                    >
                      {transferMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Transfiriendo...
                        </>
                      ) : (
                        "Transferir Reservación"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}