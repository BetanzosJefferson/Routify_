import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CompanySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCompanies: string[]) => void;
}

export function CompanySelectionModal({ isOpen, onClose, onConfirm }: CompanySelectionModalProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Cargar empresas cuando el modal se abre
  useEffect(() => {
    async function fetchCompanies() {
      if (!isOpen) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log("Llamando a API para obtener empresas...");
        const response = await fetch('/api/companies', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log("Respuesta recibida con status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error en respuesta:", errorText);
          throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Datos recibidos:", data);
        setCompanies(data);
      } catch (err) {
        console.error("Error al cargar empresas:", err);
        setError(err instanceof Error ? err : new Error('Error desconocido'));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchCompanies();
    setSelectedCompanies([]);
  }, [isOpen]);
  
  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanies(prev => {
      // Si ya está seleccionada, quitarla
      if (prev.includes(companyId)) {
        return prev.filter(id => id !== companyId);
      } 
      // Si no está seleccionada, añadirla
      return [...prev, companyId];
    });
  };
  
  const handleConfirm = () => {
    onConfirm(selectedCompanies);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seleccionar Empresas</DialogTitle>
          <DialogDescription>
            Selecciona las empresas a las que este usuario de taquilla tendrá acceso.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar las empresas: {error instanceof Error ? error.message : 'Por favor, intenta de nuevo.'}
            </AlertDescription>
          </Alert>
        ) : companies && companies.length > 0 ? (
          <ScrollArea className="h-[300px] px-1">
            <div className="space-y-4">
              {companies.map((company: any) => (
                <div key={company.identifier} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox 
                    id={`company-${company.identifier}`}
                    checked={selectedCompanies.includes(company.identifier)}
                    onCheckedChange={() => handleSelectCompany(company.identifier)}
                  />
                  <label
                    htmlFor={`company-${company.identifier}`}
                    className="flex items-center gap-3 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
                  >
                    {company.logo && (
                      <img 
                        src={company.logo} 
                        alt={company.name} 
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <span>{company.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay empresas disponibles para asignar.
            </AlertDescription>
          </Alert>
        )}
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            onClick={handleConfirm}
            disabled={selectedCompanies.length === 0}
          >
            Confirmar Selección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}