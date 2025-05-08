import * as React from "react"
import { cn } from "@/lib/utils"

interface PriceInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: number | string;
  onChange?: (value: number) => void;
}

const PriceInput = React.forwardRef<HTMLInputElement, PriceInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    // Asegurar que el valor sea una cadena válida
    const formatValue = (val: number | string | undefined): string => {
      if (val === undefined || val === null) return "";
      if (val === 0 || val === "0") return "0";
      
      // Convertir NaN a cadena vacía
      if (typeof val === 'number' && isNaN(val)) return "";
      
      // Eliminar caracteres no numéricos pero mantener puntos para decimales
      return val.toString().replace(/[^\d.]/g, '');
    };
    
    // Estado interno para gestionar el valor que se muestra
    const [displayValue, setDisplayValue] = React.useState<string>(formatValue(value));
    
    // Actualizar el estado interno cuando el valor externo cambia
    React.useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value]);
    
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
    };
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      
      // Actualizar el estado interno siempre
      setDisplayValue(newValue);
      
      // Ejecutar el onChange proporcionado por las props, con conversión a número
      if (onChange) {
        const numericValue = parseFloat(newValue) || 0;
        onChange(numericValue);
      }
    };

    return (
      <input
        type="text" // Cambiamos de number a text para mayor control
        inputMode="numeric" // Para mostrar teclado numérico en dispositivos móviles
        pattern="[0-9]*" // Para validación HTML5
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        value={displayValue}
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