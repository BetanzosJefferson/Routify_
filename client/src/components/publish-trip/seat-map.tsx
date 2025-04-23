import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

export type SeatStatus = "available" | "reserved" | "unavailable";

export interface Seat {
  id: number;
  status: SeatStatus;
}

interface SeatMapProps {
  initialCapacity?: number;
  onCapacityChange?: (capacity: number) => void;
  onSeatStatusChange?: (seatId: number, status: SeatStatus) => void;
}

export function SeatMap({ 
  initialCapacity = 18, 
  onCapacityChange,
  onSeatStatusChange 
}: SeatMapProps) {
  // Estado para los asientos
  const [seats, setSeats] = useState<Seat[]>([]);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [busType, setBusType] = useState<"small" | "medium" | "large">("medium");
  
  // Inicializar asientos cuando cambia la capacidad
  useEffect(() => {
    const newSeats: Seat[] = [];
    for (let i = 1; i <= capacity; i++) {
      newSeats.push({ id: i, status: "available" });
    }
    setSeats(newSeats);
  }, [capacity]);

  // Manejar cambio de tipo de autobús
  const handleBusTypeChange = (type: "small" | "medium" | "large") => {
    setBusType(type);
    let newCapacity = 18;
    
    switch (type) {
      case "small":
        newCapacity = 16;
        break;
      case "medium":
        newCapacity = 24;
        break;
      case "large":
        newCapacity = 40;
        break;
    }
    
    setCapacity(newCapacity);
    onCapacityChange?.(newCapacity);
  };

  // Manejar clic en un asiento para cambiar su estado
  const handleSeatClick = (seatId: number) => {
    setSeats(prevSeats => {
      return prevSeats.map(seat => {
        if (seat.id === seatId) {
          // Ciclo de estados: available -> unavailable -> available
          const newStatus: SeatStatus = seat.status === "available" ? "unavailable" : "available";
          
          // Notificar cambio a través del callback
          onSeatStatusChange?.(seatId, newStatus);
          
          return { ...seat, status: newStatus };
        }
        return seat;
      });
    });
  };

  // Obtener color según el estado del asiento
  const getSeatColor = (status: SeatStatus): string => {
    switch (status) {
      case "available":
        return "bg-green-400";
      case "reserved":
        return "bg-yellow-400";
      case "unavailable":
        return "bg-red-400";
      default:
        return "bg-gray-200";
    }
  };

  // Renderizar el mapa de asientos según el tipo de autobús
  const renderSeatMap = () => {
    switch (busType) {
      case "small":
        return renderSmallBusLayout();
      case "medium":
        return renderMediumBusLayout();
      case "large":
        return renderLargeBusLayout();
      default:
        return renderMediumBusLayout();
    }
  };

  // Layout para bus pequeño (16 asientos)
  const renderSmallBusLayout = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-gray-200 rounded-t-full w-20 h-10 mb-4 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-gray-500"></div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 w-40">
          {seats.slice(0, 16).map((seat) => renderSeat(seat))}
        </div>
      </div>
    );
  };

  // Layout para bus mediano (24 asientos)
  const renderMediumBusLayout = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-gray-200 rounded-t-full w-24 h-12 mb-4 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-gray-500"></div>
        </div>
        
        <div className="grid grid-cols-4 gap-2 w-64">
          {seats.slice(0, 24).map((seat) => renderSeat(seat))}
        </div>
      </div>
    );
  };

  // Layout para bus grande (40 asientos)
  const renderLargeBusLayout = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-gray-200 rounded-t-full w-28 h-14 mb-4 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-gray-500"></div>
        </div>
        
        <div className="grid grid-cols-4 gap-2 w-64">
          {seats.slice(0, 40).map((seat) => renderSeat(seat))}
        </div>
      </div>
    );
  };

  // Renderizar un asiento individual
  const renderSeat = (seat: Seat) => {
    return (
      <button
        key={seat.id}
        onClick={() => handleSeatClick(seat.id)}
        className={`${getSeatColor(seat.status)} border border-gray-400 rounded-t-lg p-1 flex flex-col items-center justify-end h-14 transition-colors cursor-pointer hover:opacity-80`}
        title={`Asiento ${seat.id}`}
      >
        <div className="text-xs font-bold text-gray-800">{seat.id}</div>
        <div className="w-full h-3 bg-gray-300 rounded-t-sm mt-1"></div>
      </button>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium">Mapa de asientos</h3>
            <p className="text-sm text-gray-500">
              Configura la distribución de asientos del vehículo
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <InfoIcon className="h-5 w-5 text-gray-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="w-80">
                <p>
                  Haz clic en los asientos para marcarlos como disponibles o no disponibles.
                  Los asientos no disponibles no se mostrarán para reservaciones.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Tabs defaultValue="medium" onValueChange={(value) => handleBusTypeChange(value as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="small">Bus Pequeño (16)</TabsTrigger>
            <TabsTrigger value="medium">Bus Mediano (24)</TabsTrigger>
            <TabsTrigger value="large">Bus Grande (40)</TabsTrigger>
          </TabsList>

          <div className="flex justify-center py-6 border rounded-md bg-slate-50">
            {renderSeatMap()}
          </div>
        </Tabs>

        <div className="mt-6 flex gap-4 justify-center">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-400 rounded-sm mr-2"></div>
            <span className="text-sm">Disponible</span>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-400 rounded-sm mr-2"></div>
            <span className="text-sm">Reservado</span>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-400 rounded-sm mr-2"></div>
            <span className="text-sm">No disponible</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}