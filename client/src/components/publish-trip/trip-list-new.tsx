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
  InfoIcon,
  Users,
  Clock,
  MapPin,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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

export default function TripListNew({ onEditTrip }: TripListProps) {
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

  // Consulta para obtener todas las rutas (para filtrar)
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
      const response = await apiRequest('DELETE', `/api/trips/${tripId}`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Viaje eliminado",
        description: "El viaje ha sido eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setDeleteDialogOpen(false);
      setTripToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar el viaje",
        description: `Ha ocurrido un error: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Maneja la apertura del diálogo de confirmación para eliminar
  const handleDeleteClick = (tripId: number) => {
    setTripToDelete(tripId);
    setDeleteDialogOpen(true);
  };

  // Maneja la confirmación de eliminación
  const handleConfirmDelete = () => {
    if (tripToDelete !== null) {
      deleteTripMutation.mutate(tripToDelete);
    }
  };

  // Filtra los viajes por búsqueda, fecha y ruta
  const filteredTrips = trips.filter((trip: Trip) => {
    // Filtro por término de búsqueda
    const matchesSearch = 
      searchQuery === "" || 
      trip.route?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.origin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filtro por fecha
    const matchesDate = dateFilter 
      ? new Date(trip.departureDate).toDateString() === dateFilter.toDateString() 
      : true;
    
    // Filtro por ruta
    const matchesRoute = routeFilter === "all" || trip.routeId.toString() === routeFilter;
    
    return matchesSearch && matchesDate && matchesRoute;
  });

  // Formatea la fecha de salida
  const formatDepartureDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
    } catch (error) {
      console.error("Error al formatear la fecha:", error);
      return dateString;
    }
  };

  // Formatea la fecha de salida en formato corto
  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d/M/yyyy", { locale: es });
    } catch (error) {
      console.error("Error al formatear la fecha:", error);
      return dateString;
    }
  };

  // Obtener el nombre de la ciudad desde la ubicación completa
  const getCityName = (fullLocation: string | undefined) => {
    if (!fullLocation) return '';
    // Formato esperado: "Ciudad, Estado - Detalles"
    const parts = fullLocation.split(',');
    if (parts.length > 0) {
      return parts[0].trim();
    }
    return fullLocation;
  };

  // Determinar si un viaje es hoy
  const isTodayTrip = (dateString: string) => {
    const today = new Date();
    const tripDate = new Date(dateString);
    return (
      today.getDate() === tripDate.getDate() &&
      today.getMonth() === tripDate.getMonth() &&
      today.getFullYear() === tripDate.getFullYear()
    );
  };

  // Agrupar viajes por fecha
  const groupedTrips = filteredTrips.reduce((acc: Record<string, Trip[]>, trip: Trip) => {
    const date = trip.departureDate.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(trip);
    return acc;
  }, {});

  // Ordenar fechas
  const sortedDates = Object.keys(groupedTrips).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Viajes Publicados</h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center"
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center"
          >
            <RefreshCcwIcon className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {showFilter && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Buscar</label>
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar viaje..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fecha</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter ? (
                        format(dateFilter, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={dateFilter}
                      onSelect={(date) => setDateFilter(date)}
                      initialFocus
                    />
                    {dateFilter && (
                      <div className="p-2 border-t border-border">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full" 
                          onClick={() => setDateFilter(undefined)}
                        >
                          Limpiar
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ruta</label>
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
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <p>Cargando viajes...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="flex justify-center items-center p-8 bg-gray-50 rounded-lg border">
          <div className="text-center">
            <Calendar className="h-8 w-8 mb-2 mx-auto text-gray-400" />
            <h3 className="text-lg font-medium">No se encontraron viajes</h3>
            <p className="text-sm text-gray-500 mt-1">
              No hay viajes programados con los criterios de búsqueda seleccionados.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const formattedDate = new Date(date);
            const isToday = isTodayTrip(date);
            
            return (
              <div key={date} className="space-y-4">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    {isToday ? (
                      <span>Viajes para hoy, {formatDepartureDate(date)}</span>
                    ) : (
                      <span>Viajes para {formatDepartureDate(date)}</span>
                    )}
                  </h3>
                  {isToday && (
                    <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
                      Hoy
                    </Badge>
                  )}
                </div>
                
                <div className="grid gap-4 grid-cols-1">
                  {groupedTrips[date].map((trip: Trip) => {
                    const origin = trip.isSubTrip 
                      ? trip.segmentOrigin 
                      : trip.origin || trip.route?.origin || '';
                    
                    const destination = trip.isSubTrip 
                      ? trip.segmentDestination 
                      : trip.destination || trip.route?.destination || '';
                    
                    return (
                      <Card key={trip.id} className="overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                          <div className="bg-gray-50 p-4 md:w-64 flex flex-col justify-center md:border-r">
                            <div className="mb-2">
                              <span className="text-sm text-gray-500">
                                {formatShortDate(trip.departureDate)}
                              </span>
                            </div>
                            <div className="flex justify-between mb-2">
                              <div className="text-lg font-semibold">{trip.departureTime}</div>
                              <div className="text-lg font-semibold">{trip.arrivalTime}</div>
                            </div>
                            <div className="text-sm">
                              <Badge variant="outline" className="font-normal">
                                {trip.vehicleType === 'standard' ? 'Estándar' : trip.vehicleType} - {trip.availableSeats} asientos
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex-1 p-4">
                            <div className="mb-3">
                              <h4 className="text-lg font-medium mb-1">{trip.route?.name || 'Viaje'}</h4>
                              <div className="flex items-center text-sm text-gray-600">
                                <MapPin className="h-4 w-4 mr-1" />
                                <span>
                                  {getCityName(origin)} → {getCityName(destination)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 mb-3">
                              <div className="flex items-center text-sm">
                                <Clock className="h-4 w-4 mr-1 text-gray-500" />
                                <span>
                                  {trip.departureTime} - {trip.arrivalTime}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <Users className="h-4 w-4 mr-1 text-gray-500" />
                                <span>
                                  {trip.availableSeats} / {trip.capacity} asientos
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="font-medium">${trip.price.toFixed(2)} MXN</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                              <div>
                                <Badge 
                                  variant={trip.isSubTrip ? "outline" : "default"}
                                  className={trip.isSubTrip ? "bg-gray-100" : ""}
                                >
                                  {trip.isSubTrip ? 'Subviaje' : 'Viaje completo'}
                                </Badge>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => onEditTrip(trip.id)}
                                  className="flex items-center"
                                >
                                  <PencilIcon className="h-3.5 w-3.5 mr-1" />
                                  Editar
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeleteClick(trip.id)}
                                  className="flex items-center text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                >
                                  <TrashIcon className="h-3.5 w-3.5 mr-1" />
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-sm text-gray-500 flex items-start">
        <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
        <p>
          Los viajes se muestran agrupados por fecha. Utiliza los filtros para encontrar viajes específicos.
        </p>
      </div>

      {/* Diálogo de confirmación para eliminar viaje */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el viaje seleccionado y no se puede deshacer.
              También eliminará todos los subviajes asociados, si existen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {deleteTripMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}