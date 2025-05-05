import { useState } from "react";
import { Edit, Trash2, Check, Clock, Percent, DollarSign, Tag, PenTool } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { userHasPermission } from "@/lib/role-based-permissions";
import { EditCouponModal } from "./edit-coupon-modal";
import { DeleteCouponModal } from "./delete-coupon-modal";

interface CouponsListProps {
  coupons: any[];
}

export function CouponsList({ coupons }: CouponsListProps) {
  const { user } = useAuth();
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<any>(null);
  
  // Comprobar si el usuario puede editar/eliminar cupones
  const canManageCoupons = userHasPermission(user?.role, ["dueño", "administrador"]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM, yyyy", { locale: es });
  };

  const getUsagePercentage = (coupon: any) => {
    return Math.min(Math.round((coupon.usesCount / coupon.maxUses) * 100), 100);
  };

  const getExpiryStatus = (dateString: string) => {
    const expiryDate = new Date(dateString);
    const now = new Date();
    
    // Si ya expiró
    if (now > expiryDate) {
      return { 
        color: "destructive", 
        text: "Expirado", 
        icon: <Clock className="h-3 w-3 mr-1" /> 
      };
    }
    
    // Expira pronto (en los próximos 7 días)
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    
    if (expiryDate < oneWeekFromNow) {
      return { 
        color: "warning", 
        text: "Expira pronto", 
        icon: <Clock className="h-3 w-3 mr-1" /> 
      };
    }
    
    // Vigente y no expira pronto
    return { 
      color: "success", 
      text: "Vigente", 
      icon: <Check className="h-3 w-3 mr-1" /> 
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {coupons.map((coupon) => {
        const usagePercentage = getUsagePercentage(coupon);
        const expiryStatus = getExpiryStatus(coupon.expiryDate);
        
        return (
          <Card key={coupon.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className={`h-2 w-full ${coupon.active ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <CardContent className="pt-5">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold">{coupon.code}</h3>
                    <Badge 
                      variant={expiryStatus.color as "default" | "secondary" | "destructive" | "outline" | null | undefined}
                      className="flex items-center"
                    >
                      {expiryStatus.icon} {expiryStatus.text}
                    </Badge>
                  </div>
                  {coupon.description && (
                    <p className="text-sm text-gray-500">{coupon.description}</p>
                  )}
                </div>
                
                {canManageCoupons && (
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCoupon(coupon)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCoupon(coupon)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="mt-4 space-y-3">
                {/* Tipo y valor de descuento */}
                <div className="flex items-center space-x-2">
                  {coupon.discountType === "percentage" ? (
                    <>
                      <Badge variant="secondary" className="flex items-center">
                        <Percent className="h-3 w-3 mr-1" /> Porcentaje
                      </Badge>
                      <span className="text-lg font-semibold">{coupon.discountValue}%</span>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary" className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" /> Monto fijo
                      </Badge>
                      <span className="text-lg font-semibold">${coupon.discountValue.toFixed(2)}</span>
                    </>
                  )}
                </div>
                
                {/* Fechas */}
                <div className="text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Expira: {formatDate(coupon.expiryDate)}</span>
                  </div>
                </div>
                
                {/* Usos */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Usos: {coupon.usesCount} de {coupon.maxUses}</span>
                    <span>{usagePercentage}%</span>
                  </div>
                  <Progress value={usagePercentage} className="h-2" />
                </div>
                
                {/* Monto mínimo si existe */}
                {coupon.minPurchaseAmount > 0 && (
                  <div className="text-sm text-gray-500">
                    <span>Compra mínima: ${coupon.minPurchaseAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Modales para editar y eliminar cupones */}
      {editingCoupon && (
        <EditCouponModal
          open={!!editingCoupon}
          coupon={editingCoupon}
          onClose={() => setEditingCoupon(null)}
        />
      )}
      
      {deletingCoupon && (
        <DeleteCouponModal
          open={!!deletingCoupon}
          coupon={deletingCoupon}
          onClose={() => setDeletingCoupon(null)}
        />
      )}
    </div>
  );
}