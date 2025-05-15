import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ChevronDown, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Textarea } from '@/components/ui/textarea';

type TransferRequest = {
  id: number;
  sourceCompanyId: string;
  targetCompanyId: string;
  sourceCompanyName: string;
  targetCompanyName: string;
  status: string;
  createdAt: string;
  createdBy: number;
  creatorName: string;
  details: TransferDetail[];
};

type TransferDetail = {
  id: number;
  transferRequestId: number;
  reservationId: number;
  sourceTripId: number;
  targetTripId: number | null;
  status: string;
  notes: string | null;
  passengerName: string;
  sourceTrip: {
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  };
  targetTrip?: {
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  };
};

export function TransferRequestsList() {
  const [activeTab, setActiveTab] = useState('entrantes');
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: incomingRequests,
    isLoading: isLoadingIncoming,
  } = useQuery<TransferRequest[]>({
    queryKey: ['/api/transfer-requests/incoming'],
    select: (data) => data || [],
  });

  const {
    data: outgoingRequests,
    isLoading: isLoadingOutgoing,
  } = useQuery<TransferRequest[]>({
    queryKey: ['/api/transfer-requests/outgoing'],
    select: (data) => data || [],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: number; notes: string }) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${requestId}/approve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud aprobada',
        description: 'La solicitud de transferencia ha sido aprobada exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/outgoing'] });
      setNotes('');
      setApproveDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al aprobar solicitud',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: number; notes: string }) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${requestId}/reject`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud rechazada',
        description: 'La solicitud de transferencia ha sido rechazada',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/outgoing'] });
      setNotes('');
      setRejectDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al rechazar solicitud',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (requestId: number) => {
    setSelectedRequestId(requestId);
    setApproveDialogOpen(true);
  };

  const handleReject = (requestId: number) => {
    setSelectedRequestId(requestId);
    setRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedRequestId) {
      approveMutation.mutate({ requestId: selectedRequestId, notes });
    }
  };

  const confirmReject = () => {
    if (selectedRequestId) {
      rejectMutation.mutate({ requestId: selectedRequestId, notes });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Aprobada</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rechazada</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };

  const toggleDetails = (requestId: number) => {
    setSelectedRequest(selectedRequest === requestId ? null : requestId);
  };

  const renderRequests = (requests: TransferRequest[] | undefined, isLoading: boolean, showActions: boolean) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!requests || requests.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No hay solicitudes de transferencia.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {requests.map((request) => (
          <Collapsible
            key={request.id}
            open={selectedRequest === request.id}
            onOpenChange={() => toggleDetails(request.id)}
            className="border rounded-lg"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-1">
                <div className="font-medium">
                  {activeTab === 'entrantes' 
                    ? `Desde: ${request.sourceCompanyName || request.sourceCompanyId}`
                    : `Para: ${request.targetCompanyName || request.targetCompanyId}`
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Creada {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: es })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(request.status)}
                {showActions && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="bg-green-50" onClick={() => handleApprove(request.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aprobar
                    </Button>
                    <Button size="sm" variant="outline" className="bg-red-50" onClick={() => handleReject(request.id)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <div className="p-4 pt-0 border-t">
                <h4 className="font-medium mb-2">Detalles de la transferencia</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pasajero</TableHead>
                      <TableHead>Viaje Original</TableHead>
                      <TableHead>Viaje Destino</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.details.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="font-medium">{detail.passengerName}</TableCell>
                        <TableCell>
                          {detail.sourceTrip.origin} → {detail.sourceTrip.destination}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(detail.sourceTrip.departureDate).toLocaleDateString()} {detail.sourceTrip.departureTime}
                          </span>
                        </TableCell>
                        <TableCell>
                          {detail.targetTrip ? (
                            <>
                              {detail.targetTrip.origin} → {detail.targetTrip.destination}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {new Date(detail.targetTrip.departureDate).toLocaleDateString()} {detail.targetTrip.departureTime}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">No asignado</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(detail.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitudes de Transferencia</CardTitle>
        <CardDescription>
          Gestiona las solicitudes de transferencia de pasajeros entre empresas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="entrantes">Solicitudes Entrantes</TabsTrigger>
            <TabsTrigger value="salientes">Solicitudes Salientes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="entrantes">
            {renderRequests(incomingRequests, isLoadingIncoming, true)}
          </TabsContent>
          
          <TabsContent value="salientes">
            {renderRequests(outgoingRequests, isLoadingOutgoing, false)}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog para aprobar solicitud */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Solicitud de Transferencia</DialogTitle>
            <DialogDescription>
              Confirma que deseas aprobar esta solicitud de transferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">
              Notas adicionales (opcional):
            </label>
            <Textarea
              placeholder="Añade notas para la transferencia..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Aprobación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para rechazar solicitud */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud de Transferencia</DialogTitle>
            <DialogDescription>
              Por favor, explica el motivo del rechazo de esta solicitud.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">
              Motivo del rechazo:
            </label>
            <Textarea
              placeholder="Explica por qué estás rechazando esta solicitud..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !notes.trim()}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Rechazo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}