import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CouponsList } from "@/components/coupons/coupons-list";
import { CreateCouponModal } from "@/components/coupons/create-coupon-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { userHasPermission } from "@/lib/role-based-permissions";
import { useAuth } from "@/hooks/use-auth";

export default function CouponsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");

  // Comprobar si el usuario puede crear cupones
  const canCreateCoupons = userHasPermission(user?.role, ["dueño", "administrador"]);

  // Obtener la lista de cupones
  const { data: coupons, isLoading, error } = useQuery({
    queryKey: ["/api/coupons"],
    queryFn: async () => {
      const response = await fetch("/api/coupons");
      if (!response.ok) {
        throw new Error("Error al cargar cupones");
      }
      return response.json();
    }
  });

  // Filtrar cupones por búsqueda
  const filteredCoupons = coupons?.filter((coupon: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      coupon.code.toLowerCase().includes(searchLower) ||
      (coupon.description && coupon.description.toLowerCase().includes(searchLower))
    );
  });

  // Filtrar por estado activo/inactivo según la pestaña seleccionada
  const activeCoupons = filteredCoupons?.filter((coupon: any) => coupon.active === true) || [];
  const inactiveCoupons = filteredCoupons?.filter((coupon: any) => coupon.active === false) || [];

  // Manejar errores
  if (error) {
    toast({
      title: "Error",
      description: "No se pudieron cargar los cupones. Por favor, inténtalo de nuevo.",
      variant: "destructive",
    });
  }

  return (
    <>
      <Helmet>
        <title>Cupones | TransRoute</title>
      </Helmet>

      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Cupones Promocionales</h1>
          {canCreateCoupons && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cupón
            </Button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex max-w-lg">
            <Input
              placeholder="Buscar por código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mr-2"
            />
            <Button variant="outline" className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Cupones Activos ({activeCoupons?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Cupones Inactivos ({inactiveCoupons?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activeCoupons.length > 0 ? (
              <CouponsList coupons={activeCoupons} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center text-gray-500 mb-4">
                    <p className="text-lg">No hay cupones activos disponibles.</p>
                    {canCreateCoupons && (
                      <p className="text-sm mt-2">
                        Crea un nuevo cupón para ofrecer descuentos a tus clientes.
                      </p>
                    )}
                  </div>
                  {canCreateCoupons && (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Cupón
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inactive">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : inactiveCoupons.length > 0 ? (
              <CouponsList coupons={inactiveCoupons} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center text-gray-500 mb-4">
                    <p className="text-lg">No hay cupones inactivos.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {showCreateModal && (
        <CreateCouponModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
}