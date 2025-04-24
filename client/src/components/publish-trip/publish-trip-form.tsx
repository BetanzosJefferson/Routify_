import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { InfoIcon, Loader2Icon, CalendarPlusIcon, XIcon, HelpCircleIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { publishTripValidationSchema, type Route, type RouteWithSegments, type SegmentPrice } from "@shared/schema";
import { generateSegmentsFromRoute, isSameCity } from "@/lib/utils";
import TripList from "./trip-list";

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
  vehicleType: string;
  segmentPrices: SegmentTimePrice[];
  stopTimes?: StopTime[];
};

export function PublishTripForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  const [stopTimes, setStopTimes] = useState<Array<{hour: string, minute: string, ampm: "AM" | "PM", location?: string} | null>>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);

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

  // Form validation and handling
  const form = useForm<FormValues>({
    resolver: zodResolver(publishTripValidationSchema),
    defaultValues: {
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      capacity: 18,
      price: 450,
      vehicleType: "standard",
      segmentPrices: [],
    },
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
        
        const segmentPricesWithDefaultValues = segments.map(segment => ({
          origin: segment.origin,
          destination: segment.destination,
          price: 0
        }));
        
        setSegmentPrices(segmentPricesWithDefaultValues);
        form.setValue("segmentPrices", segmentPricesWithDefaultValues);
      } else {
        console.warn("No se encontraron segmentos en la ruta seleccionada o la estructura es incorrecta", route);
        setSegmentPrices([]);
        form.setValue("segmentPrices", []);
      }
    }
  }, [routeSegmentsQuery.data, form]);

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
  
  // Initialize the time arrays when the route is selected
  useEffect(() => {
    if (routeSegmentsQuery.data) {
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
      
      setStopTimes(initialTimes);
    }
  }, [routeSegmentsQuery.data]);

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
    setStopTimes(newStopTimes);
    
    // Actualizar tiempos de segmentos automáticamente
    updateSegmentTimesFromStops(newStopTimes);
  };

  // Función para calcular los tiempos de los segmentos basados en los tiempos de las paradas
  const updateSegmentTimesFromStops = (stopTimeArray: Array<{hour: string, minute: string, ampm: "AM" | "PM", location?: string} | null>) => {
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

  // Mutation for publishing trips
  const publishTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to publish trip");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error publishing trip:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Viaje publicado exitosamente",
        description: "El viaje ha sido publicado para el rango de fechas seleccionado.",
      });
      
      // Reset form to default state but keep the selected route
      form.reset({
        ...form.getValues(),
        segmentPrices: [...segmentPrices],
      });
      
      // Invalidate trips cache
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Volver a la lista de viajes
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Error al publicar el viaje",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    const { capacity } = data;
    
    // Verificar que se ha seleccionado un ID de ruta
    if (!selectedRouteId) {
      toast({
        title: "Error de validación",
        description: "Debe seleccionar una ruta",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar que todos los segmentos tienen precios
    const hasInvalidPrices = segmentPrices.some(segment => segment.price <= 0);
    if (hasInvalidPrices) {
      toast({
        title: "Error de validación",
        description: "Todos los segmentos deben tener un precio válido",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar que todos los tiempos de paradas están configurados
    const hasInvalidStopTimes = stopTimes.some(stop => stop === null);
    if (hasInvalidStopTimes) {
      toast({
        title: "Error de validación",
        description: "Debe configurar el tiempo para todas las paradas",
        variant: "destructive",
      });
      return;
    }
    
    // Preparar los tiempos de las paradas
    const formattedStopTimes = stopTimes
      .filter(stop => stop !== null && stop.hour && stop.minute && stop.ampm)
      .map(stop => {
        return {
          hour: stop!.hour,
          minute: stop!.minute,
          ampm: stop!.ampm,
          location: stop!.location || ""
        };
      });
    
    // Preparar datos comunes para crear o actualizar
    const tripData = {
      ...data,
      routeId: selectedRouteId,
      capacity,
      price: Number(data.price),
      segmentPrices,
      stopTimes: formattedStopTimes,
      availableSeats: capacity // Inicializa availableSeats con la capacidad
    };
    
    console.log("Datos del viaje a enviar:", tripData);
    
    if (editingTripId) {
      // Si estamos editando un viaje, usar PUT
      updateTripMutation.mutate(tripData);
    } else {
      // Si estamos creando un nuevo viaje, usar POST
      publishTripMutation.mutate(tripData);
    }
  };
  
  // Mutation para actualizar un viaje existente
  const updateTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await fetch(`/api/trips/${editingTripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Viaje actualizado",
        description: "El viaje ha sido actualizado exitosamente.",
      });
      
      // Invalidar caché y volver a la lista
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      setShowForm(false);
      setEditingTripId(null);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar viaje",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle showing the form for a new trip
  const handleNewTrip = () => {
    // Reset the form
    form.reset({
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      capacity: 18,
      price: 450,
      vehicleType: "standard",
      segmentPrices: [],
    });
    setSelectedRouteId(null);
    setSegmentPrices([]);
    setStopTimes([]);
    setEditingTripId(null);
    setShowForm(true);
  };
  
  // Handle editing an existing trip
  const handleEditTrip = (tripId: number) => {
    // Fetch trip details first
    fetch(`/api/trips/${tripId}`)
      .then(res => res.json())
      .then(trip => {
        console.log("Trip to edit:", trip);
        
        if (!trip || !trip.id) {
          toast({
            title: "Error",
            description: "No se pudo cargar la información del viaje.",
            variant: "destructive",
          });
          return;
        }
        
        // Inicializar stopTimes desde los datos del viaje si están disponibles
        const stopTimesFromTrip = trip.stopTimes || [];
        let allStopTimes: Array<{hour: string, minute: string, ampm: "AM" | "PM", location?: string} | null> = [];
        
        if (stopTimesFromTrip.length > 0) {
          allStopTimes = stopTimesFromTrip.map((stop: any) => ({
            hour: stop.hour || "00",
            minute: stop.minute || "00",
            ampm: stop.ampm || "AM",
            location: stop.location || ""
          }));
        }
        
        // Inicializar segmentPrices desde los datos del viaje
        const segmentPricesFromTrip = trip.segmentPrices || [];
        
        // Establecer los estados
        setEditingTripId(tripId);
        setSelectedRouteId(trip.routeId);
        setSegmentPrices(segmentPricesFromTrip);
        setStopTimes(allStopTimes);
        
        // Actualizar el formulario
        form.reset({
          routeId: trip.routeId,
          startDate: trip.startDate.split("T")[0],
          endDate: trip.endDate.split("T")[0],
          capacity: trip.capacity,
          price: trip.price,
          vehicleType: trip.vehicleType || "standard",
          segmentPrices: segmentPricesFromTrip,
          stopTimes: stopTimesFromTrip
        });
        
        // Mostrar el formulario
        setShowForm(true);
      })
      .catch(error => {
        console.error("Error loading trip details", error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información del viaje.",
          variant: "destructive",
        });
      });
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Publicación de Viajes</h1>
          <Button onClick={handleNewTrip} className="space-x-2">
            <CalendarPlusIcon className="h-4 w-4" />
            <span>Nuevo Viaje</span>
          </Button>
        </div>
      )}
      
      {showForm ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">
                {editingTripId ? "Editar Viaje" : "Publicar Nuevo Viaje"}
              </h1>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowForm(false);
                  setEditingTripId(null);
                }}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Selección de ruta */}
                  <FormField
                    control={form.control}
                    name="routeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruta</FormLabel>
                        <Select 
                          onValueChange={handleRouteChange}
                          defaultValue={field.value.toString()}
                          value={selectedRouteId?.toString() || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar ruta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routesQuery.data?.map((route: Route) => (
                              <SelectItem key={route.id} value={route.id.toString()}>
                                {route.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Tipo de vehículo */}
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Vehículo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Estándar</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                            <SelectItem value="economy">Económico</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Fecha de fin */}
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Fin</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
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
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Precio */}
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Base</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {selectedRouteId && routeSegmentsQuery.data && (
                  <Tabs defaultValue="stop-times">
                    <TabsList className="mb-2">
                      <TabsTrigger value="segments">Precios por Segmento</TabsTrigger>
                      <TabsTrigger value="stop-times">Tiempos de Parada</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="segments">
                      <div className="overflow-x-auto">
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

                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario de Salida</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario de Llegada</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {segmentPrices.map((segment, index) => (
                              <tr key={`segment-${index}`} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{segment.origin}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{segment.destination}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  <Input
                                    type="number"
                                    value={segment.price}
                                    onChange={(e) => updateSegmentPrice(index, parseInt(e.target.value) || 0)}
                                    className="w-24"
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
                    </TabsContent>
                    
                    <TabsContent value="stop-times">
                      <p className="text-sm text-gray-500 mb-4">
                        Configure los tiempos estimados de llegada a cada parada de la ruta. Estos tiempos se utilizarán en itinerarios y 
                        para calcular estimaciones de tiempo para pasajeros.
                      </p>
                      <p className="text-sm text-primary-foreground bg-primary/10 p-3 rounded mb-4">
                        Edite directamente los horarios haciendo clic en el campo de tiempo. Los cambios actualizarán automáticamente 
                        los tiempos de salida y llegada para cada segmento de viaje.
                      </p>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {routeSegmentsQuery.data && [
                              routeSegmentsQuery.data.origin,
                              ...(routeSegmentsQuery.data.stops || []),
                              routeSegmentsQuery.data.destination
                            ].map((location, index) => (
                              <tr key={`stop-${index}`} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {index === 0 ? (
                                    <span className="text-primary">Origen: {location}</span>
                                  ) : routeSegmentsQuery.data?.origin && index === [
                                      routeSegmentsQuery.data.origin, 
                                      ...(routeSegmentsQuery.data.stops || []), 
                                      routeSegmentsQuery.data.destination
                                    ].length - 1 ? (
                                    <span className="text-primary">Destino: {location}</span>
                                  ) : (
                                    <span>Parada {index}: {location}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  <TimeInput
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
                    </TabsContent>
                  </Tabs>
                )}
                
                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="mr-2"
                    onClick={() => {
                      setShowForm(false);
                      setEditingTripId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={publishTripMutation.isPending || updateTripMutation.isPending}
                    className="ml-2"
                  >
                    {(publishTripMutation.isPending || updateTripMutation.isPending) && (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingTripId ? "Actualizar Viaje" : "Publicar Viaje"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        // Mostrar la lista de viajes cuando no se muestra el formulario
        <TripList onEditTrip={handleEditTrip} />
      )}
      
      <div className="text-sm text-gray-500 pt-4">
        <p className="flex items-center">
          <InfoIcon className="h-4 w-4 mr-2 text-primary" />
          Los horarios de parada se utilizan para calcular tiempos estimados de llegada a cada ubicación.
        </p>
      </div>
    </div>
  );
}