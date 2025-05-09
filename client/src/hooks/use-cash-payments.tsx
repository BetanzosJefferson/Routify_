import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// Definición del tipo de pago en efectivo
export interface CashPayment {
  id: number;
  reservationId: number;
  tripId: number;
  passengerName: string;
  origin: string;
  destination: string;
  amount: number;
  paymentDate: string;
  collectedBy: string;
}

export function useCashPayments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [totalCashAmount, setTotalCashAmount] = useState(0);
  
  // Obtener pagos en efectivo 
  const { 
    data: cashPayments = [], 
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["/api/cash-payments"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/cash-payments");
        if (!response.ok) {
          throw new Error("Error al cargar los pagos en efectivo");
        }
        return await response.json() as CashPayment[];
      } catch (error) {
        console.error("Error en cash payments:", error);
        throw error;
      }
    },
  });
  
  // Calcular el total cuando los pagos cambian
  useEffect(() => {
    if (cashPayments && cashPayments.length > 0) {
      const total = cashPayments.reduce((sum, payment) => sum + payment.amount, 0);
      setTotalCashAmount(total);
    } else {
      setTotalCashAmount(0);
    }
  }, [cashPayments]);
  
  // Mutación para limpiar los pagos (hacer corte)
  const clearCashPaymentsMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch("/api/cash-payments/clear", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: totalCashAmount,
            userId: user?.id,
          }),
        });
        
        if (!response.ok) {
          throw new Error("Error al realizar el corte de caja");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error al realizar corte:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-payments"] });
    },
    onError: (error) => {
      toast({
        title: "Error al realizar el corte",
        description: error.message || "No se pudo completar la operación",
        variant: "destructive",
      });
    },
  });
  
  const clearCashPayments = async () => {
    return clearCashPaymentsMutation.mutateAsync();
  };
  
  return {
    cashPayments,
    isLoading,
    isError,
    totalCashAmount,
    clearCashPayments,
    refetch,
  };
}