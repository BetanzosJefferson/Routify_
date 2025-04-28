import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageLayout } from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { SearchIcon, ArrowRightIcon, Loader2, Calendar, User, Users, BellIcon, XIcon, CheckIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passengerTransferFormSchema } from "@/lib/form-schemas";
import { Reservation, Trip } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  selected?: boolean;
}

// Tipo para viajes con sus reservaciones
interface TripWithReservations {
  trip: Trip;
  reservations: ReservationWithDetails[];
  routeName: string;
  origin: string;
  destination: string;
}

// Tipos para el formulario
type TransferFormValues = z.infer<typeof passengerTransferFormSchema>;

// Estados de transferencia
enum TransferStatus {
  PENDING = "pendiente",
  APPROVED = "aprobada",
  REJECTED = "rechazada"
}

// Tipo para una solicitud de transferencia
interface TransferRequest {
  id: number;
  reservationIds: number[];
  sourceCompanyId: string;
  targetCompanyId: string;
  transferReason?: string;
  status: TransferStatus;
  createdAt: Date;
  createdBy: number;
}

// Actualizar el esquema de transferencia para soportar múltiples reservaciones
const batchTransferFormSchema = passengerTransferFormSchema.extend({
  reservationIds: z.array(z.number()),
});

type BatchTransferFormValues = z.infer<typeof batchTransferFormSchema>;

export default function PassengerTransferPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReservations, setSelectedReservations] = useState<ReservationWithDetails[]>([]);
  const [tripsWithReservations, setTripsWithReservations] = useState<TripWithReservations[]>([]);

  // Formulario
  const form = useForm<BatchTransferFormValues>({
    resolver: zodResolver(batchTransferFormSchema),
    defaultValues: {
      reservationIds: [],
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

  // Consulta para obtener todas las reservaciones
  const { data: allReservations, isLoading: isLoadingReservations, refetch } = useQuery({
    queryKey: ["/api/reservations"],
    queryFn: async () => {
      const response = await fetch("/api/reservations");
      if (!response.ok) {
        throw new Error("Error al cargar las reservaciones");
      }
      
      const reservations = await response.json();
      return reservations as ReservationWithDetails[];
    },
  });

  // Consulta para obtener todos los viajes
  const { data: allTrips } = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch("/api/trips");
      if (!response.ok) {
        throw new Error("Error al cargar los viajes");
      }
      
      const trips = await response.json();
      return trips;
    },
  });

  // Procesar y agrupar reservaciones por viaje cuando se cargan los datos
  useEffect(() => {
    if (allReservations && allTrips) {
      const trips: TripWithReservations[] = [];
      const tripsMap = new Map<number, TripWithReservations>();
      
      // Agrupar reservaciones por viaje
      allReservations.forEach(reservation => {
        const tripId = reservation.tripId;
        const trip = allTrips.find((t: any) => t.id === tripId);
        
        if (trip) {
          if (!tripsMap.has(tripId)) {
            tripsMap.set(tripId, {
              trip,
              reservations: [],
              routeName: trip.routeName || `Ruta #${trip.routeId}`,
              origin: trip.origin || 'Origen no disponible',
              destination: trip.destination || 'Destino no disponible'
            });
          }
          
          tripsMap.get(tripId)?.reservations.push({
            ...reservation,
            selected: false
          });
        }
      });
      
      // Convertir el mapa a un arreglo y ordenar por fecha
      tripsMap.forEach(tripWithReservations => {
        trips.push(tripWithReservations);
      });
      
      // Ordenar por fecha de salida, los más recientes primero
      trips.sort((a, b) => {
        return new Date(b.trip.departureDate).getTime() - new Date(a.trip.departureDate).getTime();
      });
      
      setTripsWithReservations(trips);
    }
  }, [allReservations, allTrips]);

  // Mutación para transferir pasajeros
  // Obtener datos del usuario actual
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (!response.ok) {
        throw new Error("No se pudo obtener la información del usuario");
      }
      return await response.json();
    },
  });

  // Consulta para obtener transferencias pendientes
  const { data: pendingTransfers, isLoading: isLoadingTransfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["/api/passenger-transfer/pending"],
    queryFn: async () => {
      const response = await fetch("/api/passenger-transfer/pending");
      if (!response.ok) {
        throw new Error("Error al cargar las transferencias pendientes");
      }
      return await response.json() as TransferRequest[];
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: BatchTransferFormValues) => {
      // Obtener la compañía de origen del usuario actual
      const sourceCompanyId = currentUser?.companyId;
      if (!sourceCompanyId) {
        throw new Error("No se pudo determinar la empresa de origen");
      }

      // Añadir detalles a la solicitud de transferencia
      const transferRequest = {
        ...data,
        sourceCompanyId,
        status: TransferStatus.PENDING
      };

      const response = await apiRequest("POST", "/api/passenger-transfer/batch", transferRequest);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al transferir las reservaciones");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitud de transferencia enviada",
        description: `Se ha enviado una solicitud para transferir ${selectedReservations.length} reservación(es). La empresa destino debe aprobarla.`,
        variant: "default",
      });
      setSelectedReservations([]);
      form.reset();
      refetch();
      refetchTransfers();
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la transferencia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejar selección/deselección de reservación
  const handleReservationToggle = (reservation: ReservationWithDetails) => {
    // Actualizar el estado del array de trips
    setTripsWithReservations(prevTrips => {
      return prevTrips.map(tripData => {
        return {
          ...tripData,
          reservations: tripData.reservations.map(res => {
            if (res.id === reservation.id) {
              return {
                ...res,
                selected: !res.selected
              };
            }
            return res;
          })
        };
      });
    });
    
    // Actualizar selecciones
    if (selectedReservations.some(r => r.id === reservation.id)) {
      setSelectedReservations(prev => prev.filter(r => r.id !== reservation.id));
      form.setValue('reservationIds', form.getValues('reservationIds').filter(id => id !== reservation.id));
    } else {
      setSelectedReservations(prev => [...prev, reservation]);
      form.setValue('reservationIds', [...form.getValues('reservationIds'), reservation.id]);
    }
  };

  // Manejar envío del formulario
  function onSubmit(data: BatchTransferFormValues) {
    if (data.reservationIds.length === 0) {
      toast({
        title: "No hay reservaciones seleccionadas",
        description: "Debes seleccionar al menos una reservación para transferir.",
        variant: "destructive",
      });
      return;
    }
    transferMutation.mutate(data);
  }

  // Filtrar viajes según el criterio de búsqueda
  const filteredTrips = searchQuery.trim() === '' 
    ? tripsWithReservations 
    : tripsWithReservations.map(tripData => {
        // Filtrar reservaciones dentro del viaje que coincidan con la búsqueda
        const matchingReservations = tripData.reservations.filter(res => {
          const lowerQuery = searchQuery.toLowerCase();
          return (
            res.id.toString().includes(lowerQuery) ||
            (res.email && res.email.toLowerCase().includes(lowerQuery)) ||
            (res.phone && res.phone.toLowerCase().includes(lowerQuery))
          );
        });
        
        // Solo incluir el viaje si tiene reservaciones que coincidan
        if (matchingReservations.length > 0) {
          return {
            ...tripData,
            reservations: matchingReservations
          };
        }
        return null;
      }).filter(Boolean) as TripWithReservations[];

  // Mutación para aprobar transferencia
  const approveTransferMutation = useMutation({
    mutationFn: async (transferId: number) => {
      const response = await apiRequest("POST", `/api/passenger-transfer/${transferId}/approve`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al aprobar la transferencia");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia aprobada",
        description: "La transferencia de pasajeros ha sido aprobada correctamente.",
        variant: "default",
      });
      refetchTransfers();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al aprobar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para rechazar transferencia
  const rejectTransferMutation = useMutation({
    mutationFn: async (transferId: number) => {
      const response = await apiRequest("POST", `/api/passenger-transfer/${transferId}/reject`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al rechazar la transferencia");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia rechazada",
        description: "La transferencia de pasajeros ha sido rechazada.",
        variant: "default",
      });
      refetchTransfers();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al rechazar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verificar si el usuario tiene permisos para aprobar transferencias
  // (Dueño, Administrador, Call Center)
  const canApproveTransfers = () => {
    if (!currentUser) return false;
    return ["dueño", "administrador", "call center"].includes(currentUser.role.toLowerCase());
  };

  // Obtener solo transferencias dirigidas a la empresa del usuario
  const pendingTransfersForApproval = pendingTransfers?.filter(
    transfer => transfer.targetCompanyId === currentUser?.companyId && 
    transfer.status === TransferStatus.PENDING
  ) || [];

  return (
    <PageLayout title="Transferencia de Pasajeros" activeTab="passenger-transfer">
      <div className="space-y-6">
        {/* Sección de transferencias pendientes para aprobación */}
        {canApproveTransfers() && pendingTransfersForApproval.length > 0 && (
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                Transferencias Pendientes de Aprobación
              </CardTitle>
              <CardDescription>
                Las siguientes transferencias requieren tu aprobación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingTransfersForApproval.map((transfer) => (
                  <div key={transfer.id} className="border rounded-lg p-4 bg-white dark:bg-gray-950">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Solicitud #{transfer.id}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transfer.reservationIds.length} reservación(es) para transferir
                        </p>
                        {transfer.transferReason && (
                          <div className="mt-2">
                            <h5 className="text-sm font-medium">Motivo:</h5>
                            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-1">
                              {transfer.transferReason}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => rejectTransferMutation.mutate(transfer.id)}
                          disabled={rejectTransferMutation.isPending}
                        >
                          {rejectTransferMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <XIcon className="h-4 w-4 mr-1" />
                          )}
                          Rechazar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => approveTransferMutation.mutate(transfer.id)}
                          disabled={approveTransferMutation.isPending}
                        >
                          {approveTransferMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckIcon className="h-4 w-4 mr-1" />
                          )}
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lista de viajes y reservaciones */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Reservaciones Disponibles</CardTitle>
              <CardDescription>
                Selecciona las reservaciones que deseas transferir a otra empresa.
              </CardDescription>
              <div className="mt-2">
                <div className="relative max-w-sm">
                  <Input
                    placeholder="Buscar por ID, email o teléfono"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingReservations ? (
                <div className="flex justify-center items-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredTrips.length === 0 ? (
                <div className="text-center py-10 border rounded-lg">
                  <p className="text-muted-foreground mb-2">No hay reservaciones disponibles</p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "No se encontraron reservaciones con ese criterio" : "No hay reservaciones para transferir en este momento"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  <Accordion type="multiple" defaultValue={filteredTrips.map((_, i) => `trip-${i}`)}>
                    {filteredTrips.map((tripData, index) => (
                      <AccordionItem key={tripData.trip.id} value={`trip-${index}`}>
                        <AccordionTrigger className="hover:bg-accent/30 p-2 rounded-md">
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(tripData.trip.departureDate), "dd 'de' MMMM, yyyy", { locale: es })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <span>{tripData.origin}</span>
                              <ArrowRightIcon className="h-3 w-3" />
                              <span>{tripData.destination}</span>
                              <span className="ml-1 text-xs">
                                ({tripData.reservations.length} reservación(es))
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pl-2">
                            {tripData.reservations.map((reservation) => (
                              <div 
                                key={reservation.id}
                                className={`p-3 rounded-md border flex items-start gap-3 hover:bg-accent/30 transition-colors ${
                                  reservation.selected ? "bg-primary/10 border-primary" : ""
                                }`}
                              >
                                <Checkbox 
                                  id={`reservation-${reservation.id}`}
                                  checked={selectedReservations.some(r => r.id === reservation.id)}
                                  onCheckedChange={() => handleReservationToggle(reservation)}
                                  className="mt-1"
                                />
                                <label 
                                  htmlFor={`reservation-${reservation.id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">Reservación #{reservation.id}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {reservation.status}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span>{reservation.email}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        <span>{reservation.passengerCount} pasajero(s)</span>
                                      </div>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formulario de transferencia */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Transferir Reservaciones</CardTitle>
              <CardDescription>
                Selecciona la empresa destino y proporciona la razón de la transferencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReservations.length === 0 ? (
                <div className="text-center py-10 border rounded-lg">
                  <p className="text-muted-foreground mb-2">No hay reservaciones seleccionadas</p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona las reservaciones que deseas transferir usando los checkboxes
                  </p>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-muted/50 p-4 rounded-md mb-4">
                      <h3 className="font-medium mb-2">Resumen</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Reservaciones seleccionadas:</span>
                        <span className="font-medium">{selectedReservations.length}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span className="text-muted-foreground">Pasajeros totales:</span>
                        <span className="font-medium">
                          {selectedReservations.reduce((sum, res) => sum + res.passengerCount, 0)}
                        </span>
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
                            La empresa a la que se transferirán estas reservaciones
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
                              placeholder="Explica por qué se están transfiriendo estas reservaciones"
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
                          "Transferir Reservaciones"
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
    </PageLayout>
  );
}
