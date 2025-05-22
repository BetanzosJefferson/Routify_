import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HelpCircleIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TimeInput } from "@/components/ui/time-input";
import { publishTripValidationSchema, type Route, type RouteWithSegments, type SegmentPrice, TripVisibility } from "@shared/schema";
import { generateSegmentsFromRoute, isSameCity, getCityName, groupSegmentsByCity } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

type StopTime = {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  location: string;
};

type SegmentTimePrice = SegmentPrice & {
  departureTime?: string;
  arrivalTime?: string;
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
  // Campo para visibilidad
  visibility?: string;
};

interface EditTripFormProps {
  tripId: number;
}

export function EditTripForm({ tripId }: EditTripFormProps) {
  const { toast } = useToast();
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  
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
  
  const [stopTimes, setStopTimes] = useState<StopTime[]>([]);
  
  // Fetch tripData
  const tripQuery = useQuery({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error("Error al cargar datos del viaje");
      }
      return await response.json();
    }
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
    enabled: true, // Siempre habilitada para edición
  });
  
  // Consulta para obtener conductores disponibles (usuarios con rol "chofer")
  const driversQuery = useQuery({
    queryKey: ["/api/users", "chofer"],
    queryFn: async () => {
      // Importante: usar "chofer" en minúsculas para que coincida con el filtro del backend
      const response = await fetch("/api/users?role=chofer");
      if (!response.ok) {
        throw new Error("Error al cargar conductores");
      }
      
      const allUsers = await response.json();
      // Filtrar explícitamente en el frontend para asegurar que solo se muestren choferes
      const drivers = allUsers.filter((user: any) => user.role === "chofer");
      console.log("Conductores filtrados (solo rol chofer):", drivers);
      
      return drivers;
    },
    enabled: true, // Siempre habilitada para edición
  });

  // Form validation and handling
  const form = useForm<FormValues>({
    resolver: zodResolver(publishTripValidationSchema),
    defaultValues: {
      routeId: 0,
      startDate: "",
      endDate: "",
      capacity: 18,
      segmentPrices: [],
      stopTimes: [],
      vehicleId: null,
      driverId: null,
      visibility: TripVisibility.PUBLISHED,
    },
    mode: "onChange",
  });

  // Update segment prices when route changes
  useEffect(() => {
    if (routeSegmentsQuery.data) {
      const route = routeSegmentsQuery.data;
      
      // Verificar que route.segments existe antes de usar filter
      if (route.segments && Array.isArray(route.segments)) {
        const segments = route.segments.filter(
          segment => segment && segment.origin && segment.destination && 
          !isSameCity(segment.origin, segment.destination)
        );
        
        // Mantener los precios existentes si ya están cargados
        if (segmentPrices.length > 0) {
          console.log("Manteniendo precios de segmentos existentes:", segmentPrices);
        } else {
          const segmentPricesWithDefaultValues = segments.map(segment => ({
            origin: segment.origin,
            destination: segment.destination,
            price: 0
          }));
          
          setSegmentPrices(segmentPricesWithDefaultValues);
          form.setValue("segmentPrices", segmentPricesWithDefaultValues);
        }
      } else {
        console.warn("No se encontraron segmentos en la ruta seleccionada o la estructura es incorrecta", route);
      }
    }
  }, [routeSegmentsQuery.data, form]);

  // Handle route selection
  const handleRouteChange = (routeId: string) => {
    const id = parseInt(routeId, 10);
    setSelectedRouteId(id);
    form.setValue("routeId", id);
  };

  // Cargar los datos del viaje cuando se obtienen de la API
  useEffect(() => {
    if (tripQuery.data && !form.formState.isDirty) {
      const tripData = tripQuery.data;
      console.log("Datos de viaje cargados para edición:", tripData);
      
      // Establecer routeId y seleccionar la ruta
      setSelectedRouteId(tripData.routeId);
      form.setValue("routeId", tripData.routeId);
      
      // Convertir la fecha a formato YYYY-MM-DD para el input type="date"
      const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };
      
      // Establecer fechas en formato correcto para input date
      const formattedDate = formatDateForInput(tripData.date || tripData.departureDate);
      console.log("Fecha formateada para input:", formattedDate);
      
      form.setValue("startDate", formattedDate);
      form.setValue("endDate", formattedDate);
      
      // Establecer capacidad
      form.setValue("capacity", tripData.capacity);
      
      // Establecer vehículo y conductor si existen
      if (tripData.vehicleId) {
        form.setValue("vehicleId", tripData.vehicleId);
      }
      
      if (tripData.driverId) {
        form.setValue("driverId", tripData.driverId);
      }
      
      // Establecer visibilidad y estado del viaje
      if (tripData.visibility) {
        form.setValue("visibility", tripData.visibility);
      } else {
        // Valor por defecto: publicado
        form.setValue("visibility", TripVisibility.PUBLISHED);
      }
    }
  }, [tripQuery.data, form]);

  // Cargar precios de segmentos y tiempos de parada una vez que la ruta está cargada
  useEffect(() => {
    if (tripQuery.data && routeSegmentsQuery.data && !form.formState.isDirty) {
      const tripData = tripQuery.data;
      
      // Si el viaje tiene precios de segmentos guardados, usarlos
      if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices) && tripData.segmentPrices.length > 0) {
        console.log("Cargando precios y horarios de segmentos:", tripData.segmentPrices);
        
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
      }
    }
  }, [tripQuery.data, routeSegmentsQuery.data, form]);

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

  // Actualizar precio de uno o más segmentos
  const updateSegmentPrice = (segmentIndex: number, price: number) => {
    if (!segmentPrices[segmentIndex]) return;
    
    const updatedSegmentPrices = [...segmentPrices];
    updatedSegmentPrices[segmentIndex] = {
      ...updatedSegmentPrices[segmentIndex],
      price: Number(price) // Asegurar que el precio es un número
    };
    
    setSegmentPrices(updatedSegmentPrices);
    form.setValue("segmentPrices", updatedSegmentPrices);
  };

  // Función para transformar los segmentos agrupados en formato adecuado para la UI
  const transformGroupSegmentsForUI = (segments: any[]) => {
    const { cityGroups, cityPairs } = groupSegmentsByCity(segments);
    
    // Convertir a formato de array para la UI
    return cityPairs.map(pair => {
      const key = `${pair.origin}||${pair.destination}`;
      const groupSegments = cityGroups[key] || [];
      const firstSegment = groupSegments[0] || {};
      
      // Asegurar que el precio sea un número válido
      let price = 0;
      if (firstSegment.price !== undefined && firstSegment.price !== null) {
        // Si es una cadena, intentar convertirla
        if (typeof firstSegment.price === 'string') {
          price = parseFloat(firstSegment.price) || 0;
        } else {
          price = Number(firstSegment.price) || 0;
        }
      }
      
      return {
        origin: pair.origin,
        destination: pair.destination,
        price: price,
        count: groupSegments.length
      };
    });
  };

  // Actualizar el precio de grupo de ciudades
  const updateCityGroupPrice = (origin: string, destination: string, price: number) => {
    // Asegurar que el precio es un número
    const numericPrice = Number(price);
    
    // Encontrar todos los segmentos que correspondan a este grupo de ciudades
    const updatedSegmentPrices = segmentPrices.map(segment => {
      if (getCityName(segment.origin) === getCityName(origin) && 
          getCityName(segment.destination) === getCityName(destination)) {
        return { ...segment, price: numericPrice };
      }
      return segment;
    });
    
    setSegmentPrices(updatedSegmentPrices);
    form.setValue("segmentPrices", updatedSegmentPrices);
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
    
    // Actualizar el estado y el formulario
    setSegmentPrices(updatedSegmentPrices);
    form.setValue("segmentPrices", updatedSegmentPrices);
  };

  // Importar useLocation para redirección en React
  const [, navigate] = useLocation();

  // Mutation para actualizar el viaje
  const updateTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      console.log("Enviando datos para actualizar viaje:", data);
      const res = await apiRequest("PUT", `/api/trips/${tripId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Viaje actualizado!",
        description: "El viaje ha sido actualizado correctamente."
      });
      
      // Refresh queries antes de redirigir
      queryClient.invalidateQueries({ queryKey: ["/api/admin-trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Redirigir de vuelta a la lista de viajes publicados usando los parámetros de consulta
      navigate("/?tab=publish-trip");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error al actualizar viaje",
        description: error.message || "Ocurrió un error al guardar los cambios."
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    console.log("Datos de formulario enviados para actualizar:", data);
    // Incluir los tiempos de parada en los datos del formulario
    data.stopTimes = stopTimes;
    
    // Llamar a la mutación para actualizar el viaje
    updateTripMutation.mutate(data);
  };

  // Si está cargando datos, mostrar un spinner
  if (tripQuery.isLoading || routesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        Editar Viaje
      </h3>
      
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
                    disabled={true} // Siempre deshabilitado en modo edición
                    value={String(field.value) || ""}
                    onValueChange={() => {}} // No se puede cambiar
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una ruta" />
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
            
            {/* Fecha de inicio */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Fecha del viaje.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Vehículo */}
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehículo</FormLabel>
                  <Select
                    disabled={vehiclesQuery.isLoading}
                    onValueChange={(value) => field.onChange(value === "0" ? null : Number(value))}
                    value={field.value ? String(field.value) : "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un vehículo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Sin asignar</SelectItem>
                      {vehiclesQuery.data?.map((vehicle: { id: number, model: string, plates: string }) => (
                        <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                          {vehicle.model} - {vehicle.plates}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Conductor */}
            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conductor</FormLabel>
                  <Select
                    disabled={driversQuery.isLoading}
                    onValueChange={(value) => field.onChange(value === "0" ? null : Number(value))}
                    value={field.value ? String(field.value) : "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un conductor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Sin asignar</SelectItem>
                      {driversQuery.data?.map((driver: { id: number, firstName: string, lastName: string }) => (
                        <SelectItem key={driver.id} value={String(driver.id)}>
                          {driver.firstName} {driver.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Visibilidad del viaje */}
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibilidad</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || TripVisibility.PUBLISHED}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione visibilidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={TripVisibility.PUBLISHED}>Publicado</SelectItem>
                      <SelectItem value={TripVisibility.HIDDEN}>Oculto</SelectItem>
                      <SelectItem value={TripVisibility.CANCELLED}>Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Controla si el viaje es visible para reservas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


          </div>
          
          {/* Detalles de precios y tiempos */}
          {selectedRouteId && routeSegmentsQuery.data && (
            <Tabs defaultValue="segments">
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
                      Configure el precio entre ciudades principales. Este precio se aplicará automáticamente a todas las combinaciones de paradas entre las mismas ciudades.
                    </p>
                    
                    {transformGroupSegmentsForUI(segmentPrices).map((group, index) => (
                      <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{getCityName(group.origin)}</span>
                            <span className="mx-2">→</span>
                            <span className="font-medium">{getCityName(group.destination)}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {group.count} {group.count === 1 ? 'combinación' : 'combinaciones'}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <PriceInput
                            value={group.price}
                            onChange={(value: number) => updateCityGroupPrice(group.origin, group.destination, value)}
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Vista de escritorio - Tabla de configuración por ciudades */}
                  <div className="hidden md:block mb-6">
                    <h3 className="text-sm font-semibold mb-2">Configuración por ciudades</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Configure el precio entre ciudades principales. Este precio se aplicará automáticamente a todas las combinaciones de paradas entre las mismas ciudades.
                    </p>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ciudad Origen
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ciudad Destino
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Precio
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Paradas afectadas
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {transformGroupSegmentsForUI(segmentPrices).map((group, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {getCityName(group.origin)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {getCityName(group.destination)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 w-40">
                                <PriceInput
                                  value={group.price}
                                  onChange={(value) => updateCityGroupPrice(group.origin, group.destination, value)}
                                />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {group.count} {group.count === 1 ? 'combinación' : 'combinaciones'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <h3 className="text-sm font-semibold mb-2">Detalles por parada específica</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Aquí puede ver los precios aplicados a cada combinación de paradas específicas. Estos precios se actualizan automáticamente al cambiar los precios por ciudad.
                  </p>
                  
                  {/* Vista móvil para precios por segmento específico */}
                  <div className="md:hidden space-y-4">
                    {segmentPrices.map((segment, index) => (
                      <div key={index} className="bg-white p-3 border rounded-md space-y-2">
                        <div className="flex flex-col space-y-1">
                          <div className="text-xs font-medium text-gray-500">Origen</div>
                          <div className="text-sm">{segment.origin}</div>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <div className="text-xs font-medium text-gray-500">Destino</div>
                          <div className="text-sm">{segment.destination}</div>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <div className="text-xs font-medium text-gray-500">Precio</div>
                          <PriceInput
                            value={segment.price}
                            onChange={(value: number) => updateSegmentPrice(index, value)}
                            className="w-full"
                          />
                        </div>
                        {segment.departureTime && segment.arrivalTime && (
                          <div className="flex flex-col space-y-1">
                            <div className="text-xs font-medium text-gray-500">Horario</div>
                            <div className="text-sm">{segment.departureTime} - {segment.arrivalTime}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Vista escritorio para precios por segmento específico */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Origen
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Destino
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Precio
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Horario Salida
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Horario Llegada
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {segmentPrices.map((segment, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {segment.origin}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {segment.destination}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 w-40">
                              <PriceInput
                                value={segment.price}
                                onChange={(value: number) => updateSegmentPrice(index, value)}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {segment.departureTime || "Pendiente"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {segment.arrivalTime || "Pendiente"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="stop-times">
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <p className="text-sm text-gray-500 mr-1">
                      Configure los tiempos de cada parada del viaje.
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircleIcon className="h-4 w-4 text-primary/70 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="w-80 p-4">
                          <p>Los tiempos de parada se utilizan para calcular automáticamente los tiempos de salida y llegada de cada segmento del viaje.</p>
                          <p className="mt-2">Para cada parada, indique la hora estimada de llegada/salida.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Vista móvil de tiempos de parada */}
                  <div className="md:hidden space-y-4">
                    {routeSegmentsQuery.data && (
                      <>
                        {[
                          routeSegmentsQuery.data.origin,
                          ...(routeSegmentsQuery.data.stops || []),
                          routeSegmentsQuery.data.destination
                        ].map((location, index) => (
                          <div key={index} className="bg-white p-3 border rounded-md space-y-2">
                            <div className="flex flex-col space-y-1">
                              <div className="text-xs font-medium text-gray-500">
                                {index === 0 ? "Origen" : index === ([routeSegmentsQuery.data.origin, ...(routeSegmentsQuery.data.stops || []), routeSegmentsQuery.data.destination].length - 1) ? "Destino" : `Parada ${index}`}
                              </div>
                              <div className="text-sm">{location}</div>
                            </div>
                            <div className="flex flex-col space-y-1">
                              <div className="text-xs font-medium text-gray-500">Hora</div>
                              <TimeInput
                                key={`time-input-mobile-${index}-${stopTimes[index]?.hour || '08'}-${stopTimes[index]?.minute || '00'}-${stopTimes[index]?.ampm || 'AM'}`}
                                value={stopTimes[index] ? `${stopTimes[index]?.hour}:${stopTimes[index]?.minute} ${stopTimes[index]?.ampm}` : "08:00 AM"}
                                onChange={(timeString) => {
                                  updateStopTime(index, timeString);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  
                  {/* Vista escritorio de tiempos de parada */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Parada
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hora
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {routeSegmentsQuery.data && [
                          routeSegmentsQuery.data.origin,
                          ...(routeSegmentsQuery.data.stops || []),
                          routeSegmentsQuery.data.destination
                        ].map((location, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {index === 0 ? (
                                <span className="font-medium">Origen: {location}</span>
                              ) : index === ([routeSegmentsQuery.data.origin, ...(routeSegmentsQuery.data.stops || []), routeSegmentsQuery.data.destination].length - 1) ? (
                                <span className="font-medium">Destino: {location}</span>
                              ) : (
                                <span>Parada {index}: {location}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              <TimeInput
                                key={`time-input-desktop-${index}-${stopTimes[index]?.hour || '08'}-${stopTimes[index]?.minute || '00'}-${stopTimes[index]?.ampm || 'AM'}`}
                                value={stopTimes[index] ? `${stopTimes[index]?.hour}:${stopTimes[index]?.minute} ${stopTimes[index]?.ampm}` : "08:00 AM"}
                                onChange={(timeString) => {
                                  updateStopTime(index, timeString);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate('/publish')}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="w-full md:w-auto"
              disabled={updateTripMutation.isPending}
            >
              {updateTripMutation.isPending && (
                <span className="mr-2 animate-spin">⏳</span>
              )}
              Actualizar Viaje
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}