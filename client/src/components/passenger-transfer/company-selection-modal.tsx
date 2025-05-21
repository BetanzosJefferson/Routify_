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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Check } from "lucide-react";
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
  
  // Estado para comisionistas
  const [hasCommissionAgents, setHasCommissionAgents] = React.useState<boolean>(false);
  const [showCommissionWarning, setShowCommissionWarning] = React.useState<boolean>(false);
  
  // Verificar si hay comisionistas entre las reservaciones seleccionadas
  React.useEffect(() => {
    // Verificamos si alguna reservación fue creada por comisionista
    const checkForCommissionAgents = async () => {
      try {
        const response = await fetch(`/api/reservations/check-commission-agents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reservationIds: selectedReservationIds }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setHasCommissionAgents(data.hasCommissionAgents || false);
        }
      } catch (error) {
        console.error("Error al verificar comisionistas:", error);
        // Por defecto, para mayor seguridad, activar la advertencia
        setHasCommissionAgents(true);
      }
    };
    
    checkForCommissionAgents();
  }, [selectedReservationIds]);
  
  // Manejar selección de empresa
  const handleSelectCompany = () => {
    if (!selectedCompanyId || !companies) return;
    
    // Si hay comisionistas implicados, mostrar advertencia primero
    if (hasCommissionAgents && !showCommissionWarning) {
      setShowCommissionWarning(true);
      return;
    }
    
    // Si ya se mostró la advertencia o no hay comisionistas, proceder con la transferencia
    const company = companies.find(c => c.identifier === selectedCompanyId);
    if (company) {
      onCompanySelected(company);
    }
    
    // Resetear estado de advertencia
    setShowCommissionWarning(false);
  };
  
  return (
    <>
      {/* Alerta sobre comisiones de agentes */}
      <AlertDialog 
        open={showCommissionWarning} 
        onOpenChange={(open) => {
          if (!open) setShowCommissionWarning(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600">
              ¡Importante! Comisión por transferir
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p className="text-base">
                  Una o más reservaciones que estás por transferir fueron creadas por <strong>comisionistas</strong>.
                </p>
                <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                  <h4 className="font-medium text-amber-700 mb-2">Recuerda que:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-amber-700">
                    <li>La comisión debe ser pagada por la empresa que recibe la transferencia</li>
                    <li>El pago se realiza cuando el pasajero aborde el transporte</li>
                    <li>Las comisiones se heredan a la empresa receptora</li>
                  </ul>
                </div>
                <p>
                  Asegúrate de informar a la empresa destino sobre estas comisiones pendientes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancelar transferencia
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSelectCompany}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Entendido, continuar con la transferencia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de selección de empresa */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
    </>
  );
}