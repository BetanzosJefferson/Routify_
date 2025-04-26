import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BoardingList } from "@/components/boarding-list/boarding-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { TabType } from "@/hooks/use-active-tab";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserCircle, CalendarDays, MapPin, BusFront } from "lucide-react";

// Definimos la estructura de un viaje para TypeScript
interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  availableSeats: number;
  price: number;
  vehicleType: string;
  vehicleId: number | null;
  driverId: number | null;
  status?: string;
  route: {
    id: number;
    name: string;
    origin: string;
    destination: string;
  };
  assignedVehicle?: {
    id: number;
    brand: string;
    model: string;
    plates: string;
    economicNumber: string;
  };
}

export default function ConductorPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("boarding-list");
  const [localContentTab, setLocalContentTab] = useState("viajes");

  // Consulta para obtener los viajes asignados al conductor
  const { data: assignedTrips, isLoading: isLoadingTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips", { driverId: user?.id }],
    enabled: !!user && user.role === "chofer",
  });
  
  // Tab change handler for child components
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const DriverContent = () => (
    <div className="py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal del Conductor</h1>
          <p className="text-muted-foreground">
            Gestiona tus viajes asignados y listas de abordaje
          </p>
        </div>
      </div>

      <Tabs 
        defaultValue="viajes" 
        value={localContentTab}
        onValueChange={setLocalContentTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full md:w-auto grid-cols-1 md:grid-cols-2">
          <TabsTrigger value="viajes">Mis Viajes</TabsTrigger>
          <TabsTrigger value="abordaje">Lista de Abordaje</TabsTrigger>
        </TabsList>
        
        <TabsContent value="viajes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingTrips ? (
              <div className="col-span-full flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !assignedTrips || assignedTrips.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-10 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No tienes viajes asignados</h3>
                <p className="text-muted-foreground max-w-md mt-2">
                  Cuando te asignen viajes, aparecerán aquí para que puedas gestionarlos.
                </p>
              </div>
            ) : (
              assignedTrips.map((trip) => (
                <Card key={trip.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle>{trip.route.name}</CardTitle>
                    <CardDescription>
                      {trip.route.origin} → {trip.route.destination}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm">
                      <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>
                        {new Date(trip.departureDate).toLocaleDateString('es-MX', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm">
                      <BusFront className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>
                        {trip.assignedVehicle 
                          ? `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} (${trip.assignedVehicle.plates})` 
                          : "No asignado"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <Badge variant="outline" className="capitalize">
                        {trip.status || "programado"}
                      </Badge>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => window.location.href = `/trip/${trip.id}/passengers`}
                      >
                        Ver Pasajeros
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="abordaje">
          <BoardingList />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <DriverContent />
          </main>
        </div>
      </div>
    </div>
  );
}