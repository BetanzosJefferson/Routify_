import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseModal } from "./add-expense-modal";

interface ExpenseButtonProps {
  tripId: number;
}

export function ExpenseButton({ tripId }: ExpenseButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  // Manejar actualización después de agregar un gasto
  const handleExpenseAdded = () => {
    // Refrescar datos relevantes
    queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/budget`] });
    queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses`] });
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
        onClick={() => setShowModal(true)}
      >
        <DollarSign className="h-3.5 w-3.5 mr-1" />
        Agregar gasto
      </Button>

      {showModal && (
        <AddExpenseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          tripId={tripId}
          onSuccess={handleExpenseAdded}
        />
      )}
    </>
  );
}