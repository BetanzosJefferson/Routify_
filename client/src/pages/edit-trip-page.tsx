import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoutes } from "@/hooks/use-routes";
import { useRouteSegments } from "@/hooks/use-route-segments";
import { useDrivers } from "@/hooks/use-drivers";
import { useVehicles } from "@/hooks/use-vehicles";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/layout";
import { Loader2, ArrowLeft } from "lucide-react";
import { useTripDetails } from "@/hooks/use-trips";
import { Separator } from "@/components/ui/separator";

// Tipos para precios y tiempos de segmentos
type StopTime = {
  location: string;
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
};

type SegmentTimePrice = {
  origin: string;
  destination: string;
  price: number;
  departureTime?: string;
  arrivalTime?: string;
};

// Esquema para validación del formulario
const tripSchema = z.object({
  routeId: z.number().int().positive(),
  capacity: z.number().int().min(1),
  departureDate: z.string(),
  vehicleId: z.number().int().positive().optional(),
  driverId: z.number().int().positive().optional(),
  segmentPrices: z.array(z.object({
    origin: z.string(),
    destination: z.string(),
    price: z.number().min(0),
    departureTime: z.string().optional(),
    arrivalTime: z.string().optional()
  })).optional()
});

export default function EditTripPage() {
  const [, navigate] = useLocation();
  const { tripId } = useParams();
  const parsedTripId = tripId ? parseInt(tripId, 10) : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locales
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  const [stopTimes, setStopTimes] = useState<StopTime[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Consultas
  const { data: trip, isLoading: isTripLoading, error: tripError } = useTripDetails(parsedTripId);
  const { data: routes } = useRoutes();
  const { data: segments, isLoading: isSegmentsLoading } = useRouteSegments(trip?.routeId);
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  
  // Inicializar formulario
  const form = useForm<z.infer<typeof tripSchema>>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      routeId: 0,
      capacity: 1,
      departureDate: new Date().toISOString().substring(0, 10),
      vehicleId: undefined,
      driverId: undefined,
      segmentPrices: []
    }
  });

  // Función para asegurar que todos los stopTimes tengan valores válidos
  const ensureValidStopTimes = (times: StopTime[]) => {
    return times.map(time => ({
      ...time,
      hour: time.hour || "08",
      minute: time.minute || "00",
      ampm: time.ampm || "AM"
    }));
  };

  // Cargar datos del viaje cuando estén disponibles
  useEffect(() => {
    if (trip && !isTripLoading) {
      console.log("Cargando datos de viaje para edición:", trip);
      
      // Configurar valores básicos en el formulario
      form.setValue("routeId", trip.routeId);
      form.setValue("capacity", trip.capacity);
      form.setValue("departureDate", new Date(trip.departureDate).toISOString().split('T')[0]);
      
      if (trip.vehicleId) {
        form.setValue("vehicleId", trip.vehicleId);
      }
      
      if (trip.driverId) {
        form.setValue("driverId", trip.driverId);
      }
      
      // Cargar precios de segmentos si existen
      if (trip.segmentPrices && Array.isArray(trip.segmentPrices)) {
        setSegmentPrices(trip.segmentPrices);
        form.setValue("segmentPrices", trip.segmentPrices);
      }
    }
  }, [trip, form]);

  // Reconstruir stopTimes cuando se carguen los segmentos
  useEffect(() => {
    if (segments && segmentPrices.length > 0) {
      reconstructStopTimesFromSegments(segmentPrices);
    }
  }, [segments, segmentPrices]);

  // Función para reconstruir los tiempos de parada a partir de los precios de segmentos
  const reconstructStopTimesFromSegments = (prices: SegmentTimePrice[]) => {
    if (!segments || prices.length === 0) return;
    
    // Obtener todas las ubicaciones de la ruta
    const allLocations = [
      segments.origin,
      ...(segments.stops || []),
      segments.destination
    ];
    
    // Crear mapa para almacenar tiempos por ubicación
    const locationTimes: Record<string, { hour: string; minute: string; ampm: "AM" | "PM" }> = {};
    
    // Extraer tiempos de los segmentos
    prices.forEach(segment => {
      if (segment.departureTime) {
        const [time, period] = segment.departureTime.split(' ');
        const [hour, minute] = time.split(':');
        const ampm = period as "AM" | "PM";
        
        locationTimes[segment.origin] = { hour, minute, ampm };
      }
      
      if (segment.arrivalTime) {
        const [time, period] = segment.arrivalTime.split(' ');
        const [hour, minute] = time.split(':');
        const ampm = period as "AM" | "PM";
        
        locationTimes[segment.destination] = { hour, minute, ampm };
      }
    });
    
    // Crear array de tiempos de parada
    const newStopTimes = allLocations.map(location => {
      if (locationTimes[location]) {
        return {
          ...locationTimes[location],
          location
        };
      } else {
        return {
          hour: "08",
          minute: "00",
          ampm: "AM" as "AM" | "PM",
          location
        };
      }
    });
    
    setStopTimes(ensureValidStopTimes(newStopTimes));
  };

  // Actualizar precio de segmento
  const handlePriceChange = (origin: string, destination: string, price: number) => {
    const updatedPrices = [...segmentPrices];
    const index = updatedPrices.findIndex(
      sp => sp.origin === origin && sp.destination === destination
    );
    
    if (index >= 0) {
      updatedPrices[index] = { ...updatedPrices[index], price };
    } else {
      updatedPrices.push({ origin, destination, price });
    }
    
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };

  // Obtener precio de segmento
  const getSegmentPrice = (origin: string, destination: string) => {
    const segment = segmentPrices.find(
      sp => sp.origin === origin && sp.destination === destination
    );
    return segment?.price || 0;
  };

  // Actualizar tiempo de parada
  const updateStopTime = (index: number, field: keyof StopTime, value: string) => {
    const newStopTimes = [...stopTimes];
    newStopTimes[index] = { ...newStopTimes[index], [field]: value };
    setStopTimes(newStopTimes);
    
    // Actualizar también los tiempos en los segmentPrices
    updateSegmentTimesFromStopTimes(newStopTimes);
  };

  // Actualizar tiempos de segmentos basados en tiempos de parada
  const updateSegmentTimesFromStopTimes = (times: StopTime[]) => {
    if (!segments || !times.length) return;
    
    const locationTimeMap = times.reduce((map, stopTime) => {
      map[stopTime.location] = `${stopTime.hour}:${stopTime.minute} ${stopTime.ampm}`;
      return map;
    }, {} as Record<string, string>);
    
    const updatedPrices = segmentPrices.map(segment => {
      const originTime = locationTimeMap[segment.origin];
      const destTime = locationTimeMap[segment.destination];
      
      return {
        ...segment,
        departureTime: originTime,
        arrivalTime: destTime
      };
    });
    
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };

  // Enviar formulario para actualizar viaje
  const onSubmit = async (data: z.infer<typeof tripSchema>) => {
    if (!parsedTripId) return;
    
    try {
      setIsSubmitting(true);
      
      // Asegurarse de que segmentPrices esté actualizado
      data.segmentPrices = segmentPrices;
      
      console.log("Enviando datos para actualizar viaje:", data);
      
      const response = await fetch(`/api/trips/${parsedTripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el viaje");
      }
      
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      toast({
        title: "Viaje actualizado",
        description: "El viaje ha sido actualizado correctamente."
      });
      
      // Navegar de vuelta a la página de viajes
      navigate("/publish-trip");
    } catch (error) {
      console.error("Error al actualizar viaje:", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "No se pudo actualizar el viaje. Intente nuevamente."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar volver a la lista de viajes
  const handleBack = () => {
    navigate("/publish-trip");
  };

  if (isTripLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
          <span className="ml-2">Cargando datos del viaje...</span>
        </div>
      </Layout>
    );
  }

  if (tripError || !trip) {
    return (
      <Layout>
        <div className="p-6">
          <Button variant="outline" onClick={handleBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error al cargar el viaje</CardTitle>
            </CardHeader>
            <CardContent>
              <p>No se pudo cargar la información del viaje. Verifique que el ID sea correcto e intente nuevamente.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Obtener nombre de la ruta para mostrar
  const routeName = routes?.find(r => r.id === trip.routeId)?.name || `Ruta ${trip.routeId}`;

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button variant="outline" onClick={handleBack} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar Viaje</h1>
            <p className="text-muted-foreground">{routeName}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Información básica */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="routeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruta</FormLabel>
                        <Select 
                          disabled={true} 
                          value={String(field.value)}
                          onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione una ruta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routes?.map(route => (
                              <SelectItem key={route.id} value={String(route.id)}>
                                {route.name} ({route.origin} → {route.destination})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>La ruta no puede ser modificada</FormDescription>
                      </FormItem>
                    )}
                  />

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
                        <FormDescription>Número máximo de pasajeros</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha del viaje</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>Fecha de salida</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Pestañas para segmentos, paradas y asignación */}
                {segments && (
                  <Tabs defaultValue="segments" className="w-full">
                    <TabsList className="mb-2 w-full flex flex-wrap justify-start">
                      <TabsTrigger value="segments" className="flex-grow text-xs sm:text-sm">
                        <span className="hidden xs:inline">Precios por </span>
                        <span>Segmento</span>
                      </TabsTrigger>
                      <TabsTrigger value="stop-times" className="flex-grow text-xs sm:text-sm">
                        <span className="hidden xs:inline">Tiempos de </span>
                        <span>Parada</span>
                      </TabsTrigger>
                      <TabsTrigger value="assignment" className="flex-grow text-xs sm:text-sm">
                        <span>Asignación</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Precios por segmento */}
                    <TabsContent value="segments">
                      <div className="space-y-4">
                        <div className="text-sm text-gray-500 mb-4">
                          Configure el precio de cada segmento del viaje.
                        </div>
                        
                        <div className="space-y-4">
                          <div className="font-medium">Configuración por ciudades principales</div>
                          <div className="text-sm text-gray-500">
                            Configure el precio entre ciudades principales. Esto ayuda a calcular automáticamente todos los precios de combinaciones de paradas entre las mismas ciudades.
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border rounded-md">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen / Destino</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paradas Afectadas</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {segments.citySegments?.map((segment, index) => (
                                  <tr key={index}>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="text-sm">{segment.origin}</div>
                                      <div className="text-xs text-gray-500">→ {segment.destination}</div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <Input
                                        type="number"
                                        min="0"
                                        className="w-20 text-right"
                                        value={getSegmentPrice(segment.origin, segment.destination)}
                                        onChange={(e) => 
                                          handlePriceChange(
                                            segment.origin, 
                                            segment.destination, 
                                            parseInt(e.target.value, 10) || 0
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                      <span className="text-sm">{segment.affectedSegments || 0} combinaciones</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <Separator className="my-6" />

                        <div className="space-y-4">
                          <div className="font-medium">Detalle por parada específica</div>
                          <div className="text-sm text-gray-500">
                            Aquí puede ajustar los precios y horarios específicos para cada combinación de paradas.
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border rounded-md">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horario Salida</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horario Llegada</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {segments.allSegments?.map((segment, index) => {
                                  const sp = segmentPrices.find(
                                    sp => sp.origin === segment.origin && sp.destination === segment.destination
                                  );
                                  
                                  return (
                                    <tr key={index}>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{segment.origin}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{segment.destination}</td>
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <Input
                                          type="number"
                                          min="0"
                                          className="w-20 text-right"
                                          value={sp?.price || 0}
                                          onChange={(e) => 
                                            handlePriceChange(
                                              segment.origin, 
                                              segment.destination, 
                                              parseInt(e.target.value, 10) || 0
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-center text-sm">
                                        {sp?.departureTime || "-"}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-center text-sm">
                                        {sp?.arrivalTime || "-"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tiempos de parada */}
                    <TabsContent value="stop-times">
                      <div className="space-y-4">
                        <div className="text-sm text-gray-500 mb-4">
                          Configure los horarios para cada parada de la ruta.
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border rounded-md">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parada</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Minuto</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">AM/PM</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {stopTimes.map((stopTime, index) => (
                                <tr key={index}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm">{stopTime.location}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <Select 
                                      value={stopTime.hour} 
                                      onValueChange={(value) => updateStopTime(index, "hour", value)}
                                    >
                                      <SelectTrigger className="w-20">
                                        <SelectValue placeholder="Hora" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((hour) => (
                                          <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <Select 
                                      value={stopTime.minute} 
                                      onValueChange={(value) => updateStopTime(index, "minute", value)}
                                    >
                                      <SelectTrigger className="w-20">
                                        <SelectValue placeholder="Min" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((minute) => (
                                          <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <Select 
                                      value={stopTime.ampm} 
                                      onValueChange={(value) => updateStopTime(index, "ampm", value as "AM" | "PM")}
                                    >
                                      <SelectTrigger className="w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="AM">AM</SelectItem>
                                        <SelectItem value="PM">PM</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Asignación de vehículo y conductor */}
                    <TabsContent value="assignment">
                      <div className="space-y-4">
                        <div className="text-sm text-gray-500 mb-4">
                          Asigne un vehículo y un conductor para este viaje.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="vehicleId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vehículo</FormLabel>
                                <Select 
                                  value={field.value ? String(field.value) : ""} 
                                  onValueChange={(value) => field.onChange(parseInt(value, 10))}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccione un vehículo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {vehicles?.map(vehicle => (
                                      <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                                        {vehicle.brand} {vehicle.model} ({vehicle.plates})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>Vehículo que realizará el viaje</FormDescription>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="driverId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Conductor</FormLabel>
                                <Select 
                                  value={field.value ? String(field.value) : ""} 
                                  onValueChange={(value) => field.onChange(parseInt(value, 10))}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccione un conductor" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {drivers?.map(driver => (
                                      <SelectItem key={driver.id} value={String(driver.id)}>
                                        {driver.firstName} {driver.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>Conductor asignado al viaje</FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}

                <div className="flex justify-end space-x-4 pt-4">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : "Guardar cambios"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}