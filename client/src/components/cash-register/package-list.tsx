import { useState, useEffect } from "react";
import { Package, User, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
// Componentes eliminados: Card, CardContent, CardHeader, CardTitle, CardDescription

interface PackageListProps {
  packages: any[];
  routeInfoMap: Record<number, string>;
  isLoading: boolean;
  sortDirection: 'asc' | 'desc';
  userName: string;
}

export function PackageList({ packages, routeInfoMap, isLoading, sortDirection, userName }: PackageListProps) {
  // Ordenar las paqueterías por fecha
  const sortedPackages = [...packages].sort((a, b) => {
    const dateA = new Date(a.paymentDate || a.createdAt);
    const dateB = new Date(b.paymentDate || b.createdAt);
    return sortDirection === 'desc' 
      ? dateB.getTime() - dateA.getTime() 
      : dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-md font-semibold leading-none tracking-tight">Paqueterías registradas</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Mostrando {sortedPackages.length} paqueterías registradas por {userName}
        </p>
      </div>
      
      <div className="p-6 pt-0">
        {sortedPackages.length === 0 ? (
          <div className="text-center p-10 bg-gray-50 rounded-lg">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-600">No hay paqueterías registradas</h3>
            <p className="text-gray-500 mt-1">
              No se encontraron paqueterías marcadas como pagadas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Lista de paqueterías registradas
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Remitente</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPackages.map((pkg) => (
                  <TableRow key={`pkg-${pkg.id}`}>
                    <TableCell className="font-medium">PKG{pkg.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span>{pkg.senderName} {pkg.senderLastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span>{pkg.recipientName} {pkg.recipientLastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pkg.packageDescription}
                    </TableCell>
                    <TableCell>
                      {routeInfoMap[pkg.tripId] || 'Ruta no disponible'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.paymentMethod === 'efectivo' ? 'default' : 'outline'}>
                        {pkg.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(pkg.price || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}