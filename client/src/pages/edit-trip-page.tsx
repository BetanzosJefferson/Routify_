import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoutes } from "@/hooks/use-routes";
import { useRouteSegments } from "@/hooks/use-route-segments";
import { useDrivers } from "@/hooks/use-drivers";
import { useVehicles } from "@/hooks/use-vehicles";
import { ArrowLeftIcon, PlusIcon, MinusIcon, Loader2 } from "lucide-react";
import Layout from "@/components/layout/layout";

export default function EditTripPage() {
  const { tripId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para el formulario
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [departureDate, setDepartureDate] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>("");
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [capacity, setCapacity] = useState<string>("20");
  const [price, setPrice] = useState<string>("0");
  const [vehicleType, setVehicleType] = useState<string>("Autobús");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<Array<{
    origin: string;
    destination: string;
    price: string;
  }>>([]);
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(true);
  
  // Obtener hooks para datos
  const { routes } = useRoutes();
  const { getSegmentsForRoute } = useRouteSegments();
  const { drivers } = useDrivers();
  const { vehicles } = useVehicles();
  
  // Consulta para obtener los datos del viaje
  const { data: trip, isLoading: isTripLoading } = useQuery({
    queryKey: ['/api/trips', tripId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/trips/${tripId}`);
        if (!res.ok) {
          throw new Error('No se pudo obtener el viaje');
        }
        return await res.json();
      } catch (error) {
        console.error('Error al obtener viaje:', error);
        throw error;
      }
    },
    enabled: !!tripId
  });
  
  // Efecto para cargar los datos del viaje al formulario
  useEffect(() => {
    if (trip && !isTripLoading) {
      console.log("Datos del viaje cargados:", trip);
      
      // Configurar valores básicos
      setSelectedRouteId(trip.routeId?.toString() || null);
      setDepartureDate(trip.departureDate || "");
      setDepartureTime(trip.departureTime || "");
      setArrivalTime(trip.arrivalTime || "");
      setCapacity(trip.capacity?.toString() || "20");
      setPrice(trip.price?.toString() || "0");
      setVehicleType(trip.vehicleType || "Autobús");
      setVehicleId(trip.vehicleId?.toString() || null);
      setDriverId(trip.driverId?.toString() || null);
      
      // Cargar precios de segmentos si existen
      if (trip.segmentPrices && Array.isArray(trip.segmentPrices)) {
        setSegmentPrices(trip.segmentPrices.map((segment: any) => ({
          origin: segment.origin,
          destination: segment.destination,
          price: segment.price.toString()
        })));
      } else if (trip.routeId) {
        // Si no hay segmentPrices pero hay routeId, generamos los segmentos de precio
        // a partir de la ruta seleccionada
        generateSegmentPricesFromRoute(trip.routeId);
      }
      
      setIsLoading(false);
    }
  }, [trip, isTripLoading]);
  
  // Función para generar segmentos de precios a partir de una ruta
  const generateSegmentPricesFromRoute = (routeId: number) => {
    if (!routeId) return;
    
    const segments = getSegmentsForRoute(routeId);
    if (!segments || segments.length === 0) return;
    
    const newSegmentPrices = segments.map(segment => ({
      origin: segment.origin,
      destination: segment.destination,
      price: "0" // Precio por defecto
    }));
    
    setSegmentPrices(newSegmentPrices);
  };
  
  // Efecto para generar segmentos de precios cuando se selecciona una ruta
  useEffect(() => {
    if (selectedRouteId) {
      generateSegmentPricesFromRoute(parseInt(selectedRouteId));
    }
  }, [selectedRouteId]);
  
  // Función para actualizar un precio de segmento
  const updateSegmentPrice = (index: number, price: string) => {
    const updatedPrices = [...segmentPrices];
    updatedPrices[index] = {
      ...updatedPrices[index],
      price
    };
    setSegmentPrices(updatedPrices);
  };
  
  // Mutación para actualizar el viaje
  const updateTripMutation = useMutation({
    mutationFn: async (tripData: any) => {
      const res = await apiRequest('PUT', `/api/trips/${tripId}`, tripData);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al actualizar el viaje");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', tripId] });
      toast({
        title: "Viaje actualizado",
        description: "El viaje ha sido actualizado correctamente",
        variant: "default",
      });
      navigate('/');
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar el viaje",
        description: error.message || "Hubo un problema al actualizar el viaje",
        variant: "destructive",
      });
    }
  });
  
  // Función para manejar el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRouteId) {
      toast({
        title: "Ruta requerida",
        description: "Debe seleccionar una ruta para el viaje",
        variant: "destructive",
      });
      return;
    }
    
    if (!departureDate || !departureTime || !arrivalTime) {
      toast({
        title: "Datos incompletos",
        description: "Todos los campos de fecha y hora son obligatorios",
        variant: "destructive",
      });
      return;
    }
    
    // Preparar datos para la actualización
    const tripData = {
      routeId: parseInt(selectedRouteId),
      departureDate,
      departureTime,
      arrivalTime,
      capacity: parseInt(capacity),
      price: parseFloat(price),
      vehicleType,
      segmentPrices: segmentPrices.map(segment => ({
        ...segment,
        price: parseFloat(segment.price)
      })),
      vehicleId: vehicleId ? parseInt(vehicleId) : null,
      driverId: driverId ? parseInt(driverId) : null
    };
    
    console.log("Datos a actualizar:", tripData);
    
    // Enviar actualización
    updateTripMutation.mutate(tripData);
  };
  
  const getSelectedRoute = () => {
    if (!selectedRouteId || !routes) return null;
    return routes.find((r) => r.id.toString() === selectedRouteId);
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mr-2"
            onClick={() => navigate('/')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver al Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Editar Viaje</h1>
        </div>
        
        {isTripLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Cargando datos del viaje...</span>
          </div>
        ) : (
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Información del Viaje</CardTitle>
              <CardDescription>
                Edite los detalles del viaje seleccionado
              </CardDescription>
            </CardHeader>
            
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="px-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">Información General</TabsTrigger>
                  <TabsTrigger value="prices">Precios</TabsTrigger>
                  <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
                </TabsList>
              </div>
              
              <CardContent className="p-6">
                <form onSubmit={handleSubmit}>
                  <TabsContent value="general" className="space-y-4 mt-0">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="route">Ruta</Label>
                        <Select 
                          value={selectedRouteId || ""}
                          onValueChange={setSelectedRouteId}
                        >
                          <SelectTrigger id="route">
                            <SelectValue placeholder="Seleccionar ruta" />
                          </SelectTrigger>
                          <SelectContent>
                            {routes?.map((route) => (
                              <SelectItem key={route.id} value={route.id.toString()}>
                                {route.name} ({route.origin} → {route.destination})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {selectedRouteId && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="departureDate">Fecha de Salida</Label>
                            <Input
                              id="departureDate"
                              type="date"
                              value={departureDate}
                              onChange={(e) => setDepartureDate(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="departureTime">Hora de Salida</Label>
                            <Input
                              id="departureTime"
                              type="time"
                              value={departureTime}
                              onChange={(e) => setDepartureTime(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="arrivalTime">Hora de Llegada</Label>
                            <Input
                              id="arrivalTime"
                              type="time"
                              value={arrivalTime}
                              onChange={(e) => setArrivalTime(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="capacity">Capacidad</Label>
                          <Input
                            id="capacity"
                            type="number"
                            min="1"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="price">Precio Base</Label>
                          <Input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="vehicleType">Tipo de Vehículo</Label>
                          <Select 
                            value={vehicleType}
                            onValueChange={setVehicleType}
                          >
                            <SelectTrigger id="vehicleType">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Autobús">Autobús</SelectItem>
                              <SelectItem value="Minivan">Minivan</SelectItem>
                              <SelectItem value="Suburban">Suburban</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="prices" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium">Precios por Segmento</h3>
                      </div>
                      
                      {selectedRouteId ? (
                        segmentPrices.length > 0 ? (
                          <div className="space-y-3">
                            {segmentPrices.map((segment, index) => (
                              <div key={index} className="flex items-center space-x-2 p-3 border rounded-md bg-muted/40">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Origen</Label>
                                    <div className="font-medium">{segment.origin}</div>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Destino</Label>
                                    <div className="font-medium">{segment.destination}</div>
                                  </div>
                                  <div>
                                    <Label htmlFor={`segment-price-${index}`} className="text-xs">Precio</Label>
                                    <Input
                                      id={`segment-price-${index}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={segment.price}
                                      onChange={(e) => updateSegmentPrice(index, e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center p-4 border rounded-md bg-muted/40">
                            <p>No hay segmentos disponibles para esta ruta.</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Seleccione una ruta diferente o edite la ruta actual para agregar paradas.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="text-center p-4 border rounded-md bg-muted/40">
                          <p>Primero seleccione una ruta en la pestaña de Información General.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="assignments" className="mt-0">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Asignación de Vehículo</h3>
                        <Select 
                          value={vehicleId || ""}
                          onValueChange={setVehicleId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar vehículo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin asignar</SelectItem>
                            {vehicles?.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                {vehicle.brand} {vehicle.model} - {vehicle.plates}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Asignación de Conductor</h3>
                        <Select 
                          value={driverId || ""}
                          onValueChange={setDriverId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar conductor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin asignar</SelectItem>
                            {drivers?.map((driver) => (
                              <SelectItem key={driver.id} value={driver.id.toString()}>
                                {driver.firstName} {driver.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                </form>
              </CardContent>
              
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={updateTripMutation.isPending || !selectedRouteId}
                >
                  {updateTripMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Tabs>
          </Card>
        )}
      </div>
    </Layout>
  );
}