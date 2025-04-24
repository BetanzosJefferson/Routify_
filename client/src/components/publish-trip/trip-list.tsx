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
  RefreshCcwIcon
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

// Define la estructura de un viaje
type Trip = {
  id: number;
  routeId: number;
  routeName?: string;
  origin?: string;
  destination?: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  availableSeats: number;
  price: number;
  vehicleType: string;
  isSubTrip?: boolean;
  parentTripId?: number;
  segmentOrigin?: string;
  segmentDestination?: string;
  route?: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  };
};

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
      matchesRoute = trip.routeId === parseInt(routeFilter);
    }

    return matchesSearch && matchesDate && matchesRoute;
  });

  const formatDate = (dateString: string) => {
    // Corregimos el error de visualización de fecha aplicando el ajuste de zona horaria
    // El problema era que JavaScript usa UTC como base y puede desplazar un día
    const date = new Date(dateString);
    // Ajustamos para preservar la fecha original sin conversiones de zona horaria
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return format(localDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getVehicleTypeLabel = (type: string) => {
    switch (type) {
      case "standard": return "Estándar";
      case "premium": return "Premium";
      case "luxury": return "Lujo";
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader className="bg-primary/5">
        <div className="flex flex-wrap items-center justify-between">
          <CardTitle className="text-xl">Viajes Publicados</CardTitle>
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
                      "Filtrar por fecha"
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
                  <SelectValue placeholder="Filtrar por ruta" />
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

            <div className="flex items-center">
              <Button variant="ghost" onClick={clearFilters} className="ml-auto">
                Limpiar filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Asientos</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4">
                    <div className="flex justify-center">
                      <RefreshCcwIcon className="h-6 w-6 animate-spin text-primary" />
                    </div>
                    <div className="mt-2 text-sm text-gray-500">Cargando viajes...</div>
                  </TableCell>
                </TableRow>
              ) : filteredTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No se encontraron viajes que coincidan con los criterios de búsqueda.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrips.filter((trip: Trip) => !trip.isSubTrip).map((trip: Trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">
                      {formatDate(trip.departureDate)}
                    </TableCell>
                    <TableCell>
                      {trip.route?.name || trip.routeName || `Ruta #${trip.routeId}`}
                    </TableCell>
                    <TableCell>{trip.origin}</TableCell>
                    <TableCell>{trip.destination}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Salida:</span>
                        <span>{trip.departureTime}</span>
                        <span className="text-xs text-gray-500 mt-1">Llegada:</span>
                        <span>{trip.arrivalTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trip.availableSeats > 5 ? "default" : "destructive"} className="whitespace-nowrap">
                        {trip.availableSeats} / {trip.capacity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getVehicleTypeLabel(trip.vehicleType)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(trip.price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditTrip(trip.id)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(trip.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
      </CardContent>
    </Card>
  );
}