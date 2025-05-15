import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ChevronDown, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const {
    data: incomingRequests,
    isLoading: isLoadingIncoming,
    isError: isErrorIncoming,
  } = useQuery<TransferRequest[]>({
    queryKey: ['/api/transfer-requests/incoming'],
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes de transferencia entrantes.',
        variant: 'destructive',
      });
    },
  });

  const {
    data: outgoingRequests,
    isLoading: isLoadingOutgoing,
    isError: isErrorOutgoing,
  } = useQuery<TransferRequest[]>({
    queryKey: ['/api/transfer-requests/outgoing'],
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes de transferencia salientes.',
        variant: 'destructive',
      });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${requestId}/approve`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud aprobada',
        description: 'La solicitud de transferencia ha sido aprobada con éxito.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/outgoing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la solicitud. Por favor, intenta nuevamente.',
        variant: 'destructive',
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${requestId}/reject`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud rechazada',
        description: 'La solicitud de transferencia ha sido rechazada.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests/outgoing'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la solicitud. Por favor, intenta nuevamente.',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Aprobada</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600">Rechazada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (timeString: string) => {
    // Formato esperado: "HH:MM:SS" o "HH:MM"
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;
    
    const hour = parseInt(parts[0]);
    const minute = parts[1];
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    
    return `${hour12}:${minute} ${period}`;
  };

  const filteredIncoming = incomingRequests 
    ? incomingRequests.filter(
        (request) =>
          request.sourceCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.status.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const filteredOutgoing = outgoingRequests 
    ? outgoingRequests.filter(
        (request) =>
          request.targetCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.status.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleApprove = (requestId: number) => {
    approveRequestMutation.mutate(requestId);
  };

  const handleReject = (requestId: number) => {
    rejectRequestMutation.mutate(requestId);
  };

  const renderRequestsList = (requests: TransferRequest[], incoming: boolean, loading: boolean, error: boolean) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          <p>Error al cargar los datos. Por favor, intenta nuevamente.</p>
        </div>
      );
    }

    if (!requests || requests.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          <p>No hay solicitudes de transferencia {incoming ? 'entrantes' : 'salientes'}.</p>
        </div>
      );
    }

    return (
      <Accordion type="single" collapsible className="w-full">
        {requests.map((request) => (
          <AccordionItem key={request.id} value={`request-${request.id}`}>
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-md">
              <div className="flex flex-1 items-center justify-between pr-4">
                <div className="font-medium">
                  {incoming ? request.sourceCompanyName : request.targetCompanyName}
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {formatDate(request.createdAt)}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4">
              <div className="space-y-4">
                <div className="text-sm grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium">Empresa origen:</span> {request.sourceCompanyName}
                    </div>
                    <div>
                      <span className="font-medium">Empresa destino:</span> {request.targetCompanyName}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Solicitado por:</span> {request.creatorName}
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pasajero</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.details.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell className="font-medium">{detail.passengerName}</TableCell>
                          <TableCell>{detail.sourceTrip.origin}</TableCell>
                          <TableCell>{detail.sourceTrip.destination}</TableCell>
                          <TableCell>
                            {formatDate(detail.sourceTrip.departureDate)} {formatTime(detail.sourceTrip.departureTime)}
                          </TableCell>
                          <TableCell>{getStatusBadge(detail.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {request.status === 'pending' && incoming && (
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-600 text-red-600 hover:bg-red-50"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectRequestMutation.isPending}
                    >
                      {rejectRequestMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" /> Rechazar
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApprove(request.id)}
                      disabled={approveRequestMutation.isPending}
                    >
                      {approveRequestMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" /> Aprobar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa o estado..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="incoming">Entrantes</TabsTrigger>
            <TabsTrigger value="outgoing">Salientes</TabsTrigger>
          </TabsList>
          <TabsContent value="incoming">
            {renderRequestsList(
              filteredIncoming, 
              true, 
              isLoadingIncoming, 
              isErrorIncoming
            )}
          </TabsContent>
          <TabsContent value="outgoing">
            {renderRequestsList(
              filteredOutgoing, 
              false, 
              isLoadingOutgoing, 
              isErrorOutgoing
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}