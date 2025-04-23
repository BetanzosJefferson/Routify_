import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPinIcon, PlusCircleIcon } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { State, Municipality, mexicoStates, getMunicipalitiesByState } from "@/lib/location-data";

interface LocationData {
  stateCode: string;
  municipalityCode: string;
  stationName: string;
  fullName: string;
}

interface LocationPickerProps {
  onLocationAdded: (location: LocationData) => void;
  buttonText?: string;
  className?: string;
}

export function LocationPicker({ onLocationAdded, buttonText = "Agregar ubicación", className }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<string | undefined>(undefined);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | undefined>(undefined);
  const [stationName, setStationName] = useState("");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Resetear el estado del componente cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setSelectedState(undefined);
      setSelectedMunicipality(undefined);
      setStationName("");
      setError(null);
    }
  }, [open]);

  // Actualizar municipios cuando cambia el estado seleccionado
  useEffect(() => {
    if (selectedState) {
      setMunicipalities(getMunicipalitiesByState(selectedState));
      setSelectedMunicipality(undefined);
    } else {
      setMunicipalities([]);
    }
  }, [selectedState]);

  // Manejar cambio de estado
  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setError(null);
  };

  // Manejar cambio de municipio
  const handleMunicipalityChange = (value: string) => {
    setSelectedMunicipality(value);
    setError(null);
  };

  // Manejar adición de ubicación
  const handleAddLocation = () => {
    // Validar que se hayan seleccionado todos los campos
    if (!selectedState) {
      setError("Por favor selecciona un estado.");
      return;
    }
    
    if (!selectedMunicipality) {
      setError("Por favor selecciona un municipio.");
      return;
    }
    
    if (!stationName.trim()) {
      setError("Por favor ingresa un nombre para la parada o estación.");
      return;
    }

    // Encontrar los nombres completos de estado y municipio
    const state = mexicoStates.find(s => s.code === selectedState);
    const municipality = municipalities.find(m => m.code === selectedMunicipality);
    
    if (!state || !municipality) {
      setError("Error al recuperar los datos de ubicación.");
      return;
    }

    // Crear nombre completo formateado
    const fullName = `${municipality.name}, ${state.name} - ${stationName}`;
    
    // Llamar al callback con la información de la ubicación
    onLocationAdded({
      stateCode: selectedState,
      municipalityCode: selectedMunicipality,
      stationName: stationName.trim(),
      fullName
    });
    
    // Cerrar el diálogo
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <PlusCircleIcon className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Agregar nueva ubicación</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="state">Estado</Label>
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Selecciona el estado" />
              </SelectTrigger>
              <SelectContent>
                {mexicoStates.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="municipality">Ciudad</Label>
            <Select 
              value={selectedMunicipality} 
              onValueChange={handleMunicipalityChange}
              disabled={!selectedState}
            >
              <SelectTrigger id="municipality">
                <SelectValue placeholder={selectedState ? "Selecciona la ciudad" : "Primero selecciona un estado"} />
              </SelectTrigger>
              <SelectContent>
                {municipalities.map((municipality) => (
                  <SelectItem key={municipality.code} value={municipality.code}>
                    {municipality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="stationName">Nombre de la parada o estación</Label>
            <Input
              id="stationName"
              placeholder="Ej: Terminal Central, Aeropuerto, Plaza Principal"
              value={stationName}
              onChange={(e) => {
                setStationName(e.target.value);
                setError(null);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAddLocation}>
            <MapPinIcon className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}