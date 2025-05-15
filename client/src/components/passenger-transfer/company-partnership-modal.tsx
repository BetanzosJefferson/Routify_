import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogHeader,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Building2, Link, LinkIcon, X, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Interfaces
interface CompanyPartnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReservationIds: number[];
}

interface CompanyPartnership {
  id: number;
  companyId: string;
  partnerCompanyId: string;
  createdAt: string;
  isActive: boolean;
  partnerCompany: {
    name: string;
    identifier: string;
    logo?: string;
  };
}

interface CompanyInvitation {
  id: number;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  usedBy: string | null;
  createdAt: string;
  url?: string; // URL completa para compartir
}

export default function CompanyPartnershipModal({ 
  isOpen, 
  onClose,
  selectedReservationIds 
}: CompanyPartnershipModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [invitationUrl, setInvitationUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Consultar las empresas vinculadas
  const { 
    data: partnerships = [], 
    isLoading: isLoadingPartnerships,
    error: partnershipsError 
  } = useQuery<CompanyPartnership[]>({
    queryKey: ['/api/company-partnerships'],
    enabled: isOpen && !!user,
  });

  // Consultar las invitaciones activas
  const { 
    data: invitations = [], 
    isLoading: isLoadingInvitations,
    error: invitationsError
  } = useQuery<CompanyInvitation[]>({
    queryKey: ['/api/company-invitations'],
    enabled: isOpen && !!user,
  });

  // Mutación para crear una nueva invitación
  const createInvitationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/company-invitations', {});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-invitations'] });
      setInvitationUrl(data.url);
      toast({
        title: 'URL de invitación generada',
        description: 'Ahora puedes compartir esta URL con otra empresa para vincularla',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al generar la invitación',
        description: 'No se pudo crear la URL de invitación. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  });

  // Mutación para transferir pasajeros a una empresa vinculada
  const transferPassengersMutation = useMutation({
    mutationFn: async (partnerCompanyId: string) => {
      return await apiRequest('POST', '/api/passenger-transfers', {
        reservationIds: selectedReservationIds,
        partnerCompanyId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      toast({
        title: 'Transferencia exitosa',
        description: `${selectedReservationIds.length} reservaciones transferidas correctamente`,
        variant: 'default',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error en la transferencia',
        description: 'No se pudieron transferir las reservaciones. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  });

  // Manejar la generación de nueva URL
  const handleGenerateInvitation = () => {
    createInvitationMutation.mutate();
  };

  // Copiar URL al portapapeles
  const handleCopyUrl = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => {
          toast({
            title: 'Error al copiar',
            description: 'No se pudo copiar la URL al portapapeles',
            variant: 'destructive',
          });
        });
    }
  };

  // Manejar la transferencia a una empresa específica
  const handleTransferToCompany = (partnerCompanyId: string) => {
    if (window.confirm(`¿Estás seguro de transferir ${selectedReservationIds.length} reservaciones a esta empresa?`)) {
      transferPassengersMutation.mutate(partnerCompanyId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Transferencia de Pasajeros</DialogTitle>
          <DialogDescription>
            Selecciona una empresa vinculada para transferir {selectedReservationIds.length} reservaciones, 
            o genera una nueva URL de invitación para vincular otra empresa.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de empresas vinculadas */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas Vinculadas
          </h3>
          
          {isLoadingPartnerships ? (
            // Esqueletos de carga
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-9 w-[100px]" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : partnershipsError ? (
            <p className="text-red-500">Error al cargar empresas vinculadas</p>
          ) : partnerships.length > 0 ? (
            <div className="space-y-2">
              {partnerships.map((partnership) => (
                <Card key={partnership.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{partnership.partnerCompany.name}</h4>
                      <p className="text-sm text-muted-foreground">ID: {partnership.partnerCompany.identifier}</p>
                    </div>
                    <Button 
                      onClick={() => handleTransferToCompany(partnership.partnerCompanyId)}
                      disabled={transferPassengersMutation.isPending}
                    >
                      Transferir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay empresas vinculadas. Genera una URL de invitación para vincular otra empresa.</p>
          )}
        </div>

        <Separator className="my-4" />

        {/* Sección de invitaciones */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LinkIcon className="h-5 w-5" /> URLs de Invitación
            </h3>
            <Button 
              onClick={handleGenerateInvitation} 
              disabled={createInvitationMutation.isPending}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" /> Generar nueva URL
            </Button>
          </div>

          {/* URL generada recientemente */}
          {invitationUrl && (
            <Card className="bg-secondary">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Nueva invitación generada</h4>
                  <Badge variant="outline" className="bg-green-100 text-green-800">Activa</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    value={invitationUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleCopyUrl}
                    className="shrink-0"
                  >
                    {copySuccess ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta URL expirará en 24 horas y solo puede ser utilizada una vez
                </p>
              </CardContent>
            </Card>
          )}

          {/* Listado de invitaciones existentes */}
          {isLoadingInvitations ? (
            <div className="space-y-2">
              {Array(2).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : invitationsError ? (
            <p className="text-red-500">Error al cargar invitaciones</p>
          ) : invitations.length > 0 ? (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <Card key={invitation.id} className={invitation.isUsed ? 'opacity-70' : ''}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {invitation.isUsed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <h4 className="font-medium">
                            Invitación {invitation.isUsed ? 'utilizada' : 'pendiente'}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Creada: {new Date(invitation.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={invitation.isUsed ? 'outline' : 'default'}>
                        {invitation.isUsed ? 'Utilizada' : 'Activa'}
                      </Badge>
                    </div>
                    {invitation.isUsed && (
                      <p className="text-sm mt-2">
                        Utilizada por: <span className="font-medium">{invitation.usedBy}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay invitaciones activas.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}