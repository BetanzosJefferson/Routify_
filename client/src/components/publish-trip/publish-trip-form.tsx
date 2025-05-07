import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { HelpCircleIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
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
import { generateSegmentsFromRoute, isSameCity, getCityName, groupSegmentsByCity } from "@/lib/utils";
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
  segmentPrices: SegmentTimePrice[];
  stopTimes?: StopTime[];
  // Nuevos campos para vehículo y conductor
  vehicleId?: number | null;
  driverId?: number | null;
};

export function PublishTripForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  
  // Estado para controlar si mostrar campos de vehículo/conductor solo en modo edición
  const [showAssignmentFields, setShowAssignmentFields] = useState(false);
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
    enabled: showAssignmentFields, // Solo se ejecuta cuando showAssignmentFields es true
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
    enabled: showAssignmentFields, // Solo se ejecuta cuando showAssignmentFields es true
  });

  // Form validation and handling
  const form = useForm<FormValues>({
    resolver: zodResolver(publishTripValidationSchema),
    defaultValues: {
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      capacity: 18,
      // Eliminado el precio base, ahora se calcula automáticamente de los segmentos
      segmentPrices: [],
      stopTimes: [], // Añadimos stopTimes para que no sea undefined
      vehicleId: null, // Valores iniciales para vehículo
      driverId: null, // y conductor
    },
    // Este modo nos ayuda a que el formulario muestre los valores actualizados
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
      
      // Asegurar que los valores son del tipo correcto antes de establecer el estado
      setStopTimes(ensureValidStopTimes(initialTimes));
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
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
      });
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Hide form if not editing
      if (!editingTripId) {
        setShowForm(false);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error al publicar viaje",
        description: error.message || "Ocurrió un error al publicar el viaje."
      });
    }
  });

  // Mutation for updating existing trips
  const updateTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!editingTripId) throw new Error("No hay ID de viaje para actualizar");
      
      const response = await fetch(`/api/trips/${editingTripId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al actualizar viaje");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Viaje actualizado exitosamente",
        description: "Los cambios en el viaje han sido guardados.",
      });
      
      // Reset form and state
      form.reset();
      setEditingTripId(null);
      setShowForm(false);
      setShowAssignmentFields(false);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
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
    console.log("Datos de formulario enviados:", data);
    // Incluir los tiempos de parada en los datos del formulario
    data.stopTimes = stopTimes;
    
    // Llamar a la mutación para publicar o actualizar el viaje
    if (editingTripId) {
      updateTripMutation.mutate(data);
    } else {
      publishTripMutation.mutate(data);
    }
  };

  // Load trip data for editing
  const loadTripForEditing = async (tripId: number) => {
    try {
      console.log("Iniciando carga de viaje para edición, ID:", tripId);
      setEditingTripId(tripId);
      const response = await fetch(`/api/trips/${tripId}`);
      
      if (!response.ok) {
        throw new Error("Error al cargar datos del viaje");
      }
      
      const tripData = await response.json();
      console.log("Datos de viaje cargados para edición:", tripData);
      console.log("segmentPrices recibidos:", JSON.stringify(tripData.segmentPrices, null, 2));
      
      // Activar modo edición y habilitar campos de asignación
      setShowForm(true);
      setShowAssignmentFields(true);
      
      // Extraer datos relevantes y establecer en el formulario
      console.log("Estableciendo routeId:", tripData.routeId);
      
      // Importante: handleRouteChange también actualiza el estado selectedRouteId
      // que es necesario para mostrar los campos de segmentos y horarios
      handleRouteChange(String(tripData.routeId));
      
      // Formateamos la fecha del viaje a formato YYYY-MM-DD para los campos date
      let formattedDate = tripData.departureDate;
      if (formattedDate && formattedDate.includes('T')) {
        formattedDate = formattedDate.split('T')[0];
      }
      console.log("Fecha formateada:", formattedDate);
      
      // Setear los valores en el formulario
      form.setValue("routeId", tripData.routeId);
      form.setValue("startDate", formattedDate);
      form.setValue("endDate", formattedDate);
      form.setValue("capacity", tripData.capacity);
      form.setValue("price", tripData.price);
      console.log("Valores básicos establecidos en el formulario");
      
      // Establecer vehículo y conductor si existen
      if (tripData.vehicleId) {
        console.log("Estableciendo vehículo:", tripData.vehicleId);
        form.setValue("vehicleId", tripData.vehicleId);
      }
      
      if (tripData.driverId) {
        console.log("Estableciendo conductor:", tripData.driverId);
        form.setValue("driverId", tripData.driverId);
      }
      
      // Esperar a que se carguen los datos del segmento desde la consulta de ruta
      // Esta espera es necesaria porque los segmentos se cargan después de cambiar la ruta
      const waitForSegmentsLoaded = async () => {
        console.log("Esperando a que los segmentos se carguen...");
        console.log("Estado actual de routeSegmentsQuery:", 
          routeSegmentsQuery.isLoading ? "cargando" : 
          routeSegmentsQuery.isError ? "error" : 
          routeSegmentsQuery.data ? "datos disponibles" : "sin datos");
        
        // Si ya tenemos los segmentos cargados, procedemos a configurar los precios
        if (routeSegmentsQuery.data) {
          console.log("Datos de segmentos disponibles, configurando precios y horarios");
          
          // Cargar los precios por segmento si existen
          if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices)) {
            console.log("Estableciendo precios por segmento en el estado:", tripData.segmentPrices.length, "segmentos");
            // Importante: actualizar el estado local
            setSegmentPrices(tripData.segmentPrices);
            // Y también actualizar el formulario
            form.setValue("segmentPrices", tripData.segmentPrices);
          } else {
            console.log("No hay precios por segmento disponibles en los datos del viaje");
          }
          
          // Cargar los horarios de parada si existen
          const allLocations = [
            routeSegmentsQuery.data.origin,
            ...(routeSegmentsQuery.data.stops || []),
            routeSegmentsQuery.data.destination
          ];
          console.log("Ubicaciones de la ruta:", allLocations);
          
          // Inicializar tiempos de parada usando tiempos reales del viaje
          if (allLocations.length > 0) {
            console.log("Inicializando tiempos de parada");
            const stopTimesNew: StopTime[] = [];
            
            // Agregar origen con hora de salida
            const departureTimeParts = parseTimeString(tripData.departureTime);
            console.log("Tiempo de salida parseado:", departureTimeParts);
            stopTimesNew.push({
              hour: departureTimeParts.hour,
              minute: departureTimeParts.minute,
              ampm: departureTimeParts.ampm,
              location: allLocations[0]
            });
            
            // Si hay paradas intermedias, establecer tiempos intermedios
            if (allLocations.length > 2) {
              for (let i = 1; i < allLocations.length - 1; i++) {
                // Para simplificar, en las paradas intermedias usamos tiempos constantes
                // En una implementación más completa, intentaríamos encontrar los tiempos reales
                const stopTime: StopTime = {
                  hour: "10",
                  minute: "00",
                  ampm: "AM",
                  location: allLocations[i]
                };
                stopTimesNew.push(stopTime);
              }
            }
            
            // Agregar destino con hora de llegada
            const arrivalTimeParts = parseTimeString(tripData.arrivalTime);
            console.log("Tiempo de llegada parseado:", arrivalTimeParts);
            stopTimesNew.push({
              hour: arrivalTimeParts.hour,
              minute: arrivalTimeParts.minute,
              ampm: arrivalTimeParts.ampm,
              location: allLocations[allLocations.length - 1]
            });
            
            const validStopTimes = ensureValidStopTimes(stopTimesNew);
            console.log("Estableciendo tiempos de parada:", validStopTimes);
            setStopTimes(validStopTimes);
          }
          
          return true;
        }
        
        // Si los segmentos aún no están cargados, esperamos un poco y volvemos a intentarlo
        console.log("Segmentos aún no disponibles, esperando...");
        return new Promise<boolean>(resolve => {
          setTimeout(() => {
            waitForSegmentsLoaded().then(resolve);
          }, 300);
        });
      };
      
      // Iniciar la espera para que los segmentos se carguen
      console.log("Iniciando proceso de espera para segmentos");
      await waitForSegmentsLoaded();
      console.log("Finalizada la carga de datos para edición");
      
    } catch (error) {
      console.error("Error al cargar viaje para edición:", error);
      toast({
        variant: "destructive",
        title: "Error al cargar viaje",
        description: "No se pudo cargar la información del viaje para editar."
      });
    }
  };
  
  // Función auxiliar para parsear un string de tiempo en formato "hh:mm AM/PM"
  const parseTimeString = (timeString: string): { hour: string, minute: string, ampm: "AM" | "PM" } => {
    if (!timeString) {
      return { hour: "12", minute: "00", ampm: "PM" };
    }
    
    try {
      // Manejar formato "hh:mm AM/PM"
      if (timeString.includes(" ")) {
        const [time, period] = timeString.split(" ");
        const [hour, minute] = time.split(":");
        return {
          hour: hour.padStart(2, "0"),
          minute: minute.padStart(2, "0"),
          ampm: (period.toUpperCase() === "PM" ? "PM" : "AM") as "AM" | "PM"
        };
      }
      // Manejar formato 24 horas "hh:mm"
      else if (timeString.includes(":")) {
        const [hour, minute] = timeString.split(":");
        const hourInt = parseInt(hour, 10);
        const isPM = hourInt >= 12;
        return {
          hour: (isPM && hourInt > 12 ? hourInt - 12 : (hourInt === 0 ? 12 : hourInt)).toString().padStart(2, "0"),
          minute: minute.padStart(2, "0"),
          ampm: isPM ? "PM" : "AM"
        };
      }
    } catch (error) {
      console.error("Error al parsear tiempo:", timeString, error);
    }
    
    // Valor predeterminado si hay errores
    return { hour: "12", minute: "00", ampm: "PM" };
  };

  // Toggle form visibility
  const toggleForm = () => {
    if (showForm) {
      // Si estamos cerrando el formulario, resetear el estado
      form.reset();
      setEditingTripId(null);
      setShowAssignmentFields(false);
    }
    setShowForm(!showForm);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold">Viajes Publicados</h2>
          <p className="text-sm text-muted-foreground">
            Vea y administre los viajes disponibles para reservación.
          </p>
        </div>
        <Button onClick={toggleForm} className="self-start">
          {showForm ? "Cancelar" : editingTripId ? "Editar Viaje" : "Publicar Nuevo Viaje"}
        </Button>
      </div>

      {/* Form section */}
      {showForm && (
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingTripId ? "Editar Viaje" : "Publicar Nuevo Viaje"}
          </h3>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Sección básica del formulario */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Selector de ruta */}
                <FormField
                  control={form.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ruta</FormLabel>
                      <Select
                        disabled={routesQuery.isLoading || editingTripId !== null}
                        onValueChange={(value) => handleRouteChange(value)}
                        value={String(field.value) || ""}
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
                        Seleccione la ruta para este viaje.
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
                      <FormLabel>Fecha de Inicio</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Primera fecha del rango para los viajes.
                      </FormDescription>
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
                      <FormDescription>
                        Última fecha del rango para los viajes.
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
                    {showAssignmentFields && (
                      <TabsTrigger value="assignment" className="flex-grow text-xs sm:text-sm">
                        <span>Asignación</span>
                      </TabsTrigger>
                    )}
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
                                    
                                    console.log("Actualizando precio de segmento (móvil):", inputValue, "->", newPrice);
                                    updateSegmentPrice(index, newPrice);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              <div className="flex justify-between">
                                <div>
                                  <div className="text-xs text-gray-500">Salida</div>
                                  <div className="text-sm">{segment.departureTime || "Pendiente"}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Llegada</div>
                                  <div className="text-sm">{segment.arrivalTime || "Pendiente"}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Versión escritorio - precios por ciudad */}
                      <div className="overflow-x-auto hidden md:block">
                        <div className="mb-8">
                          <h3 className="text-sm font-semibold mb-2">Configuración por ciudades</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Configure el precio entre ciudades principales. Este precio se aplicará automáticamente
                            a todas las combinaciones de paradas entre las mismas ciudades.
                          </p>
                          
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad Origen</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad Destino</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paradas afectadas</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(() => {
                                const { cityGroups, cityPairs } = groupSegmentsByCity(segmentPrices);
                                
                                return cityPairs.map((cityPair: {origin: string, destination: string}, idx: number) => {
                                  const key = `${cityPair.origin}||${cityPair.destination}`;
                                  const groupSegments = cityGroups[key] || [];
                                  const firstSegment = groupSegments[0] || { price: 0 };
                                  
                                  return (
                                    <tr key={`city-${idx}`} className="hover:bg-gray-50 bg-gray-50">
                                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {cityPair.origin}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {cityPair.destination}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
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
                                            
                                            console.log("Actualizando precio de ciudad:", inputValue, "->", newPrice);
                                            
                                            // Usar la nueva función para actualizar todos los precios entre estas ciudades
                                            updateCityGroupPrices(cityPair.origin, cityPair.destination, newPrice);
                                          }}
                                          className="w-24"
                                        />
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {groupSegments.length} combinaciones
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Tabla de segmentos individuales */}
                        <div className="mt-8">
                          <h3 className="text-sm font-semibold mb-2">Detalles por parada específica</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Aquí puede ver los precios aplicados a cada combinación de paradas específicas.
                            Estos precios se actualizan automáticamente al cambiar los precios por ciudad.
                          </p>
                          
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario Salida</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario Llegada</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {segmentPrices.map((segment, index) => (
                                <tr key={`segment-${index}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{segment.origin}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{segment.destination}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
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
                                        
                                        console.log("Actualizando precio de segmento:", inputValue, "->", newPrice);
                                        updateSegmentPrice(index, newPrice);
                                      }}
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
                      </div>
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
                    
                    {/* Vista móvil */}
                    <div className="md:hidden space-y-4">
                      {routeSegmentsQuery.data && [
                        routeSegmentsQuery.data.origin,
                        ...(routeSegmentsQuery.data.stops || []),
                        routeSegmentsQuery.data.destination
                      ].map((location, index) => (
                        <div key={`stop-card-${index}`} className="border rounded-md p-3 bg-white shadow-sm">
                          <div className="font-medium text-sm mb-2">
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
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">Horario</div>
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
                    </div>
                    
                    {/* Vista escritorio */}
                    <div className="overflow-x-auto hidden md:block">
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
                  </TabsContent>
                  
                  {showAssignmentFields && (
                    <TabsContent value="assignment">
                      <div className="space-y-6">
                        <div className="flex items-center mb-4">
                          <p className="text-sm text-gray-500 mr-1">
                            Asigne un vehículo y un conductor a este viaje.
                          </p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircleIcon className="h-4 w-4 text-primary/70 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="w-80 p-4">
                                <p>La asignación de vehículo y conductor permite controlar quién realizará este viaje.</p>
                                <p className="mt-2">Puede cambiar estas asignaciones más tarde si es necesario.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              )}
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={publishTripMutation.isPending || updateTripMutation.isPending}
                >
                  {(publishTripMutation.isPending || updateTripMutation.isPending) && (
                    <span className="mr-2 animate-spin">⏳</span>
                  )}
                  {editingTripId ? "Actualizar Viaje" : "Publicar Viaje"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Trip list */}
      <TripList 
        onEditTrip={loadTripForEditing} 
        editMode={!!editingTripId}
      />
    </div>
  );
}