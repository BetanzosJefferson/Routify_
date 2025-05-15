import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronDown, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type TransferHistoryItem = {
  id: number;
  requestId: number;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  passengerName: string;
  sourceTrip: {
    id: number;
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  };
  targetTrip: {
    id: number;
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  } | null;
  notes: string | null;
};

export function TransferHistoryList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null);

  const { data: transferHistory, isLoading } = useQuery<TransferHistoryItem[]>({
    queryKey: ['/api/transfer-history'],
    select: (data) => data || [],
  });

  const toggleDetails = (transferId: number) => {
    setSelectedTransfer(selectedTransfer === transferId ? null : transferId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completada</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">En Proceso</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">Cancelada</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };

  const filteredHistory = transferHistory?.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.passengerName.toLowerCase().includes(searchLower) ||
      item.sourceCompanyName.toLowerCase().includes(searchLower) ||
      item.targetCompanyName.toLowerCase().includes(searchLower) ||
      item.sourceTrip.origin.toLowerCase().includes(searchLower) ||
      item.sourceTrip.destination.toLowerCase().includes(searchLower) ||
      (item.targetTrip && item.targetTrip.origin.toLowerCase().includes(searchLower)) ||
      (item.targetTrip && item.targetTrip.destination.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
          <CardDescription>
            Revisa el historial completo de transferencias de pasajeros.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Transferencias</CardTitle>
        <CardDescription>
          Revisa el historial completo de transferencias de pasajeros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pasajero, empresa o destino..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {!filteredHistory || filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No se encontraron transferencias que coincidan con tu búsqueda.'
                : 'No hay historial de transferencias disponible.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((transfer) => (
              <Collapsible
                key={transfer.id}
                open={selectedTransfer === transfer.id}
                onOpenChange={() => toggleDetails(transfer.id)}
                className="border rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="font-medium">{transfer.passengerName}</div>
                    <div className="text-sm text-muted-foreground">
                      De {transfer.sourceCompanyName} a {transfer.targetCompanyName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(transfer.status)}
                    <div className="text-sm text-muted-foreground hidden sm:block">
                      {format(parseISO(transfer.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="font-medium mb-2">Viaje Original</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Ruta:</span> {transfer.sourceTrip.origin} → {transfer.sourceTrip.destination}</p>
                          <p>
                            <span className="font-medium">Salida:</span> {format(parseISO(transfer.sourceTrip.departureDate), 'dd/MM/yyyy', { locale: es })} {transfer.sourceTrip.departureTime}
                          </p>
                          <p><span className="font-medium">Empresa:</span> {transfer.sourceCompanyName}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Viaje Destino</h4>
                        {transfer.targetTrip ? (
                          <div className="text-sm space-y-1">
                            <p><span className="font-medium">Ruta:</span> {transfer.targetTrip.origin} → {transfer.targetTrip.destination}</p>
                            <p>
                              <span className="font-medium">Salida:</span> {format(parseISO(transfer.targetTrip.departureDate), 'dd/MM/yyyy', { locale: es })} {transfer.targetTrip.departureTime}
                            </p>
                            <p><span className="font-medium">Empresa:</span> {transfer.targetCompanyName}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No se asignó viaje destino</p>
                        )}
                      </div>
                    </div>
                    {transfer.notes && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Notas</h4>
                        <p className="text-sm">{transfer.notes}</p>
                      </div>
                    )}
                    <div className="mt-4 text-xs text-muted-foreground">
                      <p>Creada: {format(parseISO(transfer.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                      {transfer.completedAt && (
                        <p>Completada: {format(parseISO(transfer.completedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}