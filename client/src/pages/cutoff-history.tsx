import React, { useState } from "react";
import DefaultLayout from "@/components/layout/default-layout";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ClockIcon, DollarSignIcon, FileTextIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CutoffHistoryPage: React.FC = () => {
  // Estado para filtrado
  const [period, setPeriod] = useState<string>("all");
  
  // Verificar autenticación
  const { user, loading } = useRequireAuth();

  // Consultar historial de cortes
  const { data: cutoffs, isLoading: isLoadingCutoffs } = useQuery({
    queryKey: ['/api/transactions/cutoff-history'],
    enabled: !!user,
    select: (data) => {
      // El endpoint ya filtra por usuario actual en el backend, pero podemos aplicar filtros adicionales aquí
      console.log('Cortes recibidos:', data);
      return data;
    }
  });

  if (loading) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center h-64">
          <p>Cargando...</p>
        </div>
      </DefaultLayout>
    );
  }

  if (!user) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center h-64">
          <p>Debe iniciar sesión para acceder a esta página</p>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Historial de Cortes</h1>
        
        <div className="mb-6 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los cortes</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="cutoffs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cutoffs">Cortes de caja</TabsTrigger>
            <TabsTrigger value="summary">Resumen financiero</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cutoffs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Cortes</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCutoffs ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : cutoffs && cutoffs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha de Corte</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Efectivo</TableHead>
                        <TableHead>Transferencia</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cutoffs.map((corte) => (
                        <TableRow key={corte.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-gray-500" />
                              {format(new Date(corte.fecha_fin), "PPP", { locale: es })}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <ClockIcon className="h-3 w-3" />
                              {format(new Date(corte.fecha_fin), "p", { locale: es })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(corte.fecha_inicio), "PPP", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-gray-50 font-semibold">
                              ${Number(corte.total_ingresos).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 font-semibold">
                              ${Number(corte.total_efectivo).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 font-semibold">
                              ${Number(corte.total_transferencias).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <FileTextIcon className="h-4 w-4 mr-1" />
                              Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <DollarSignIcon className="h-12 w-12 mx-auto text-gray-300" />
                    <h3 className="mt-2 text-lg font-medium">No hay cortes registrados</h3>
                    <p className="mt-1 text-gray-500">
                      No se encontraron registros de cortes de caja para el período seleccionado.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="summary" className="space-y-4">
            {isLoadingCutoffs ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : cutoffs && cutoffs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recaudado</CardTitle>
                    <DollarSignIcon className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${cutoffs.reduce((sum, corte) => sum + Number(corte.total_ingresos), 0).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <p className="text-xs text-gray-500">
                      {cutoffs.length} cortes en total
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Promedio por Corte</CardTitle>
                    <DollarSignIcon className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${(cutoffs.reduce((sum, corte) => sum + Number(corte.total_ingresos), 0) / cutoffs.length).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <p className="text-xs text-gray-500">
                      Calculado sobre {cutoffs.length} cortes
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mayor Corte</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const mayorCorte = [...cutoffs].sort((a, b) => Number(b.total_ingresos) - Number(a.total_ingresos))[0];
                      return (
                        <>
                          <div className="text-2xl font-bold">
                            ${Number(mayorCorte.total_ingresos).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                          <p className="text-xs text-gray-500">
                            {format(new Date(mayorCorte.fecha_fin), "PP", { locale: es })}
                          </p>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSignIcon className="h-12 w-12 mx-auto text-gray-300" />
                <h3 className="mt-2 text-lg font-medium">No hay datos de resumen disponibles</h3>
                <p className="mt-1 text-gray-500">
                  No se encontraron cortes de caja para generar el resumen financiero.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DefaultLayout>
  );
};

export default CutoffHistoryPage;