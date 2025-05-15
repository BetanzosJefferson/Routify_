import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCompanies } from "@/hooks/use-companies";
import { Company } from "@shared/schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CompanySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReservationIds: number[];
  onCompanySelected: (company: Company) => void;
}

export function CompanySelectionModal({ 
  isOpen, 
  onClose, 
  selectedReservationIds,
  onCompanySelected
}: CompanySelectionModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // Obtener todas las empresas excepto la actual
  const { data: companies, isLoading, error } = useCompanies(true);
  
  const handleSubmit = () => {
    if (!selectedCompanyId || !companies) return;
    
    const selectedCompany = companies.find(c => c.identifier === selectedCompanyId);
    if (selectedCompany) {
      onCompanySelected(selectedCompany);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Seleccionar empresa destino</DialogTitle>
        </DialogHeader>
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Cargando empresas...</p>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-destructive/10 rounded-md text-destructive text-center">
            Error al cargar las empresas. Por favor, intente nuevamente.
          </div>
        )}
        
        {companies && companies.length === 0 && (
          <div className="p-4 bg-yellow-100 rounded-md text-yellow-800 text-center">
            No hay otras empresas disponibles para transferir pasajeros.
          </div>
        )}
        
        {companies && companies.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Seleccione la empresa a la que desea transferir 
              {selectedReservationIds.length === 1 ? ' la reservación' : ' las reservaciones'}.
            </p>
            
            <RadioGroup 
              value={selectedCompanyId || ""} 
              onValueChange={setSelectedCompanyId}
              className="space-y-3"
            >
              {companies.map(company => (
                <Card key={company.identifier} className={`border ${selectedCompanyId === company.identifier ? 'border-primary' : ''}`}>
                  <CardContent className="pt-4 pb-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value={company.identifier} 
                        id={`company-${company.identifier}`} 
                      />
                      <Label 
                        htmlFor={`company-${company.identifier}`}
                        className="flex flex-1 cursor-pointer"
                      >
                        <div>
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {company.identifier}</div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <div className="mt-6 flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              
              <Button 
                disabled={!selectedCompanyId}
                onClick={handleSubmit}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}