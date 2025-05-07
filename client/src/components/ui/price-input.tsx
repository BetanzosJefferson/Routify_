import * as React from "react"
import { cn } from "@/lib/utils"

const PriceInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    // Crear una referencia interna al input si no se proporciona una
    const internalRef = React.useRef<HTMLInputElement>(null);
    const resolvedRef = ref || internalRef;
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permitir sólo números, backspace, delete, tab, enter, arrows
      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      
      // Si no es un número o una tecla permitida, bloquear la entrada
      if (!/^\d$/.test(e.key) && !allowedKeys.includes(e.key)) {
        e.preventDefault();
      }
      
      // Permitir el signo de menos solo al principio y solo una vez
      if (e.key === '-' && e.currentTarget.selectionStart === 0 && !e.currentTarget.value.includes('-')) {
        return;
      }
    };
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      // Ejecutar el onChange proporcionado por las props, si existe
      if (props.onChange) {
        // Convertir el valor a número y luego de vuelta a string para eliminar ceros a la izquierda
        let value = event.target.value;
        
        // Si value no está vacío y no es sólo un guión, normalizarlo
        if (value !== '' && value !== '-') {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            // Solo reemplazar si es un número válido
            event.target.value = numValue.toString();
          }
        }
        
        // Llamar al onChange original con el evento posiblemente modificado
        props.onChange(event);
      }
    };

    return (
      <input
        type="number"
        min="0"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={resolvedRef}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

PriceInput.displayName = "PriceInput";

export { PriceInput };