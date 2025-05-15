import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type CompanyLink = {
  id: number;
  sourceCompanyId: string;
  targetCompanyId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sourceCompanyName: string;
  targetCompanyName: string;
};

export function CompanyLinkList() {
  const {
    data: links,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CompanyLink[]>({
    queryKey: ['/api/company-links'],
    select: (data) => data || [],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Activo</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rechazado</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vínculos Empresariales</CardTitle>
          <CardDescription>Lista de vínculos con otras empresas</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vínculos Empresariales</CardTitle>
          <CardDescription>Lista de vínculos con otras empresas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error al cargar los vínculos: {error?.message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vínculos Empresariales</CardTitle>
        <CardDescription>Lista de vínculos con otras empresas</CardDescription>
      </CardHeader>
      <CardContent>
        {links && links.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa Vinculada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">
                    {link.targetCompanyName || link.targetCompanyId}
                  </TableCell>
                  <TableCell>{getStatusBadge(link.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(link.createdAt), { 
                      addSuffix: true,
                      locale: es
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No hay vínculos establecidos todavía.</p>
            <p className="text-sm mt-2">Crea un enlace de invitación y compártelo con otra empresa.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}