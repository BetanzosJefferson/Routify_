import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Eye, Edit, Package, Clock, Check, Search, X, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess, UserRole } from "@/lib/auth";
import { PackageDetailModal } from "./package-detail-modal";

interface PackageListProps {
  onAddPackage: () => void;
  onEditPackage: (packageId: number) => void;
}

export function PackageList({ onAddPackage, onEditPackage }: PackageListProps) {
  const { user } = useAuth();
  
  // Estados del componente
  const [packageToDetail, setPackageToDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  
  // Estados para filtros - inicializar con fecha actual
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    date: new Date().toISOString().split('T')[0], // Fecha actual por defecto
  });
  
  // Determinar si el usuario puede añadir/editar paquetes
  const canCreateEdit = user ? hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER]) : false;
  
  // Consulta de paquetes
  const packagesQuery = useQuery({
    queryKey: ["/api/packages"],
    enabled: !!user,
  });

  // Filtrar paquetes basado en los filtros aplicados
  const filteredPackages = useMemo(() => {
    if (!packagesQuery.data) return [];
    
    return packagesQuery.data.filter((pkg: any) => {
      // Filtro por origen
      if (filters.origin) {
        const origin = pkg.segmentOrigin || pkg.tripOrigin || "";
        if (!origin.toLowerCase().includes(filters.origin.toLowerCase())) {
          return false;
        }
      }
      
      // Filtro por destino
      if (filters.destination) {
        const destination = pkg.segmentDestination || pkg.tripDestination || "";
        if (!destination.toLowerCase().includes(filters.destination.toLowerCase())) {
          return false;
        }
      }
      
      // Filtro por fecha
      if (filters.date && pkg.createdAt) {
        const packageDate = new Date(pkg.createdAt).toISOString().split('T')[0];
        if (packageDate !== filters.date) {
          return false;
        }
      }
      
      return true;
    });
  }, [packagesQuery.data, filters]);

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      date: new Date().toISOString().split('T')[0], // Mantener fecha actual al limpiar
    });
  };

  // Contar filtros activos
  const activeFiltersCount = Object.values(filters).filter(value => value !== "").length;
  
  // Renderizar estado de carga
  if (packagesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Cargando paquetes...</span>
        </CardContent>
      </Card>
    );
  }
  
  // Renderizar estado de error
  if (packagesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error al cargar paquetes</CardTitle>
          <CardDescription>
            Ha ocurrido un error al cargar los paquetes. Por favor, intenta nuevamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Package className="h-16 w-16 text-muted-foreground opacity-50" />
        </CardContent>
      </Card>
    );
  }
  
  // Renderizar cuando no hay paquetes
  if (!packagesQuery.data || packagesQuery.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No hay paquetes registrados</CardTitle>
          <CardDescription>
            Aún no hay paquetes registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Package className="h-16 w-16 text-muted-foreground opacity-50" />
        </CardContent>
        <CardFooter className="flex justify-center">
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar nuevo paquete
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Renderizar cuando no hay paquetes que coincidan con los filtros
  if (filteredPackages.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">
              Paquetes ({packagesQuery.data.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeFiltersCount > 0 ? (
                `${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} aplicado${activeFiltersCount > 1 ? 's' : ''}`
              ) : (
                'Sin filtros aplicados'
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {canCreateEdit && (
              <Button onClick={onAddPackage}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Paquete
              </Button>
            )}
          </div>
        </div>

        {/* Sección de filtros - siempre visible */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center">
                <Search className="mr-2 h-5 w-5" />
                Filtros de búsqueda
              </div>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpiar filtros
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-origin">Origen</Label>
                <Input
                  id="filter-origin"
                  placeholder="Buscar por origen..."
                  value={filters.origin}
                  onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-destination">Destino</Label>
                <Input
                  id="filter-destination"
                  placeholder="Buscar por destino..."
                  value={filters.destination}
                  onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-date">Fecha</Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>No se encontraron paquetes</CardTitle>
            <CardDescription>
              No hay paquetes que coincidan con los filtros aplicados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Search className="h-16 w-16 text-muted-foreground opacity-50" />
          </CardContent>
          <CardFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
            {canCreateEdit && (
              <Button onClick={onAddPackage}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Paquete
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Renderizar la lista de paquetes
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">
            Paquetes ({packagesQuery.data.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredPackages.length} de {packagesQuery.data.length} paquetes
            {activeFiltersCount > 0 ? (
              ` (${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} aplicado${activeFiltersCount > 1 ? 's' : ''})`
            ) : (
              ''
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Paquete
            </Button>
          )}
        </div>
      </div>

      {/* Sección de filtros - siempre visible */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center">
              <Search className="mr-2 h-5 w-5" />
              Filtros de búsqueda
            </div>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-origin-main">Origen</Label>
              <Input
                id="filter-origin-main"
                placeholder="Buscar por origen..."
                value={filters.origin}
                onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-destination-main">Destino</Label>
              <Input
                id="filter-destination-main"
                placeholder="Buscar por destino..."
                value={filters.destination}
                onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-date-main">Fecha</Label>
              <Input
                id="filter-date-main"
                type="date"
                value={filters.date}
                onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de paquetes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Paquetes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Remitente</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Asientos</TableHead>
                <TableHead>Estado Pago</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPackages.map((pkg) => (
                <TableRow 
                  key={pkg.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setPackageToDetail(pkg);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{pkg.id}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={pkg.packageDescription}>
                      {pkg.packageDescription || "Sin descripción"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.senderName} {pkg.senderLastName}
                    <div className="text-xs text-muted-foreground">
                      {pkg.senderPhone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.recipientName} {pkg.recipientLastName}
                    <div className="text-xs text-muted-foreground">
                      {pkg.recipientPhone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.segmentOrigin || pkg.tripOrigin || "No disponible"}
                  </TableCell>
                  <TableCell>
                    {pkg.segmentDestination || pkg.tripDestination || "No disponible"}
                  </TableCell>
                  <TableCell>{formatCurrency(pkg.price)}</TableCell>
                  <TableCell>
                    {pkg.usesSeats ? (
                      <Badge className="bg-orange-500 hover:bg-orange-600">
                        {pkg.seatsQuantity} {pkg.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No usa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="mr-1 h-3 w-3" /> Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPackageToDetail(pkg);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canCreateEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPackage(pkg.id);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de detalles */}
      {packageToDetail && (
        <PackageDetailModal
          package={packageToDetail}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setPackageToDetail(null);
          }}
        />
      )}
    </div>
  );
}