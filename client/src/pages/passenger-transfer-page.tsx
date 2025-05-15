import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select";
import { ArrowRightIcon, CalendarIcon, SearchIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator"; 
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PassengerTransferPage() {
  const [sourceTrip, setSourceTrip] = useState<string | null>(null);
  const [targetTrip, setTargetTrip] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Transferencia de Pasajeros</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Selección de Viaje Origen */}
        <Card>
          <CardHeader>
            <CardTitle>Viaje Origen</CardTitle>
            <CardDescription>Seleccione el viaje desde donde transferir pasajeros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/2">
                  <Label htmlFor="origin-date">Fecha</Label>
                  <div className="mt-1">
                    <DatePicker
                      date={selectedDate}
                      onDateChange={setSelectedDate}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <Label htmlFor="source-trip">Ruta/Viaje</Label>
                  <Select value={sourceTrip || ""} onValueChange={setSourceTrip}>
                    <SelectTrigger id="source-trip" className="mt-1">
                      <SelectValue placeholder="Seleccionar viaje" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="1">Acapulco - CDMX (08:00)</SelectItem>
                        <SelectItem value="2">Chilpancingo - CDMX (10:30)</SelectItem>
                        <SelectItem value="3">Acapulco - Cuernavaca (12:00)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="passenger-search">Buscar pasajero</Label>
                </div>
                <div className="flex mt-1">
                  <Input
                    id="passenger-search"
                    placeholder="Nombre, apellido o folio"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" className="ml-2">
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-md mt-4">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium">Pasajeros disponibles</h3>
                </div>
                <div className="divide-y">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Juan Pérez</p>
                      <p className="text-sm text-gray-500">Asiento 15 • Folio: A1234</p>
                    </div>
                    <Button size="sm" variant="ghost">Seleccionar</Button>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Maria González</p>
                      <p className="text-sm text-gray-500">Asiento 22 • Folio: A1235</p>
                    </div>
                    <Button size="sm" variant="ghost">Seleccionar</Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selección de Viaje Destino */}
        <Card>
          <CardHeader>
            <CardTitle>Viaje Destino</CardTitle>
            <CardDescription>Seleccione el viaje a donde transferir pasajeros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/2">
                  <Label htmlFor="target-date">Fecha</Label>
                  <div className="mt-1">
                    <DatePicker
                      date={selectedDate}
                      onDateChange={setSelectedDate}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <Label htmlFor="target-trip">Ruta/Viaje</Label>
                  <Select value={targetTrip || ""} onValueChange={setTargetTrip}>
                    <SelectTrigger id="target-trip" className="mt-1">
                      <SelectValue placeholder="Seleccionar viaje" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="4">Acapulco - CDMX (12:00)</SelectItem>
                        <SelectItem value="5">Chilpancingo - CDMX (14:30)</SelectItem>
                        <SelectItem value="6">Acapulco - Cuernavaca (16:00)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="border rounded-md mt-4">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium">Asientos disponibles</h3>
                </div>
                <div className="px-4 py-3">
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((seat) => (
                      <Button 
                        key={seat} 
                        variant="outline" 
                        className="h-10 w-10"
                        disabled={[3, 7, 12].includes(seat)}
                      >
                        {seat}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded border border-input mr-2"></div>
                      <span>Disponible</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300 mr-2"></div>
                      <span>Ocupado</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded bg-primary border border-primary mr-2"></div>
                      <span>Seleccionado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sección de Pasajeros Seleccionados para Transferir */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pasajeros para Transferir</CardTitle>
          <CardDescription>Revise los pasajeros seleccionados para transferencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <div className="px-4 py-3 bg-gray-50 border-b grid grid-cols-12 gap-4 text-sm font-medium">
              <div className="col-span-3">Pasajero</div>
              <div className="col-span-2">Folio</div>
              <div className="col-span-2">Viaje origen</div>
              <div className="col-span-1 flex justify-center"><ArrowRightIcon className="h-4 w-4" /></div>
              <div className="col-span-2">Viaje destino</div>
              <div className="col-span-2">Asiento nuevo</div>
            </div>
            <div className="divide-y">
              {/* No hay pasajeros seleccionados aún */}
              <div className="px-4 py-6 text-center text-gray-500">
                <p>No hay pasajeros seleccionados para transferir</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" disabled>
          Realizar Transferencia
        </Button>
      </div>
    </div>
  );
}