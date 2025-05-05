import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeleteCouponModalProps {
  open: boolean;
  coupon: any;
  onClose: () => void;
}

export function DeleteCouponModal({ open, coupon, onClose }: DeleteCouponModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Mutación para eliminar el cupón
  const deleteCouponMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/coupons/${coupon.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Cupón eliminado",
        description: "El cupón ha sido eliminado exitosamente.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar el cupón",
        description: error.message || "Ha ocurrido un error. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      onClose();
    },
  });
  
  const handleDelete = () => {
    deleteCouponMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            {coupon.usesCount > 0 ? (
              <>
                El cupón <strong>{coupon.code}</strong> ha sido utilizado {coupon.usesCount} veces. 
                Si lo eliminas, se desactivará permanentemente y no podrá ser utilizado nuevamente, pero 
                se mantendrá un registro de los usos anteriores.
              </>
            ) : (
              <>
                Esta acción eliminará permanentemente el cupón <strong>{coupon.code}</strong>. 
                Esta acción no se puede deshacer.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCouponMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={deleteCouponMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteCouponMutation.isPending ? "Eliminando..." : "Eliminar Cupón"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}