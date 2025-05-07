import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircleIcon } from "lucide-react";
import { getCityName, groupSegmentsByCity, isSameCity } from "@/lib/utils";
import { PriceInput } from "@/components/ui/price-input";
import { useAuth } from "@/hooks/use-auth";
import { Route } from "@shared/schema";
import { publishTripValidationSchema } from "@/lib/validations";

// Tipos para el formulario de edición - reutilizados de publish-trip-form
type StopTime = {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  location: string;
};

type SegmentPrice = {
  origin: string;
  destination: string;
  price: number;
};

type SegmentTimePrice = SegmentPrice & {
  departureTime?: string;
  arrivalTime?: string;
};

type RouteWithSegments = {
  id: number;
  name: string;
  origin: string;
  destination: string;
  stops: string[];
  segments: { origin: string; destination: string }[];
  companyId?: string;
};

type FormValues = {
  routeId: number;
  startDate: string;
  endDate: string;
  capacity: number;
  availableSeats?: number;
  price: number;
  segmentPrices: SegmentTimePrice[];
  stopTimes?: StopTime[];
  // Nuevos campos para vehículo y conductor
  vehicleId?: number | null;
  driverId?: number | null;
};

export default function EditTripPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [, params] = useRoute<{ id: string }>("/edit-trip/:id");
  const tripId = params ? parseInt(params.id, 10) : null;
  
  const [isLoading, setIsLoading] = useState(true);
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  const [stopTimes, setStopTimes] = useState<StopTime[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  
  // Form validation and handling
  const form = useForm<FormValues>({
    resolver: zodResolver(publishTripValidationSchema),
    defaultValues: {
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      capacity: 18,
      segmentPrices: [],
      stopTimes: [], 
      vehicleId: null,
      driverId: null,
    },
    mode: "onChange",
  });
  
  // Fetch routes for dropdown
  const routesQuery = useQuery({
    queryKey: ["/api/routes"],
    placeholderData: [],
    enabled: true,
    queryFn: async () => {
      console.log("Cargando rutas para formulario...");
      const response = await fetch("/api/routes");
      if (!response.ok) {
        throw new Error("Error al cargar las rutas");
      }
      const data = await response.json();
      console.log("Rutas cargadas para formulario:", data);
      return data;
    },
    retry: 3,
    retryDelay: 1000,
  });

  // Fetch selected route segments when route changes
  const routeSegmentsQuery = useQuery({
    queryKey: ["/api/routes", selectedRouteId, "segments"],
    queryFn: async () => {
      if (!selectedRouteId) return null;
      const res = await fetch(`/api/routes/${selectedRouteId}/segments`);
      return await res.json() as RouteWithSegments;
    },
    enabled: !!selectedRouteId,
  });
  
  // Consulta para obtener vehículos disponibles
  const vehiclesQuery = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles");
      if (!response.ok) {
        throw new Error("Error al cargar vehículos");
      }
      return await response.json();
    },
  });
  
  // Consulta para obtener conductores disponibles (usuarios con rol "chofer")
  const driversQuery = useQuery({
    queryKey: ["/api/users", "chofer"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=chofer");
      if (!response.ok) {
        throw new Error("Error al cargar conductores");
      }
      return await response.json();
    },
  });
  
  // Fetch trip data
  const tripQuery = useQuery({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error("Error al cargar datos del viaje");
      }
      return await response.json();
    },
    enabled: !!tripId,
  });
  
  // Helper para validar y asegurar formato correcto de stopTimes
  const ensureValidStopTimes = (times: any[]): StopTime[] => {
    return times.map(time => {
      if (!time) return null;
      
      // Garantizar que ampm sea "AM" o "PM"
      let ampmValue = (time.ampm || "AM").toUpperCase();
      if (ampmValue !== "AM" && ampmValue !== "PM") {
        ampmValue = "AM";
      }
      
      return {
        hour: time.hour || "12",
        minute: time.minute || "00",
        ampm: ampmValue as "AM" | "PM",
        location: time.location || ""
      };
    }).filter(Boolean) as StopTime[];
  };
  
  // Handle route selection
  const handleRouteChange = (routeId: string) => {
    const id = parseInt(routeId, 10);
    setSelectedRouteId(id);
    form.setValue("routeId", id);
  };
  
  // Handle segment price updates
  const updateSegmentPrice = (index: number, price: number) => {
    const updatedPrices = [...segmentPrices];
    updatedPrices[index] = {
      ...updatedPrices[index],
      price,
    };
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };
  
  // Actualiza todos los precios para una ciudad origen y destino específicas
  const updateCityGroupPrices = (originCity: string, destinationCity: string, price: number) => {
    console.log(`Actualizando precios entre ciudades: ${originCity} -> ${destinationCity} = ${price}`);
    
    // Crear una copia del array de precios
    const updatedPrices = [...segmentPrices];
    
    // Para cada segmento, verificar si pertenece al grupo ciudad origen - ciudad destino
    updatedPrices.forEach((segment, index) => {
      const segmentOriginCity = getCityName(segment.origin);
      const segmentDestCity = getCityName(segment.destination);
      
      // Si el segmento está entre las mismas ciudades, actualizar su precio
      if (segmentOriginCity === originCity && segmentDestCity === destinationCity) {
        console.log(`Aplicando precio ${price} a segmento: ${segment.origin} -> ${segment.destination}`);
        updatedPrices[index] = {
          ...updatedPrices[index],
          price
        };
      }
    });
    
    // Actualizar estado y formulario con todos los precios actualizados
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };
  
  // Actualizar el tiempo de parada directamente desde el input
  const updateStopTime = (index: number, timeString: string) => {
    console.log("Actualizando tiempo de parada...", index, timeString);
    
    const [time, period] = timeString.split(' ');
    const [hour, minute] = time.split(':');
    const ampm = period as "AM" | "PM";
    
    // Obtener la ubicación para este índice
    let stopLocation = "";
    if (routeSegmentsQuery.data) {
      const allLocations = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ];
      stopLocation = allLocations[index] || "";
    }
    
    // Actualizar el array de tiempos, incluyendo la ubicación
    const newStopTimes = [...stopTimes];
    newStopTimes[index] = { 
      hour, 
      minute, 
      ampm,
      location: stopLocation
    };
    
    // Validar el array para asegurar los tipos correctos
    const validatedStopTimes = ensureValidStopTimes(newStopTimes);
    
    // Actualizar el estado con los valores validados
    setStopTimes(validatedStopTimes);
    
    // Actualizar tiempos de segmentos automáticamente
    updateSegmentTimesFromStops(validatedStopTimes);
  };
  
  // Función para calcular los tiempos de los segmentos basados en los tiempos de las paradas
  const updateSegmentTimesFromStops = (stopTimeArray: StopTime[]) => {
    if (!routeSegmentsQuery.data) return;
    
    // Obtener todas las ubicaciones (origen, paradas, destino)
    const allLocations = [
      routeSegmentsQuery.data.origin,
      ...(routeSegmentsQuery.data.stops || []),
      routeSegmentsQuery.data.destination
    ];
    
    // Para cada segmento, encontrar el tiempo de salida y llegada correspondiente
    const updatedSegmentPrices = segmentPrices.map(segment => {
      // Encontrar índice del origen en allLocations
      const originIndex = allLocations.findIndex(location => location === segment.origin);
      // Encontrar índice del destino en allLocations
      const destinationIndex = allLocations.findIndex(location => location === segment.destination);
      
      if (originIndex !== -1 && destinationIndex !== -1 && 
          stopTimeArray[originIndex] && stopTimeArray[destinationIndex]) {
        // Formatear tiempos
        const departureTime = `${stopTimeArray[originIndex]?.hour}:${stopTimeArray[originIndex]?.minute} ${stopTimeArray[originIndex]?.ampm}`;
        const arrivalTime = `${stopTimeArray[destinationIndex]?.hour}:${stopTimeArray[destinationIndex]?.minute} ${stopTimeArray[destinationIndex]?.ampm}`;
        
        return {
          ...segment,
          departureTime,
          arrivalTime
        };
      }
      
      return segment;
    });
    
    setSegmentPrices(updatedSegmentPrices);
    form.setValue("segmentPrices", updatedSegmentPrices);
  };
  
  // Load trip data when trip query completes
  useEffect(() => {
    if (tripQuery.data && !tripQuery.isLoading) {
      const tripData = tripQuery.data;
      console.log("Datos de viaje cargados para edición:", tripData);
      
      // Extraer datos relevantes y establecer en el formulario
      setSelectedRouteId(tripData.routeId);
      
      // Setear los valores en el formulario
      form.setValue("routeId", tripData.routeId);
      form.setValue("startDate", tripData.date || tripData.departureDate);
      form.setValue("endDate", tripData.date || tripData.departureDate);
      form.setValue("capacity", tripData.capacity);
      
      // Establecer vehículo y conductor si existen
      if (tripData.vehicleId) {
        form.setValue("vehicleId", tripData.vehicleId);
      }
      
      if (tripData.driverId) {
        form.setValue("driverId", tripData.driverId);
      }
    }
  }, [tripQuery.data, tripQuery.isLoading, form]);
  
  // Initialize times when the route segments load
  useEffect(() => {
    if (routeSegmentsQuery.data && !routeSegmentsQuery.isLoading && tripQuery.data) {
      const tripData = tripQuery.data;
      
      // Una vez que tenemos los segmentos, podemos cargar los precios y horarios
      console.log("Cargando precios y horarios de segmentos...", tripData.segmentPrices);
      
      // Si el viaje tiene precios de segmentos guardados, usarlos
      if (Array.isArray(tripData.segmentPrices) && tripData.segmentPrices.length > 0) {
        // Actualizar los precios en el estado local
        setSegmentPrices(tripData.segmentPrices);
        
        // Asignar valores al formulario
        form.setValue("segmentPrices", tripData.segmentPrices);
        
        // Si hay información de tiempos de parada, cargarla también
        if (tripData.stopTimes && Array.isArray(tripData.stopTimes)) {
          setStopTimes(ensureValidStopTimes(tripData.stopTimes));
        } else {
          // Intentar reconstruir los tiempos de parada a partir de los tiempos de segmentos
          reconstructStopTimesFromSegments(tripData.segmentPrices);
        }
      } else {
        // Si no hay precios de segmentos, inicializar con los segmentos de la ruta
        initializeFromRouteSegments();
      }
      
      // Marcar como cargado
      setIsLoading(false);
    }
  }, [routeSegmentsQuery.data, routeSegmentsQuery.isLoading, tripQuery.data, form]);
  
  // Función para reconstruir los tiempos de parada a partir de los tiempos de segmentos
  const reconstructStopTimesFromSegments = (segmentPrices: SegmentTimePrice[]) => {
    if (!routeSegmentsQuery.data || !segmentPrices || segmentPrices.length === 0) return;
    
    // Obtener todas las ubicaciones de la ruta (origen, paradas, destino)
    const allLocations = [
      routeSegmentsQuery.data.origin,
      ...(routeSegmentsQuery.data.stops || []),
      routeSegmentsQuery.data.destination
    ];
    
    // Crear un mapa para almacenar los tiempos por ubicación
    const locationTimes: Record<string, { hour: string; minute: string; ampm: "AM" | "PM" }> = {};
    
    // Procesar cada segmento para extraer tiempos
    segmentPrices.forEach(segment => {
      // Si tiene tiempo de salida
      if (segment.departureTime) {
        const [time, period] = segment.departureTime.split(' ');
        const [hour, minute] = time.split(':');
        const ampm = period as "AM" | "PM";
        
        locationTimes[segment.origin] = { hour, minute, ampm };
      }
      
      // Si tiene tiempo de llegada
      if (segment.arrivalTime) {
        const [time, period] = segment.arrivalTime.split(' ');
        const [hour, minute] = time.split(':');
        const ampm = period as "AM" | "PM";
        
        locationTimes[segment.destination] = { hour, minute, ampm };
      }
    });
    
    // Crear el array de tiempos de parada
    const newStopTimes = allLocations.map((location, index) => {
      if (locationTimes[location]) {
        return {
          ...locationTimes[location],
          location
        };
      } else {
        // Si no hay información para esta ubicación, usar valor predeterminado
        return {
          hour: "08",
          minute: "00",
          ampm: "AM" as "AM" | "PM",
          location
        };
      }
    });
    
    // Aplicar los tiempos reconstruidos
    setStopTimes(ensureValidStopTimes(newStopTimes));
  };
  
  // Inicializar segmentos de precios y tiempos de parada desde la ruta
  const initializeFromRouteSegments = () => {
    if (!routeSegmentsQuery.data) return;
    
    // Inicializar los precios de segmentos
    const route = routeSegmentsQuery.data;
    
    // Verificar que route.segments existe antes de usar filter
    if (route.segments && Array.isArray(route.segments)) {
      const segments = route.segments.filter(
        segment => segment && segment.origin && segment.destination && 
        !isSameCity(segment.origin, segment.destination)
      );
      
      const segmentPricesWithDefaultValues = segments.map(segment => ({
        origin: segment.origin,
        destination: segment.destination,
        price: 0
      }));
      
      setSegmentPrices(segmentPricesWithDefaultValues);
      form.setValue("segmentPrices", segmentPricesWithDefaultValues);
    }
    
    // Inicializar tiempos de parada
    // Crear un array con el origen, las paradas y el destino
    const allLocations = [
      routeSegmentsQuery.data.origin,
      ...(routeSegmentsQuery.data.stops || []),
      routeSegmentsQuery.data.destination
    ];
    const totalStops = allLocations.length;
    
    // Inicializar tiempos para cada parada
    const initialTimes = Array(totalStops).fill(null);
    
    // Tiempo de origen (salida)
    initialTimes[0] = {
      hour: "08",
      minute: "00",
      ampm: "AM",
      location: allLocations[0] || ""
    };
    
    // Tiempo de destino (llegada)
    initialTimes[initialTimes.length - 1] = {
      hour: "12",
      minute: "00",
      ampm: "PM",
      location: allLocations[allLocations.length - 1] || ""
    };
    
    // Inicializar tiempos intermedios proporcionalmente
    if (totalStops > 2) {
      for (let i = 1; i < totalStops - 1; i++) {
        // Para paradas intermedias, creamos tiempos proporcionales
        initialTimes[i] = {
          hour: "10",
          minute: "00",
          ampm: "AM",
          location: allLocations[i] || ""
        };
      }
    }
    
    // Asegurar que los valores son del tipo correcto antes de establecer el estado
    setStopTimes(ensureValidStopTimes(initialTimes));
  };
  
  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    // Incluir los segmentPrices y stopTimes
    data.segmentPrices = segmentPrices;
    data.stopTimes = stopTimes;
    
    console.log("Enviando formulario de edición:", data);
    
    try {
      // Enviar la actualización al servidor
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el viaje");
      }
      
      toast({
        title: "Viaje actualizado",
        description: "El viaje se ha actualizado correctamente.",
      });
      
      // Regresar a la página de viajes
      setLocation("/publish-trip");
    } catch (error) {
      console.error("Error al actualizar viaje:", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar viaje",
        description: "No se pudo actualizar la información del viaje."
      });
    }
  };
  
  // Regresar a la lista de viajes
  const handleCancel = () => {
    setLocation("/publish-trip");
  };
  
  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <p>Debe iniciar sesión para acceder a esta página.</p>
      </div>
    );
  }
  
  if (!tripId) {
    return (
      <div className="container mx-auto p-8">
        <p>ID de viaje no válido.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Editar Viaje</h1>
          <p className="text-muted-foreground">Modifique la información del viaje</p>
        </div>
        <Button variant="outline" onClick={handleCancel}>Volver</Button>
      </div>
      
      <div className="bg-card rounded-lg border shadow-sm p-6 relative">
        {/* Capa de carga */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-50 rounded-lg">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm font-medium">Cargando datos del viaje...</p>
            </div>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Sección básica del formulario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Selector de ruta (deshabilitado en edición) */}
              <FormField
                control={form.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ruta</FormLabel>
                    <Select
                      disabled={true} // Deshabilitado en modo edición
                      value={String(field.value) || ""}
                      onValueChange={() => {}}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Cargando ruta..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {routesQuery.data?.map((route: Route) => (
                          <SelectItem key={route.id} value={String(route.id)}>
                            {route.name} ({route.origin} → {route.destination})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      La ruta no se puede cambiar al editar un viaje.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Capacidad del vehículo */}
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="1"
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      Número máximo de pasajeros.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Fecha de viaje */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha del Viaje</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Fecha programada para este viaje.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Selector de vehículo */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehículo</FormLabel>
                    <Select
                      disabled={vehiclesQuery.isLoading}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(value ? parseInt(value, 10) : null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un vehículo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {vehiclesQuery.data?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.brand} {vehicle.model} ({vehicle.plates})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Asigne un vehículo a este viaje.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Selector de conductor */}
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conductor</FormLabel>
                    <Select
                      disabled={driversQuery.isLoading}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(value ? parseInt(value, 10) : null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un conductor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {driversQuery.data?.map((driver) => (
                          <SelectItem key={driver.id} value={String(driver.id)}>
                            {driver.firstName} {driver.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Asigne un conductor a este viaje.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Detalles de precios y tiempos (cuando se selecciona una ruta) */}
            {selectedRouteId && routeSegmentsQuery.data && (
              <Tabs defaultValue="stop-times">
                <TabsList className="mb-2 w-full flex flex-wrap justify-start">
                  <TabsTrigger value="segments" className="flex-grow text-xs sm:text-sm">
                    <span className="hidden xs:inline">Precios por </span>
                    <span>Segmento</span>
                  </TabsTrigger>
                  <TabsTrigger value="stop-times" className="flex-grow text-xs sm:text-sm">
                    <span className="hidden xs:inline">Tiempos de </span>
                    <span>Parada</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="segments">
                  <div className="space-y-4">
                    <div className="flex items-center mb-4">
                      <p className="text-sm text-gray-500 mr-1">
                        Configure el precio de cada segmento del viaje.
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircleIcon className="h-4 w-4 text-primary/70 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="w-80 p-4">
                            <p>Los precios de cada tramo se configuran independientemente.</p>
                            <p className="mt-2">Los horarios se establecen automáticamente basados en los tiempos de parada que configure en la pestaña "Tiempos de Parada".</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Vista móvil - Configuración por ciudades */}
                    <div className="md:hidden space-y-4 mb-6">
                      <h3 className="text-sm font-semibold mb-2">Configuración por ciudades</h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Configure el precio entre ciudades principales. Este precio se aplicará automáticamente
                        a todas las combinaciones de paradas entre las mismas ciudades.
                      </p>
                      
                      {(() => {
                        const { cityGroups, cityPairs } = groupSegmentsByCity(segmentPrices);
                        
                        return cityPairs.map((cityPair: {origin: string, destination: string}, idx: number) => {
                          const key = `${cityPair.origin}||${cityPair.destination}`;
                          const groupSegments = cityGroups[key] || [];
                          const firstSegment = groupSegments[0] || { price: 0 };
                          
                          return (
                            <div key={`city-card-${idx}`} className="border rounded-md p-3 bg-primary/5 shadow-sm">
                              <div className="font-medium text-sm text-primary mb-2">
                                {cityPair.origin} → {cityPair.destination}
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Precio</div>
                                  <PriceInput
                                    value={firstSegment.price}
                                    onChange={(e) => {
                                      // Convertir el valor a número, con manejo especial para cadenas vacías
                                      const inputValue = e.target.value;
                                      let newPrice = 0;
                                      
                                      if (inputValue.trim() !== '') {
                                        const parsedValue = parseInt(inputValue, 10);
                                        if (!isNaN(parsedValue)) {
                                          newPrice = parsedValue;
                                        }
                                      }
                                      
                                      console.log("Actualizando precio de ciudad (móvil):", inputValue, "->", newPrice);
                                      
                                      // Usar la nueva función para actualizar todos los precios entre estas ciudades
                                      updateCityGroupPrices(cityPair.origin, cityPair.destination, newPrice);
                                    }}
                                    className="w-full"
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Afecta a {groupSegments.length} combinaciones de paradas
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    {/* Versión móvil - tarjetas de segmentos específicos */}
                    <div className="md:hidden space-y-4">
                      <h3 className="text-sm font-semibold mb-2">Detalles por parada específica</h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Aquí puede ver los precios aplicados a cada combinación de paradas específicas.
                      </p>
                      
                      {segmentPrices.map((segment, index) => (
                        <div key={`segment-card-${index}`} className="border rounded-md p-3 bg-white shadow-sm">
                          <div className="font-medium text-sm text-primary mb-1">
                            {segment.origin} → {segment.destination}
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Precio</div>
                              <PriceInput
                                value={segment.price}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  let newPrice = 0;
                                  
                                  if (inputValue.trim() !== '') {
                                    const parsedValue = parseInt(inputValue, 10);
                                    if (!isNaN(parsedValue)) {
                                      newPrice = parsedValue;
                                    }
                                  }
                                  
                                  updateSegmentPrice(index, newPrice);
                                }}
                                className="w-full"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Hora salida</div>
                                <div className="text-sm font-medium">
                                  {segment.departureTime || "No definido"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Hora llegada</div>
                                <div className="text-sm font-medium">
                                  {segment.arrivalTime || "No definido"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Vista de escritorio: Tabla de segmentos */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-2">Origen</th>
                            <th className="text-left p-2">Destino</th>
                            <th className="text-left p-2">Precio</th>
                            <th className="text-left p-2">Hora salida</th>
                            <th className="text-left p-2">Hora llegada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segmentPrices.map((segment, index) => (
                            <tr key={index} className="border-b hover:bg-muted/20">
                              <td className="p-2">{segment.origin}</td>
                              <td className="p-2">{segment.destination}</td>
                              <td className="p-2 w-32">
                                <PriceInput
                                  value={segment.price}
                                  onChange={(e) => {
                                    // Convertir el valor a número
                                    const value = parseInt(e.target.value, 10) || 0;
                                    updateSegmentPrice(index, value);
                                  }}
                                  className="w-full"
                                />
                              </td>
                              <td className="p-2">{segment.departureTime || "No definido"}</td>
                              <td className="p-2">{segment.arrivalTime || "No definido"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Vista de escritorio: Configuración por ciudades */}
                    <div className="hidden md:block mt-8">
                      <h3 className="text-sm font-semibold mb-2">Configuración rápida por ciudades</h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Establezca precios entre ciudades para actualizar automáticamente todas las paradas entre ellas.
                      </p>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {(() => {
                          const { cityGroups, cityPairs } = groupSegmentsByCity(segmentPrices);
                          
                          return cityPairs.map((cityPair: {origin: string, destination: string}, idx: number) => {
                            const key = `${cityPair.origin}||${cityPair.destination}`;
                            const groupSegments = cityGroups[key] || [];
                            const firstSegment = groupSegments[0] || { price: 0 };
                            
                            return (
                              <div key={`city-group-${idx}`} className="border rounded-lg p-3 bg-background shadow-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className="font-medium">{cityPair.origin}</div>
                                    <span>→</span>
                                    <div className="font-medium">{cityPair.destination}</div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-muted-foreground">
                                      ({groupSegments.length} combinaciones)
                                    </span>
                                    <PriceInput
                                      value={firstSegment.price}
                                      onChange={(e) => {
                                        // Convertir el valor a número
                                        const value = parseInt(e.target.value, 10) || 0;
                                        updateCityGroupPrices(cityPair.origin, cityPair.destination, value);
                                      }}
                                      className="w-24"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="stop-times">
                  <div className="space-y-4">
                    <div className="flex items-center mb-4">
                      <p className="text-sm text-gray-500 mr-1">
                        Defina los horarios para cada parada de la ruta.
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircleIcon className="h-4 w-4 text-primary/70 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="w-80 p-4">
                            <p>Los horarios definidos aquí se utilizarán para calcular automáticamente los tiempos de salida y llegada de cada segmento.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    {/* Vista móvil - tarjetas de paradas */}
                    <div className="md:hidden space-y-4">
                      {stopTimes.map((stop, index) => {
                        // Determinar etiqueta (Origen, Destino o Parada #)
                        let stopLabel;
                        if (index === 0) {
                          stopLabel = "Origen";
                        } else if (index === stopTimes.length - 1) {
                          stopLabel = "Destino";
                        } else {
                          stopLabel = `Parada ${index}`;
                        }
                        
                        return (
                          <div key={`stop-card-${index}`} className="border rounded-md p-3 bg-white shadow-sm">
                            <div className="font-medium text-sm mb-1">
                              <span className="text-primary">{stopLabel}: </span>
                              {stop.location}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Hora</div>
                                <select 
                                  value={stop.hour}
                                  onChange={(e) => {
                                    const newStopTime = { ...stop, hour: e.target.value };
                                    const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                    updateStopTime(index, timeString);
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((hour) => (
                                    <option key={hour} value={hour}>{hour}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Minuto</div>
                                <select 
                                  value={stop.minute}
                                  onChange={(e) => {
                                    const newStopTime = { ...stop, minute: e.target.value };
                                    const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                    updateStopTime(index, timeString);
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                  {["00", "15", "30", "45"].map((minute) => (
                                    <option key={minute} value={minute}>{minute}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">AM/PM</div>
                                <select 
                                  value={stop.ampm}
                                  onChange={(e) => {
                                    const newStopTime = { ...stop, ampm: e.target.value as "AM" | "PM" };
                                    const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                    updateStopTime(index, timeString);
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Vista de escritorio: Tabla de paradas */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-2">Parada</th>
                            <th className="text-left p-2">Ubicación</th>
                            <th className="text-left p-2">Hora</th>
                            <th className="text-left p-2">Minuto</th>
                            <th className="text-left p-2">AM/PM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stopTimes.map((stop, index) => {
                            // Determinar etiqueta (Origen, Destino o Parada #)
                            let stopLabel;
                            if (index === 0) {
                              stopLabel = "Origen";
                            } else if (index === stopTimes.length - 1) {
                              stopLabel = "Destino";
                            } else {
                              stopLabel = `Parada ${index}`;
                            }
                            
                            return (
                              <tr key={index} className="border-b hover:bg-muted/20">
                                <td className="p-2 font-medium">
                                  {stopLabel}
                                </td>
                                <td className="p-2">{stop.location}</td>
                                <td className="p-2 w-24">
                                  <select 
                                    value={stop.hour}
                                    onChange={(e) => {
                                      const newStopTime = { ...stop, hour: e.target.value };
                                      const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                      updateStopTime(index, timeString);
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((hour) => (
                                      <option key={hour} value={hour}>{hour}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2 w-24">
                                  <select 
                                    value={stop.minute}
                                    onChange={(e) => {
                                      const newStopTime = { ...stop, minute: e.target.value };
                                      const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                      updateStopTime(index, timeString);
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                  >
                                    {["00", "15", "30", "45"].map((minute) => (
                                      <option key={minute} value={minute}>{minute}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2 w-24">
                                  <select 
                                    value={stop.ampm}
                                    onChange={(e) => {
                                      const newStopTime = { ...stop, ampm: e.target.value as "AM" | "PM" };
                                      const timeString = `${newStopTime.hour}:${newStopTime.minute} ${newStopTime.ampm}`;
                                      updateStopTime(index, timeString);
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
            
            <div className="flex justify-end space-x-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
              >
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}