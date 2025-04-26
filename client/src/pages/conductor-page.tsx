import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserCircle, CalendarDays, MapPin, BusFront } from "lucide-react";

export default function ConductorPage() {
  const { user } = useAuth();

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

  // Consulta para obtener los viajes asignados al conductor
  const { data: assignedTrips, isLoading: isLoadingTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips", { driverId: user?.id }],
    enabled: !!user && user.role === "chofer",
  });

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal del Conductor</h1>
          <p className="text-muted-foreground">
            Gestiona tus viajes asignados y listas de abordaje
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <UserCircle className="h-10 w-10 text-primary" />
          <div>
            <div className="font-medium">
              {user?.firstName} {user?.lastName}
            </div>
            <Badge variant="outline" className="capitalize">
              {user?.role || "conductor"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <BoardingList />
      </div>
    </div>
  );
}