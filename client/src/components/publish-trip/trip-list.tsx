import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  PencilIcon, 
  TrashIcon, 
  SearchIcon,
  CalendarIcon,
  FilterIcon,
  RefreshCcwIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  UsersIcon,
  CarIcon, 
  UserIcon,
  CheckIcon,
  Loader2Icon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@shared/schema";

// Define la estructura de un viaje
interface Trip {
  id: number;
  routeId: number;
  origin?: string;
  destination?: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  availableSeats: number;
  price: number;
  vehicleType: string;
  segmentPrices?: any[];
  isSubTrip: boolean;
  parentTripId?: number | null;
  routeName?: string;
  segmentOrigin?: string;
  segmentDestination?: string;
  route?: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  };
  // Propiedades adicionales para información de la compañía
  companyId?: string;
  companyName?: string;
  companyLogo?: string;
}

type TripListProps = {
  onEditTrip: (tripId: number) => void;
};

export default function TripList({ onEditTrip }: TripListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [showFilter, setShowFilter] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [assignVehicleDialogOpen, setAssignVehicleDialogOpen] = useState<number | null>(null);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Consulta para obtener todos los viajes
  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/trips'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/trips');
      return await res.json();
    }
  });

  // Consulta para obtener todas las rutas
  const { data: routes = [] } = useQuery({
    queryKey: ['/api/routes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/routes');
      return await res.json();
    }
  });
  
  // Consulta para obtener todos los vehículos
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/vehicles');
      return await res.json();
    }
  });
  
  // Consulta para obtener los usuarios con rol "chofer"
  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['/api/users', 'chofer'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users?role=chofer');
      return await res.json();
    }
  });

  // Mutación para eliminar un viaje
  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      try {
        console.log(`Eliminando viaje ${tripId}...`);
        const res = await apiRequest('DELETE', `/api/trips/${tripId}`);
        
        // Incluso si la respuesta no es ok, manejamos el caso y consideramos que se completó
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Error al eliminar viaje ${tripId}:`, errorText);
          throw new Error(errorText || "No se pudo eliminar el viaje");
        }
        
        return res.ok;
      } catch (error) {
        console.error(`Error en la solicitud de eliminación del viaje ${tripId}:`, error);
        // Invalidamos la consulta de todos modos para refrescar la lista
        queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Viaje eliminado",
        description: "El viaje ha sido eliminado exitosamente",
        variant: "default",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      // Incluso en caso de error, refrescamos la lista para verificar si realmente se eliminó
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      }, 1000);
      
      toast({
        title: "Error al eliminar el viaje",
        description: "Hubo un problema con la eliminación, pero la acción podría haberse completado. La lista se actualizará automáticamente.",
        variant: "destructive",
      });
      console.error("Error al eliminar viaje:", error);
    }
  });
  
  // Mutación para asignar vehículo a un viaje
  const assignVehicleMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId }: { tripId: number, vehicleId: number }) => {
      const res = await apiRequest('PATCH', `/api/trips/${tripId}`, {
        vehicleId
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "No se pudo asignar el vehículo al viaje");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Vehículo asignado",
        description: "El vehículo ha sido asignado al viaje correctamente",
        variant: "default",
      });
      setAssignVehicleDialogOpen(null);
      setSelectedVehicleId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al asignar vehículo",
        description: error.message || "Hubo un problema con la asignación del vehículo",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para asignar conductor a un viaje
  const assignDriverMutation = useMutation({
    mutationFn: async ({ tripId, driverId }: { tripId: number, driverId: number }) => {
      const res = await apiRequest('PATCH', `/api/trips/${tripId}`, {
        driverId
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "No se pudo asignar el conductor al viaje");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Conductor asignado",
        description: "El conductor ha sido asignado al viaje correctamente",
        variant: "default",
      });
      setAssignDriverDialogOpen(null);
      setSelectedDriverId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al asignar conductor",
        description: error.message || "Hubo un problema con la asignación del conductor",
        variant: "destructive",
      });
    }
  });

  // Función para manejar la eliminación de un viaje
  const handleDeleteClick = (tripId: number) => {
    setTripToDelete(tripId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (tripToDelete) {
      deleteTripMutation.mutate(tripToDelete);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter(undefined);
    setRouteFilter("all");
    setShowFilter(false);
  };

  // Filtrar los viajes
  const filteredTrips = trips.filter((trip: Trip) => {
    let matchesSearch = true;
    let matchesDate = true;
    let matchesRoute = true;

    // Filtrar por búsqueda en origen, destino o nombre de ruta
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      matchesSearch = 
        (trip.origin?.toLowerCase().includes(search) ?? false) ||
        (trip.destination?.toLowerCase().includes(search) ?? false) ||
        (trip.routeName?.toLowerCase().includes(search) ?? false);
    }

    // Filtrar por fecha
    if (dateFilter) {
      const tripDate = new Date(trip.departureDate);
      matchesDate = 
        tripDate.getFullYear() === dateFilter.getFullYear() &&
        tripDate.getMonth() === dateFilter.getMonth() &&
        tripDate.getDate() === dateFilter.getDate();
    }
    
    // Filtrar por ruta
    if (routeFilter !== "all") {
      const routeId = parseInt(routeFilter, 10);
      matchesRoute = trip.routeId === routeId;
    }

    return matchesSearch && matchesDate && matchesRoute;
  });

  // Agrupar viajes por fecha
  const groupTripsByDate = () => {
    const grouped: Record<string, Trip[]> = {};
    
    filteredTrips.filter((trip: Trip) => !trip.isSubTrip).forEach((trip: Trip) => {
      // Manejo explícito de la fecha para evitar problemas de zona horaria
      const date = new Date(trip.departureDate);
      const day = date.getUTCDate();
      const month = date.getUTCMonth() + 1; // getUTCMonth() devuelve 0-11
      const year = date.getUTCFullYear();
      
      // Formato yyyy-MM-dd
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(trip);
    });
    
    return grouped;
  };

  // Formatear fecha para encabezado
  const formatDateHeader = (dateString: string) => {
    // Creamos la fecha usando los componentes individuales para evitar problemas de zona horaria
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));
    const localDate = new Date(year, month - 1, day, 12, 0, 0);
    
    return format(localDate, "'Viajes para' d 'de' MMMM 'de' yyyy", { locale: es });
  };

  // Formatear hora para mostrar
  const formatTime = (timeString: string) => {
    return timeString;
  };

  const getStopsCount = (trip: Trip) => {
    if (!trip.route) return 0;
    return trip.route.stops.length;
  };

  return (
    <Card>
      <CardHeader className="bg-primary/5">
        <div className="flex flex-wrap items-center justify-between">
          <CardTitle className="text-xl">Publicación de Viajes</CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilter(!showFilter)}
            >
              <FilterIcon className="h-4 w-4 mr-1" />
              Filtros
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCcwIcon className="h-4 w-4 mr-1" />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      {showFilter && (
        <div className="p-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="flex w-full items-center space-x-2">
                <SearchIcon className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por origen o destino"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? (
                      format(dateFilter, "dd/MM/yyyy")
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Select
                value={routeFilter}
                onValueChange={setRouteFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las rutas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las rutas</SelectItem>
                  {routes.map((route: any) => (
                    <SelectItem key={route.id} value={route.id.toString()}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <RefreshCcwIcon className="h-10 w-10 animate-spin text-primary mb-4" />
            <div className="text-gray-500">Cargando viajes...</div>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-muted-foreground">
              No se encontraron viajes que coincidan con los criterios de búsqueda.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupTripsByDate()).map(([dateKey, trips]) => (
              <div key={dateKey} className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{formatDateHeader(dateKey)}</h3>
                  <p className="text-sm text-muted-foreground">
                    Gestiona los viajes programados para esta fecha, asigna vehículos y conductores.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {trips.map((trip: Trip) => (
                    <div key={trip.id} className="border rounded-lg overflow-hidden bg-card">
                      <div className="flex flex-col lg:flex-row">
                        <div className="p-4 lg:p-6 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex">
                              {/* Logo de la compañía (solo para TypeScript) */}
                              {trip.companyLogo ? (
                                <div className="mr-3 h-12 w-12 flex-shrink-0">
                                  <img 
                                    src={trip.companyLogo} 
                                    alt={trip.companyName || "Logo de transportista"} 
                                    className="h-full w-full object-cover rounded-full border border-gray-100"
                                    onError={(e) => {
                                      // Si falla la carga, ocultar la imagen
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                    }} 
                                  />
                                </div>
                              ) : null}
                              
                              <div>
                                <h4 className="text-base font-medium mb-1">
                                  {trip.route?.name || trip.routeName || `Ruta #${trip.routeId}`}
                                </h4>
                                {trip.companyName && (
                                  <div className="text-xs text-gray-500 mb-1">
                                    {trip.companyName}
                                  </div>
                                )}
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4 mr-1" />
                                  <span>
                                    {(() => {
                                      const date = new Date(trip.departureDate);
                                      const day = date.getUTCDate();
                                      const month = date.getUTCMonth() + 1;
                                      const year = date.getUTCFullYear();
                                      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
                                    })()}
                                  </span>
                                  <ClockIcon className="h-4 w-4 ml-4 mr-1" />
                                  <span>{formatTime(trip.departureTime)} - {formatTime(trip.arrivalTime)}</span>
                                </div>
                              </div>
                            </div>
                            <Badge className="ml-auto" variant="outline">Programado</Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {/* Primera columna: Ruta */}
                            <div className="bg-muted/50 p-3 rounded-md">
                              <div className="flex items-start mb-2">
                                <MapPinIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">Ruta</p>
                                  <p className="text-xs text-muted-foreground">
                                    Terminal {trip.origin?.split(' - ')[1] || ''} → {trip.destination?.split(' - ')[1] || ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {getStopsCount(trip)} paradas intermedias
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Segunda columna: Vehículo */}
                            <div className="bg-muted/50 p-3 rounded-md">
                              <div className="flex items-start">
                                <CarIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">Vehículo</p>
                                  <p className="text-xs text-red-500 font-medium">No asignado</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Tercera columna: Conductor */}
                            <div className="bg-muted/50 p-3 rounded-md">
                              <div className="flex items-start">
                                <UserIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">Conductor</p>
                                  <p className="text-xs text-red-500 font-medium">No asignado</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center mt-4">
                            <UsersIcon className="h-4 w-4 mr-1 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">0 reservas</span>
                          </div>
                        </div>
                        
                        <div className="p-4 lg:p-6 flex flex-row lg:flex-col items-center justify-between border-t lg:border-t-0 lg:border-l bg-muted/20">
                          <div className="flex lg:flex-col gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="whitespace-nowrap"
                              onClick={() => setAssignVehicleDialogOpen(trip.id)}
                            >
                              <CarIcon className="h-3 w-3 mr-1" />
                              Asignar Vehículo
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="whitespace-nowrap"
                              onClick={() => setAssignDriverDialogOpen(trip.id)}
                            >
                              <UserIcon className="h-3 w-3 mr-1" />
                              Asignar Conductor
                            </Button>
                          </div>
                          
                          <div className="flex gap-2 mt-0 lg:mt-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditTrip(trip.id)}
                              className="h-8 w-8"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(trip.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive/80"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog de confirmación para eliminar viaje */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar este viaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Eliminar este viaje también eliminará todos los sub-viajes asociados
              y podría afectar a reservaciones existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog para asignar vehículo */}
      <AlertDialog 
        open={assignVehicleDialogOpen !== null} 
        onOpenChange={(open) => !open && setAssignVehicleDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar Vehículo</AlertDialogTitle>
            <AlertDialogDescription>
              Seleccione un vehículo para asignar a este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            {isLoadingVehicles ? (
              <div className="flex justify-center items-center py-4">
                <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Cargando vehículos...</span>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay vehículos disponibles. Añada vehículos en la sección de "Unidades".
              </div>
            ) : (
              <Select
                value={selectedVehicleId || ""}
                onValueChange={(value) => setSelectedVehicleId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle: any) => (
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                      {vehicle.brand} {vehicle.model} - {vehicle.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assignVehicleDialogOpen !== null && selectedVehicleId) {
                  assignVehicleMutation.mutate({
                    tripId: assignVehicleDialogOpen,
                    vehicleId: parseInt(selectedVehicleId)
                  });
                }
              }}
              disabled={!selectedVehicleId || assignVehicleMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {assignVehicleMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Asignar Vehículo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog para asignar conductor */}
      <AlertDialog 
        open={assignDriverDialogOpen !== null} 
        onOpenChange={(open) => !open && setAssignDriverDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar Conductor</AlertDialogTitle>
            <AlertDialogDescription>
              Seleccione un conductor para asignar a este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            {isLoadingDrivers ? (
              <div className="flex justify-center items-center py-4">
                <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Cargando conductores...</span>
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay conductores disponibles. Invite usuarios con rol "Chofer".
              </div>
            ) : (
              <Select
                value={selectedDriverId || ""}
                onValueChange={(value) => setSelectedDriverId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar conductor" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver: any) => (
                    <SelectItem key={driver.id} value={driver.id.toString()}>
                      {driver.firstName} {driver.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assignDriverDialogOpen !== null && selectedDriverId) {
                  assignDriverMutation.mutate({
                    tripId: assignDriverDialogOpen,
                    driverId: parseInt(selectedDriverId)
                  });
                }
              }}
              disabled={!selectedDriverId || assignDriverMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {assignDriverMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Asignar Conductor"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}