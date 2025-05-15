import React from "react";
import { useCompanies } from "@/hooks/use-companies";
import { Company } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Briefcase, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

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
  // Hook para obtener listado de empresas
  const { data: companies, isLoading, error } = useCompanies(true);
  
  // Estado para la empresa seleccionada
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null);
  
  // Manejar selección de empresa
  const handleSelectCompany = () => {
    if (!selectedCompanyId || !companies) return;
    
    const company = companies.find(c => c.identifier === selectedCompanyId);
    if (company) {
      onCompanySelected(company);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seleccionar empresa destino</DialogTitle>
          <DialogDescription>
            Seleccione la empresa a la que desea transferir {selectedReservationIds.length} reservación(es)
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Cargando empresas...</span>
          </div>
        )}
        
        {error && (
          <div className="py-4 px-6 bg-destructive/10 text-destructive rounded-md">
            Error al cargar las empresas. Por favor intente nuevamente.
          </div>
        )}
        
        {companies && companies.length === 0 && (
          <div className="py-4 px-6 bg-yellow-100 text-yellow-800 rounded-md">
            No se encontraron empresas disponibles para transferencia.
          </div>
        )}
        
        {companies && companies.length > 0 && (
          <div className="space-y-4">
            <RadioGroup value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
              {companies.map(company => (
                <Card 
                  key={company.identifier}
                  className={`cursor-pointer transition-all ${selectedCompanyId === company.identifier ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
                  onClick={() => setSelectedCompanyId(company.identifier)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="bg-muted p-2 rounded-md">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">{company.identifier}</p>
                      </div>
                    </div>
                    <RadioGroupItem 
                      value={company.identifier} 
                      id={`company-${company.identifier}`}
                      className="h-5 w-5"
                    />
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Separator />
            
            <div className="py-4">
              <h3 className="font-medium mb-2">Resumen de la transferencia</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Reservaciones seleccionadas</TableCell>
                    <TableCell>{selectedReservationIds.length}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Destino</TableCell>
                    <TableCell>
                      {selectedCompanyId ? (
                        companies.find(c => c.identifier === selectedCompanyId)?.name || 'N/A'
                      ) : (
                        <span className="text-muted-foreground italic">No seleccionado</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                disabled={!selectedCompanyId} 
                onClick={handleSelectCompany}
              >
                <Check className="mr-2 h-4 w-4" />
                Transferir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}