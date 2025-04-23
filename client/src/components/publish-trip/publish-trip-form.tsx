import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ClockIcon, CalendarIcon, InfoIcon, Loader2Icon, CalendarPlusIcon, XIcon } from "lucide-react";
import { format } from "date-fns";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { publishTripValidationSchema, type Route, type RouteWithSegments, type SegmentPrice } from "@shared/schema";
import { generateSegmentsFromRoute, convertTo24Hour, isSameCity } from "@/lib/utils";

type StopTime = {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  location: string;
};

type FormValues = {
  routeId: number;
  startDate: string;
  endDate: string;
  departureHour: string;
  departureMinute: string;
  departureAmPm: "AM" | "PM";
  arrivalHour: string;
  arrivalMinute: string;
  arrivalAmPm: "AM" | "PM";
  capacity: number;
  availableSeats?: number; // Agregado para inicializar asientos disponibles
  price: number;
  vehicleType: string;
  segmentPrices: SegmentPrice[];
  stopTimes?: StopTime[]; // Agregar tiempos de paradas intermedias
};

export function PublishTripForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<SegmentPrice[]>([]);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [stopTimes, setStopTimes] = useState<Array<{hour: string, minute: string, ampm: "AM" | "PM"} | null>>([]);
  const [currentStopInfo, setCurrentStopInfo] = useState<{name: string, location: string}>({name: "", location: ""});

  // Fetch routes for dropdown
  const routesQuery = useQuery({
    queryKey: ["/api/routes"],
    placeholderData: [],
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
      departureHour: "08",
      departureMinute: "00",
      departureAmPm: "AM",
      arrivalHour: "12",
      arrivalMinute: "00",
      arrivalAmPm: "PM",
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
          price: 0,
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
        hour: form.getValues('departureHour'),
        minute: form.getValues('departureMinute'),
        ampm: form.getValues('departureAmPm'),
        location: allLocations[0] || ""
      };
      
      // Tiempo de destino (llegada)
      initialTimes[initialTimes.length - 1] = {
        hour: form.getValues('arrivalHour'),
        minute: form.getValues('arrivalMinute'),
        ampm: form.getValues('arrivalAmPm'),
        location: allLocations[allLocations.length - 1] || ""
      };
      
      // Inicializar tiempos intermedios proporcionalmente
      if (totalStops > 2) {
        for (let i = 1; i < totalStops - 1; i++) {
          // Para paradas intermedias, creamos tiempos proporcionales
          initialTimes[i] = {
            hour: "00",
            minute: "00",
            ampm: "AM",
            location: allLocations[i] || ""
          };
        }
      }
      
      setStopTimes(initialTimes);
    }
  }, [routeSegmentsQuery.data, form]);

  // Handle opening the time editor dialog
  const handleEditTime = (stopIndex: number) => {
    if (!routeSegmentsQuery.data) return;
    
    setEditingStopIndex(stopIndex);
    
    // Determinar la información de la parada actual
    let stopName = "";
    let stopLocation = "";
    
    if (stopIndex === 0) {
      // Es el origen
      stopName = "Terminal Principal";
      stopLocation = routeSegmentsQuery.data.origin || "Origen";
    } else if (stopIndex === (routeSegmentsQuery.data.stops?.length || 0) + 1) {
      // Es el destino final
      stopName = "Destino Final";
      stopLocation = routeSegmentsQuery.data.destination || "Destino";
    } else if (routeSegmentsQuery.data.stops && routeSegmentsQuery.data.stops[stopIndex - 1]) {
      // Es una parada intermedia
      stopName = `Parada ${stopIndex}`;
      stopLocation = routeSegmentsQuery.data.stops[stopIndex - 1];
    }
    
    setCurrentStopInfo({
      name: stopName,
      location: stopLocation
    });
    
    setShowTimeDialog(true);
  };
  
  // Guardar el tiempo editado
  const saveStopTime = (hour: string, minute: string, ampm: "AM" | "PM") => {
    if (editingStopIndex === null) return;
    
    // Obtener la ubicación para este índice
    let stopLocation = "";
    if (routeSegmentsQuery.data) {
      const allLocations = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ];
      stopLocation = allLocations[editingStopIndex] || "";
    }
    
    // Actualizar el array de tiempos, incluyendo la ubicación
    const newStopTimes = [...stopTimes];
    newStopTimes[editingStopIndex] = { 
      hour, 
      minute, 
      ampm,
      location: stopLocation
    };
    setStopTimes(newStopTimes);
    
    // Si es el origen o el destino, actualizar los valores del formulario
    if (editingStopIndex === 0) {
      // Origen
      form.setValue('departureHour', hour);
      form.setValue('departureMinute', minute);
      form.setValue('departureAmPm', ampm);
    } else if (editingStopIndex === newStopTimes.length - 1) {
      // Destino
      form.setValue('arrivalHour', hour);
      form.setValue('arrivalMinute', minute);
      form.setValue('arrivalAmPm', ampm);
    }
    
    setShowTimeDialog(false);
    
    toast({
      title: "Horario actualizado",
      description: `Se ha configurado el horario para ${currentStopInfo.name} (${currentStopInfo.location}).`,
    });
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
        title: "Trip published successfully",
        description: "Your trip has been published for the selected date range.",
      });
      
      // Reset form to default state but keep the selected route
      const routeId = form.getValues("routeId");
      form.reset({
        ...form.getValues(),
        segmentPrices: [...segmentPrices], // Keep current segment prices
      });
      
      // Invalidate trips cache
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to publish trip",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: FormValues) => {
    // Convertir y preparar datos para el backend
    const capacity = Number(data.capacity);
    
    // Preparar tiempos de parada con información de ubicación
    const formattedStopTimes: StopTime[] = [];
    if (routeSegmentsQuery.data) {
      const allLocations = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ];
      
      stopTimes.forEach((time, index) => {
        if (time && allLocations[index]) {
          formattedStopTimes.push({
            hour: time.hour,
            minute: time.minute,
            ampm: time.ampm,
            location: allLocations[index] || ""
          });
        }
      });
    }
    
    publishTripMutation.mutate({
      ...data,
      capacity,
      availableSeats: capacity, // Inicializar asientos disponibles igual a la capacidad total
      price: Number(data.price),
      segmentPrices: segmentPrices.map(segment => ({
        ...segment,
        price: Number(segment.price)
      })),
      stopTimes: formattedStopTimes, // Agregar los tiempos de parada al enviar el formulario
    });
  };

  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClockIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Publicar Viaje</h2>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Main Trip Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Route Selection */}
                <FormField
                  control={form.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ruta</FormLabel>
                      <Select 
                        onValueChange={handleRouteChange}
                        value={field.value ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar una ruta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {routesQuery.data?.map((route: Route) => (
                            <SelectItem key={route.id} value={String(route.id)}>
                              {route.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Capacity */}
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidad del vehículo</FormLabel>
                      <div className="text-xs text-gray-500 mb-1">Número total de asientos disponibles</div>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Número de pasajeros"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || "")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Vehicle Type */}
                <FormField
                  control={form.control}
                  name="vehicleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de vehículo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo de vehículo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Date Range Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Date */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha del primer viaje</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CalendarIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type="date"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* End Date */}
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha del último viaje</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CalendarIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type="date"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Time Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Departure Time */}
                <div>
                  <FormLabel>Hora de salida</FormLabel>
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="departureHour"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              placeholder="HH"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureMinute"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="MM"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureAmPm"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Arrival Time */}
                <div>
                  <FormLabel>Hora de llegada</FormLabel>
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="arrivalHour"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              placeholder="HH"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalMinute"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="MM"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalAmPm"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              {/* Route Segment Pricing (conditional) */}
              {selectedRouteId && routeSegmentsQuery.data && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {routeSegmentsQuery.data.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Configure los precios por segmento y los tiempos estimados para cada parada de este viaje.
                  </p>
                  
                  <Tabs defaultValue="segment-prices">
                    <TabsList className="mb-6">
                      <TabsTrigger value="segment-prices">Precios por segmento</TabsTrigger>
                      <TabsTrigger value="stop-times">Tiempos de parada</TabsTrigger>
                      <TabsTrigger value="capacity-settings">Capacidad</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="segment-prices">
                      <p className="text-sm text-gray-500 mb-4">
                        Configure los precios para cada segmento de la ruta. Los segmentos entre diferentes ciudades requieren una configuración manual de precio.
                      </p>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio (MXN)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {segmentPrices.map((segment, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment.origin}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment.destination}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-full"
                                    placeholder="Precio"
                                    value={segment.price}
                                    onChange={(e) => updateSegmentPrice(index, parseInt(e.target.value, 10) || 0)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="stop-times">
                      <div className="mb-4">
                        <p className="text-sm text-gray-500">
                          Configure el horario de cada parada haciendo clic en cada botón de tiempo. El tiempo en cada parada representa tanto la hora de llegada como la hora de salida para esa ubicación.
                        </p>
                      </div>
                      
                      <div className="overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parada</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {/* Origen */}
                            <tr className="bg-primary/5">
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white">1</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">Terminal Principal</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {routeSegmentsQuery.data?.origin || 'Origen'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <button 
                                    type="button"
                                    onClick={() => handleEditTime(0)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  >
                                    <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {form.getValues('departureHour')}:{form.getValues('departureMinute')} {form.getValues('departureAmPm')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Paradas intermedias */}
                            {routeSegmentsQuery.data?.stops.map((stop, index) => (
                              <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/80 text-white">{index + 2}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Parada {index + 1}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {stop}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTime(index + 1)}
                                      className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    >
                                      <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                                      {(stopTimes[index + 1] && typeof stopTimes[index + 1] === 'object') ? 
                                        `${stopTimes[index + 1]?.hour || ""}:${stopTimes[index + 1]?.minute || ""} ${stopTimes[index + 1]?.ampm || ""}` : 
                                        "--:--"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            
                            {/* Destino */}
                            <tr className="bg-primary/5">
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white">{(routeSegmentsQuery.data?.stops.length || 0) + 2}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">Destino Final</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {routeSegmentsQuery.data?.destination || 'Destino'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => handleEditTime((routeSegmentsQuery.data?.stops.length || 0) + 1)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  >
                                    <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {form.getValues('arrivalHour')}:{form.getValues('arrivalMinute')} {form.getValues('arrivalAmPm')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="mt-4 text-sm text-gray-500">
                        <p className="flex items-center">
                          <InfoIcon className="h-4 w-4 mr-2 text-primary" />
                          El horario de cada parada representa tanto la hora de llegada como la de salida para esa ubicación. Para los sub-viajes, se usarán estos tiempos para calcular la duración.
                        </p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="capacity-settings">
                      <p className="text-sm text-gray-500 mb-4">
                        Configura la capacidad para este viaje. Este valor representa el número total de asientos disponibles.
                      </p>
                      
                      <div className="p-4 border rounded-md">
                        <h4 className="text-md font-medium text-gray-800 mb-3">Configuración de Capacidad</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <FormField
                              control={form.control}
                              name="capacity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Capacidad total</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Número total de asientos"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || "")}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <FormField
                              control={form.control}
                              name="vehicleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tipo de vehículo</FormLabel>
                                  <Select 
                                    value={field.value} 
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo de vehículo" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="standard">Estándar (16-24 asientos)</SelectItem>
                                      <SelectItem value="premium">Premium (24-36 asientos)</SelectItem>
                                      <SelectItem value="luxury">Lujo (10-16 asientos)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              {/* Submit Button */}
              <div className="mt-8">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4">
                  <div className="flex">
                    <InfoIcon className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-slate-700 text-sm mb-1">Generación de Sub-Viajes</p>
                      <p className="text-xs text-slate-600">
                        Al publicar este viaje, el sistema creará automáticamente todos los sub-viajes posibles
                        entre paradas con precios y tiempos proporcionales basados en el recorrido total.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-primary hover:bg-primary-dark text-white px-6 py-2 text-lg font-medium"
                    size="lg"
                    disabled={publishTripMutation.isPending || !selectedRouteId}
                  >
                    {publishTripMutation.isPending ? (
                      <span className="flex items-center">
                        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
                        Publicando...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <CalendarPlusIcon className="mr-2 h-5 w-5" />
                        Publicar Viaje
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Diálogo para editar tiempo */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configurar horario</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium">{currentStopInfo.name}</h3>
              <p className="text-sm text-gray-500">{currentStopInfo.location}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="time-hour">Hora</Label>
                <div className="grid grid-cols-5 gap-2 items-center mt-2">
                  <div className="col-span-1">
                    <Select 
                      defaultValue={stopTimes[editingStopIndex || 0]?.hour || "08"}
                      onValueChange={(value) => {
                        if (editingStopIndex === null) return;
                        const newStopTimes = [...stopTimes];
                        if (!newStopTimes[editingStopIndex]) {
                          newStopTimes[editingStopIndex] = {
                            hour: value,
                            minute: "00",
                            ampm: "AM"
                          };
                        } else {
                          newStopTimes[editingStopIndex].hour = value;
                        }
                        setStopTimes(newStopTimes);
                      }}
                    >
                      <SelectTrigger id="time-hour">
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(hour => (
                          <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="text-center">:</div>
                  
                  <div className="col-span-1">
                    <Select 
                      defaultValue={stopTimes[editingStopIndex || 0]?.minute || "00"}
                      onValueChange={(value) => {
                        if (editingStopIndex === null) return;
                        const newStopTimes = [...stopTimes];
                        if (!newStopTimes[editingStopIndex]) {
                          newStopTimes[editingStopIndex] = {
                            hour: "08",
                            minute: value,
                            ampm: "AM"
                          };
                        } else {
                          newStopTimes[editingStopIndex].minute = value;
                        }
                        setStopTimes(newStopTimes);
                      }}
                    >
                      <SelectTrigger id="time-minute">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(minute => (
                          <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-2">
                    <Select 
                      defaultValue={stopTimes[editingStopIndex || 0]?.ampm || "AM"}
                      onValueChange={(value: "AM" | "PM") => {
                        if (editingStopIndex === null) return;
                        const newStopTimes = [...stopTimes];
                        if (!newStopTimes[editingStopIndex]) {
                          newStopTimes[editingStopIndex] = {
                            hour: "08",
                            minute: "00",
                            ampm: value
                          };
                        } else {
                          newStopTimes[editingStopIndex].ampm = value;
                        }
                        setStopTimes(newStopTimes);
                      }}
                    >
                      <SelectTrigger id="time-ampm">
                        <SelectValue placeholder="AM/PM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 pt-2">
                <p className="flex items-center">
                  <InfoIcon className="h-4 w-4 mr-2 text-primary" />
                  Esta hora representa tanto el tiempo de llegada como de salida para esta ubicación.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (editingStopIndex !== null && stopTimes[editingStopIndex]) {
                const { hour, minute, ampm } = stopTimes[editingStopIndex]!;
                saveStopTime(hour, minute, ampm);
              }
            }}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
