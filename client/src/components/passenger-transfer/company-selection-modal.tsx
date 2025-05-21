import React from "react";
import { Company } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
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
  // Hook para obtener listado de empresas autorizadas
  const { 
    data: companies = [], 
    isLoading, 
    error,
    refetch: refetchCompanies
  } = useQuery({
    queryKey: ['/api/transfers/authorized-companies'],
    enabled: isOpen
  });
  
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
  
  // Estado para manejar la generación de invitaciones
  const [isGeneratingInvitation, setIsGeneratingInvitation] = React.useState(false);
  const [invitationToken, setInvitationToken] = React.useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = React.useState<string | null>(null);
  
  // Función para generar enlace de invitación
  const generateInvitation = async () => {
    try {
      setIsGeneratingInvitation(true);
      
      const response = await fetch('/api/transfers/generate-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvitationToken(data.token);
        
        // Crear URL completa para la invitación
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/transfers/invitation/${data.token}`;
        setInvitationUrl(inviteUrl);
        
        toast({
          title: "Enlace generado",
          description: "Se ha creado un enlace único para invitar a otra empresa",
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error al generar enlace",
          description: errorData.details || "No se pudo generar el enlace de invitación",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error al generar invitación:", error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar al servidor para generar la invitación",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInvitation(false);
    }
  };
  
  // Función para copiar enlace al portapapeles
  const copyInvitationLink = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl)
        .then(() => {
          toast({
            title: "Enlace copiado",
            description: "El enlace de invitación se ha copiado al portapapeles",
            variant: "default"
          });
        })
        .catch(err => {
          console.error("Error al copiar enlace:", err);
          toast({
            title: "Error al copiar",
            description: "No se pudo copiar el enlace. Intente seleccionar y copiar manualmente.",
            variant: "destructive"
          });
        });
    }
  };
  
  // Manejar selección de empresa
  const handleSelectCompany = () => {
    if (!selectedCompanyId || !companies) return;
    
    // Si hay comisionistas implicados, mostrar advertencia primero
    if (hasCommissionAgents && !showCommissionWarning) {
      setShowCommissionWarning(true);
      return;
    }
    
    // Si ya se mostró la advertencia o no hay comisionistas, proceder con la transferencia
    const company = companies.find(c => c.id === selectedCompanyId);
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
          
          <div className="mb-6 space-y-4">
            {invitationUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/20">
                  <div className="flex-1 mr-2 overflow-hidden">
                    <p className="font-mono text-sm truncate">{invitationUrl}</p>
                  </div>
                  <Button size="sm" onClick={copyInvitationLink}>
                    Copiar enlace
                  </Button>
                </div>
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                  <p className="text-sm text-amber-800">
                    Comparta este enlace con el dueño de la otra empresa. Solo será válido por 7 días y podrá usarse una sola vez.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setInvitationToken(null);
                    setInvitationUrl(null);
                    refetchCompanies();
                  }}
                >
                  Crear nuevo enlace
                </Button>
              </div>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  className="w-full py-6 border-dashed border-2 hover:border-primary"
                  onClick={generateInvitation}
                  disabled={isGeneratingInvitation}
                >
                  {isGeneratingInvitation ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generando enlace...
                    </>
                  ) : (
                    <>
                      <Building2 className="mr-2 h-5 w-5" />
                      Agregar nueva empresa
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Genere un enlace único para invitar a otra empresa a recibir transferencias
                </p>
              </>
            )}
          </div>

          {companies && companies.length === 0 ? (
            <div className="py-4 px-6 bg-yellow-100 text-yellow-800 rounded-md">
              No se encontraron empresas con autorización para transferencia.
              Agregue una nueva empresa usando el botón de arriba.
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium">Empresas autorizadas</h3>
              <RadioGroup value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
                {companies.map(company => (
                  <Card 
                    key={company.id}
                    className={`cursor-pointer transition-all ${selectedCompanyId === company.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="bg-muted p-2 rounded-md">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{company.name}</h3>
                          <p className="text-sm text-muted-foreground">{company.identifier || company.id}</p>
                        </div>
                      </div>
                      <RadioGroupItem 
                        value={company.id} 
                        id={`company-${company.id}`}
                        className="h-5 w-5"
                      />
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
            </div>
          )}
              
          <Separator className="my-4" />
          
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
                      companies?.find(c => c.identifier === selectedCompanyId)?.name || 'N/A'
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
        </DialogContent>
      </Dialog>
    </>
  );
}