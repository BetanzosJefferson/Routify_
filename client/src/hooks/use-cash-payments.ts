import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export type CashPayment = {
  id: number;
  reservationId: number;
  tripId: number;
  amount: number;
  paymentMethod: string;
  collectedById: number;
  companyId: string;
  processed: boolean;
  createdAt: string;
  passengerName?: string;
  origin?: string;
  destination?: string;
};

export type CashCut = {
  id: number;
  amount: number;
  userId: number;
  companyId: string;
  createdAt: string;
  paymentsCount: number;
  user?: {
    firstName: string;
    lastName: string;
  };
};

export function useCashPayments() {
  const { toast } = useToast();
  const [showCutModal, setShowCutModal] = useState(false);
  
  // Consulta para obtener pagos en efectivo pendientes (no procesados)
  const { 
    data: pendingPayments = [], 
    isLoading: isLoadingPayments,
    error: paymentsError,
    refetch: refetchPayments
  } = useQuery<CashPayment[]>({
    queryKey: ['/api/cash-payments'],
    staleTime: 30 * 1000 // 30 segundos
  });
  
  // Consulta para obtener historial de cortes de caja
  const {
    data: cashCuts = [],
    isLoading: isLoadingCuts,
    error: cutsError,
    refetch: refetchCuts
  } = useQuery<CashCut[]>({
    queryKey: ['/api/cash-cuts'],
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
  
  // Mutación para realizar un corte de caja
  const makeCashCutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-cuts", {});
      return await res.json();
    },
    onSuccess: (data: CashCut) => {
      toast({
        title: "Corte de caja exitoso",
        description: `Se ha registrado un corte de caja por ${formatCurrency(data.amount)}`,
        variant: "default"
      });
      
      // Invalidar las consultas para recargar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/cash-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cash-cuts'] });
      
      // Cerrar modal
      setShowCutModal(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al realizar corte de caja",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Calcular total pendiente
  const pendingTotal = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  
  return {
    pendingPayments,
    isLoadingPayments,
    paymentsError,
    cashCuts,
    isLoadingCuts,
    cutsError,
    pendingTotal,
    showCutModal,
    setShowCutModal,
    makeCashCut: makeCashCutMutation.mutate,
    isCutting: makeCashCutMutation.isPending,
    refetchPayments,
    refetchCuts
  };
}