import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type CompanyLink = {
  id: number;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  status: string;
  createdAt: string;
};

export function CompanyLinkList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const {
    data: links,
    isLoading,
    isError,
    error,
  } = useQuery<CompanyLink[]>({
    queryKey: ['/api/company-links'],
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los vínculos entre empresas.',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Activo</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600">Rechazado</Badge>;
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

  const filteredLinks = links 
    ? links.filter(
        (link) =>
          link.sourceCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.targetCompanyName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vínculos con Otras Empresas</CardTitle>
        <CardDescription>
          Gestiona las conexiones establecidas con otras empresas para transferencia de pasajeros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre de empresa..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Error al cargar los datos. Por favor, intenta nuevamente.</p>
          </div>
        ) : links?.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No hay vínculos establecidos con otras empresas.</p>
            <Button className="mt-4" variant="outline" size="sm">
              Crear nuevo vínculo
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa Origen</TableHead>
                  <TableHead>Empresa Destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.sourceCompanyName}</TableCell>
                    <TableCell>{link.targetCompanyName}</TableCell>
                    <TableCell>{getStatusBadge(link.status)}</TableCell>
                    <TableCell>{formatDate(link.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}