import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Un componente de entrada de tiempo que utiliza el input nativo de tipo time,
 * pero permite formatear y manejar la entrada como "HH:MM AM/PM"
 */
export function TimeInput({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  disabled = false,
  className,
}: TimeInputProps) {
  // Convertir entre el formato "HH:MM AM/PM" y el formato "HH:MM" (24h) para el input nativo
  const formatTo24Hour = (timeStr: string): string => {
    if (!timeStr) return '';
    
    // Si el formato ya es 24h (no tiene AM/PM), devolver tal cual
    if (!timeStr.includes(' ')) {
      return timeStr;
    }
    
    // Separar el tiempo del indicador AM/PM
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let hours24 = hours;
    
    // Convertir a formato 24 horas
    if (period === 'PM' && hours < 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }
    
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  const formatTo12Hour = (timeStr: string): string => {
    if (!timeStr) return '';
    
    // Parsear horas y minutos
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Convertir a formato 12 horas
    let hours12 = hours % 12;
    if (hours12 === 0) hours12 = 12;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  };
  
  // State para el valor interno del input en formato 24h
  const [internalValue, setInternalValue] = useState<string>('');
  
  // Inicializar con un valor predeterminado en caso de que no se proporcione uno
  useEffect(() => {
    // Si no hay valor, establecer uno predeterminado (8:00 AM)
    if (!value) {
      setInternalValue('08:00');
      onChange('08:00 AM');
      return;
    }
    
    // Convertir el valor proporcionado a formato 24h para el input nativo
    const value24h = formatTo24Hour(value);
    setInternalValue(value24h);
  }, [value, onChange]);
  
  // Manejar cambios en el input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    
    if (newValue) {
      // Convertir a formato 12h para el valor externo
      const formatted12Hour = formatTo12Hour(newValue);
      onChange(formatted12Hour);
    } else {
      // Si se limpia el campo, establecer un valor predeterminado
      setInternalValue('08:00');
      onChange('08:00 AM');
    }
  };
  
  return (
    <Input
      type="time"
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn("w-full", className)}
    />
  );
}