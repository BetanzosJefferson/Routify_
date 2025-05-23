import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  X,
  AlertTriangle,
  Check
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  onSuccess?: () => void;
}

export function AddExpenseModal({ isOpen, onClose, tripId, onSuccess }: AddExpenseModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Estados para los campos del formulario
  const [amount, setAmount] = useState<string>("0");
  const [category, setCategory] = useState<string>("gasolina");
  const [description, setDescription] = useState<string>("");
  
  // Estado para manejar el loading durante la creación
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Función para validar el formulario
  const isFormValid = () => {
    return (
      parseFloat(amount) > 0 &&
      category.trim() !== ""
      // La descripción ahora es opcional
    );
  };
  
  // Mutation para crear un gasto
  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear el gasto');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar consultas para refrescar datos
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/budget`] });
      
      // Mostrar toast de éxito
      toast({
        title: "Gasto registrado correctamente",
        description: "El gasto ha sido añadido al viaje",
        variant: "default",
      });
      
      // Resetear el formulario
      setAmount("0");
      setCategory("gasolina");
      setDescription("");
      setIsSubmitting(false);
      
      // Cerrar el modal
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      console.error("Error al crear gasto:", error);
      toast({
        title: "Error al registrar el gasto",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Función para enviar el formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast({
        title: "Formulario incompleto",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Convertir el ID de usuario a número para asegurar compatibilidad con la base de datos
    const userId = user?.id ? Number(user.id) : undefined;
    
    const expenseData = {
      amount: parseFloat(amount),
      type: category,
      description,
      userId: userId,
      createdBy: user ? `${user.firstName} ${user.lastName || ""}` : "Usuario no identificado",
    };
    
    console.log("Enviando datos de gasto con usuario:", expenseData);
    
    createExpenseMutation.mutate(expenseData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Registrar Gasto
          </DialogTitle>
          <DialogDescription>
            Añade un nuevo gasto asociado a este viaje
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto del gasto</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                className="pl-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasolina">Gasolina</SelectItem>
                <SelectItem value="peaje">Peaje</SelectItem>
                <SelectItem value="alimentos">Alimentos</SelectItem>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">
              Descripción <span className="text-xs text-gray-500">(opcional)</span>
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el gasto..."
            />
          </div>
          
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar Gasto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}