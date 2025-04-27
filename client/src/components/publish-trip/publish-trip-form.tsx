import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
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
      price: 450,
      vehicleType: "standard",
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
    
    // Obtener el primer y último tiempo para usar como tiempo de salida/llegada del viaje
    const departureTime = formattedStopTimes.length > 0 ? 
      `${formattedStopTimes[0].hour}:${formattedStopTimes[0].minute} ${formattedStopTimes[0].ampm}` : "";
    const arrivalTime = formattedStopTimes.length > 0 ? 
      `${formattedStopTimes[formattedStopTimes.length - 1].hour}:${formattedStopTimes[formattedStopTimes.length - 1].minute} ${formattedStopTimes[formattedStopTimes.length - 1].ampm}` : "";
    
    // Preparar datos comunes para crear o actualizar
    const tripData = {
      ...data,
      routeId: selectedRouteId,
      capacity,
      price: data.price || 0,
      segmentPrices,
      stopTimes: formattedStopTimes,
      departureTime, // Añadido explícitamente
      arrivalTime,   // Añadido explícitamente
      availableSeats: capacity, // Inicializa availableSeats con la capacidad
      // Incluir explícitamente los campos de asignación
      vehicleId: data.vehicleId || null,
      driverId: data.driverId || null
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
      vehicleId: null,
      driverId: null,
    });
    setSelectedRouteId(null);
    setSegmentPrices([]);
    setStopTimes([]);
    setEditingTripId(null);
    setShowAssignmentFields(false); // Ocultar la pestaña de asignación para nuevo viaje
    setShowForm(true);
  };
  
  // Handle editing an existing trip
  const handleEditTrip = (tripId: number) => {
    // Primero, cargar la ruta y sus segmentos para tener la información completa
    fetch(`/api/trips/${tripId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Error al obtener el viaje: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(async trip => {
        console.log("Trip to edit:", trip);
        
        if (!trip || !trip.id) {
          toast({
            title: "Error",
            description: "No se pudo cargar la información del viaje.",
            variant: "destructive",
          });
          return;
        }
        
        // Establecemos el ID de la ruta primero para cargar sus segmentos
        setSelectedRouteId(trip.routeId);
        
        try {
          // Cargar la información de la ruta para obtener más detalles
          const routeResponse = await fetch(`/api/routes/${trip.routeId}/segments`);
          if (!routeResponse.ok) {
            throw new Error("No se pudo cargar la información de la ruta");
          }
          
          const routeData = await routeResponse.json();
          console.log("Route data for selected trip:", routeData);
          
          // Ahora podemos procesar correctamente los tiempos de parada y precios de segmento
          
          // PASO 1: Configurar los tiempos de parada
          const allLocations = [
            routeData.origin,
            ...(routeData.stops || []),
            routeData.destination
          ];
          
          // Crear un mapa de los tiempos de parada existentes si el viaje tiene stopTimes configurados
          const existingStopTimes: Record<string, { hour: string, minute: string, ampm: "AM" | "PM" }> = {};
          
          // Si el viaje tiene stopTimes configurados, usarlos
          if (trip.stopTimes && Array.isArray(trip.stopTimes) && trip.stopTimes.length > 0) {
            console.log("El viaje tiene stopTimes configurados:", trip.stopTimes);
            trip.stopTimes.forEach((stopTime: any) => {
              if (stopTime && stopTime.location) {
                // Asegurarse de que ampm sea "AM" o "PM"
                let ampmValue = (stopTime.ampm || "AM").toUpperCase();
                if (ampmValue !== "AM" && ampmValue !== "PM") {
                  ampmValue = "AM";
                }
                
                existingStopTimes[stopTime.location] = {
                  hour: stopTime.hour || "00",
                  minute: stopTime.minute || "00",
                  ampm: ampmValue as "AM" | "PM"
                };
              }
            });
          }
          
          // Calcular tiempos de parada basados en departureTime y arrivalTime como respaldo
          const departureParts = trip.departureTime.split(' ')[0].split(':');
          const departureHour = departureParts[0];
          const departureMinute = departureParts[1];
          const departureAmPm = trip.departureTime.split(' ')[1];
          
          const arrivalParts = trip.arrivalTime.split(' ')[0].split(':');
          const arrivalHour = arrivalParts[0];
          const arrivalMinute = arrivalParts[1];
          const arrivalAmPm = trip.arrivalTime.split(' ')[1];
          
          // Crear tiempos de parada para el formulario
          const allStopTimes = allLocations.map((location, index) => {
            // Primero verificar si hay un tiempo personalizado para esta ubicación
            if (existingStopTimes[location]) {
              return {
                hour: existingStopTimes[location].hour,
                minute: existingStopTimes[location].minute,
                ampm: existingStopTimes[location].ampm,
                location
              };
            } 
            
            // Si no hay un tiempo personalizado, calcular basado en posición
            if (index === 0) {
              // Primera parada (origen) - hora de salida
              return {
                hour: departureHour,
                minute: departureMinute,
                ampm: departureAmPm as "AM" | "PM",
                location
              };
            } else if (index === allLocations.length - 1) {
              // Última parada (destino) - hora de llegada
              return {
                hour: arrivalHour,
                minute: arrivalMinute,
                ampm: arrivalAmPm as "AM" | "PM",
                location
              };
            } else {
              // Paradas intermedias - intentamos recuperar los tiempos reales de los tiempos de segmento
              // Buscamos en los segmentPrices para ubicaciones que podrían tener tiempos calculados
              if (trip.segmentPrices && Array.isArray(trip.segmentPrices)) {
                // Buscar un segmento donde esta ubicación sea el origen o destino
                const segmentAsOrigin = trip.segmentPrices.find(
                  (seg: any) => seg.origin === location && seg.departureTime
                );
                
                if (segmentAsOrigin && segmentAsOrigin.departureTime) {
                  try {
                    const timeParts = segmentAsOrigin.departureTime.split(' ');
                    if (timeParts.length === 2) {
                      const hourMinute = timeParts[0].split(':');
                      const ampm = timeParts[1].toUpperCase();
                      if (hourMinute.length === 2 && (ampm === "AM" || ampm === "PM")) {
                        return {
                          hour: hourMinute[0],
                          minute: hourMinute[1],
                          ampm: ampm as "AM" | "PM",
                          location
                        };
                      }
                    }
                  } catch (error) {
                    console.warn("Error parsing departureTime:", error);
                  }
                }
                
                const segmentAsDestination = trip.segmentPrices.find(
                  (seg: any) => seg.destination === location && seg.arrivalTime
                );
                
                if (segmentAsDestination && segmentAsDestination.arrivalTime) {
                  try {
                    const timeParts = segmentAsDestination.arrivalTime.split(' ');
                    if (timeParts.length === 2) {
                      const hourMinute = timeParts[0].split(':');
                      const ampm = timeParts[1].toUpperCase();
                      if (hourMinute.length === 2 && (ampm === "AM" || ampm === "PM")) {
                        return {
                          hour: hourMinute[0],
                          minute: hourMinute[1],
                          ampm: ampm as "AM" | "PM",
                          location
                        };
                      }
                    }
                  } catch (error) {
                    console.warn("Error parsing arrivalTime:", error);
                  }
                }
              }
              
              // Si no se encontró información específica, calculamos un tiempo proporcional 
              // entre la salida y la llegada
              const totalStops = allLocations.length - 1;
              const position = index / totalStops; // Posición relativa (0 a 1)
              
              // Convertir tiempos a minutos desde medianoche para cálculos
              const getMinutesSinceMidnight = (hour: string, minute: string, ampm: string) => {
                let hours = parseInt(hour);
                if (ampm === "PM" && hours < 12) hours += 12;
                if (ampm === "AM" && hours === 12) hours = 0;
                return hours * 60 + parseInt(minute);
              };
              
              const departureMinutes = getMinutesSinceMidnight(departureHour, departureMinute, departureAmPm);
              const arrivalMinutes = getMinutesSinceMidnight(arrivalHour, arrivalMinute, arrivalAmPm);
              
              // Calcular minutos intermedios basados en la posición
              const interpolatedMinutes = Math.round(departureMinutes + position * (arrivalMinutes - departureMinutes));
              
              // Convertir minutos de vuelta a horas y minutos
              const calculatedHours = Math.floor(interpolatedMinutes / 60);
              const calculatedMinutes = interpolatedMinutes % 60;
              
              // Formato 12 horas
              const isAM = calculatedHours < 12;
              let hours12 = calculatedHours % 12;
              if (hours12 === 0) hours12 = 12;
              
              return {
                hour: hours12.toString().padStart(2, '0'),
                minute: calculatedMinutes.toString().padStart(2, '0'),
                ampm: isAM ? "AM" : "PM",
                location
              };
            }
          });
          
          // PASO 2: Configurar los precios por segmento
          let segmentPricesFromTrip: any[] = [];
          if (trip.segmentPrices && Array.isArray(trip.segmentPrices)) {
            console.log("El viaje tiene segmentPrices configurados:", trip.segmentPrices);
            // Usar directamente los segmentPrices del viaje y asegurarse de que los precios son números
            segmentPricesFromTrip = trip.segmentPrices.map((sp: any) => ({
              origin: sp.origin,
              destination: sp.destination,
              price: typeof sp.price === 'number' ? sp.price : 0, // Garantizar que price sea un número
              departureTime: sp.departureTime,
              arrivalTime: sp.arrivalTime
            }));
          } else {
            // Si no hay precios de segmento, crear una estructura vacía
            // basada en los segmentos de la ruta
            segmentPricesFromTrip = routeData.segments.map((segment: any) => ({
              origin: segment.origin,
              destination: segment.destination,
              price: 0 // Precio predeterminado
            }));
          }
          
          // Establecer los estados con los datos procesados
          setEditingTripId(tripId);
          setSegmentPrices(segmentPricesFromTrip);
          setStopTimes(ensureValidStopTimes(allStopTimes));
          
          // Habilitar los campos de asignación para edición
          setShowAssignmentFields(true);
          
          // Actualizar el formulario con todos los datos disponibles
          const startDate = trip.departureDate?.split("T")[0] || format(new Date(), "yyyy-MM-dd");
          const endDate = startDate; // Mismo día para edición
          
          // Primero hacemos un reset completo del formulario con los datos
          form.reset({
            routeId: trip.routeId,
            startDate: startDate,
            endDate: endDate,
            capacity: trip.capacity,
            price: trip.price || 0,
            vehicleType: trip.vehicleType || "standard",
            segmentPrices: segmentPricesFromTrip,
            stopTimes: ensureValidStopTimes(allStopTimes),
            // Incluir IDs de vehículo y conductor si existen
            vehicleId: trip.vehicleId || null,
            driverId: trip.driverId || null,
          }, { 
            // Esta opción es clave para que los campos controlados se actualicen
            keepDirtyValues: false, 
            keepErrors: false,
            keepDirty: false,
            keepIsSubmitted: false,
            keepTouched: false,
            keepIsValid: false,
            keepSubmitCount: false,
          });
          
          // También actualizamos los valores directamente para asegurarnos que llegan a la UI
          // Después del reset que reinicia el estado interno del formulario
          setTimeout(() => {
            console.log("Aplicando valores al formulario:", {
              routeId: trip.routeId,
              startDate,
              endDate, 
              capacity: trip.capacity,
              price: trip.price,
              vehicleType: trip.vehicleType,
              segmentPrices: segmentPricesFromTrip,
              stopTimes: allStopTimes,
              vehicleId: trip.vehicleId,
              driverId: trip.driverId
            });
            
            // Forzar actualización de valores individuales
            form.setValue("routeId", trip.routeId, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("startDate", startDate, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("endDate", endDate, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("capacity", trip.capacity, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("price", trip.price || 0, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("vehicleType", trip.vehicleType || "standard", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("segmentPrices", segmentPricesFromTrip, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            form.setValue("stopTimes", ensureValidStopTimes(allStopTimes), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            
            // Actualizar valores de vehículo y conductor si existen
            if (trip.vehicleId) {
              console.log(`Asignando vehículo ID: ${trip.vehicleId}`);
              form.setValue("vehicleId", trip.vehicleId, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            }
            
            if (trip.driverId) {
              console.log(`Asignando conductor ID: ${trip.driverId}`);
              form.setValue("driverId", trip.driverId, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
            }
            
            // Forzar revalidación completa
            form.trigger();
          }, 100);
          
          // Mostrar el formulario
          setShowForm(true);
          
          // Notificar al usuario que se ha cargado el viaje correctamente
          toast({
            title: "Viaje cargado",
            description: "La información del viaje se ha cargado correctamente.",
          });
          
        } catch (routeError) {
          console.error("Error loading route data:", routeError);
          toast({
            title: "Error",
            description: "No se pudo cargar la información completa de la ruta. " + (routeError as Error).message,
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error loading trip details", error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información del viaje. " + error.message,
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Primera columna */}
                  <div className="space-y-6">
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
                  </div>
                  
                  {/* Segunda columna */}
                  <div className="space-y-6">
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
                  </div>
                  
                  {/* Tercera columna */}
                  <div className="space-y-6">
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
                    
                    {/* Precio por pasajero */}
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
                </div>
                
                {selectedRouteId && routeSegmentsQuery.data && (
                  <Tabs defaultValue="stop-times">
                    <TabsList className="mb-2">
                      <TabsTrigger value="segments">Precios por Segmento</TabsTrigger>
                      <TabsTrigger value="stop-times">Tiempos de Parada</TabsTrigger>
                      {/* Mostrar la pestaña de asignación solo en modo edición */}
                      {showAssignmentFields && (
                        <TabsTrigger value="assignment">Asignación</TabsTrigger>
                      )}
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
                                    key={`time-input-${index}-${stopTimes[index]?.hour || '08'}-${stopTimes[index]?.minute || '00'}-${stopTimes[index]?.ampm || 'AM'}`}
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
                    
                    {/* Pestaña de asignación de vehículo y conductor */}
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
                                  <p className="mt-2">El conductor podrá ver este viaje en su panel y gestionar el abordaje de pasajeros.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Selección de vehículo */}
                            <FormField
                              control={form.control}
                              name="vehicleId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Vehículo</FormLabel>
                                  <Select 
                                    onValueChange={(value) => value === "none" ? field.onChange(null) : field.onChange(parseInt(value) || null)}
                                    value={field.value?.toString() || "none"}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar vehículo" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Sin asignar</SelectItem>
                                      {vehiclesQuery.data?.map((vehicle: any) => (
                                        <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                          {vehicle.brand} {vehicle.model} ({vehicle.plates}) - {vehicle.capacity} asientos
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            {/* Selección de conductor */}
                            <FormField
                              control={form.control}
                              name="driverId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Conductor</FormLabel>
                                  <Select 
                                    onValueChange={(value) => value === "none" ? field.onChange(null) : field.onChange(parseInt(value) || null)}
                                    value={field.value?.toString() || "none"}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar conductor" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Sin asignar</SelectItem>
                                      {driversQuery.data?.map((driver: any) => (
                                        <SelectItem key={driver.id} value={driver.id.toString()}>
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