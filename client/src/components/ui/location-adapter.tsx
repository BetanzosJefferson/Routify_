import React from "react";
import { LocationSelector, LocationOption } from "@/components/ui/location-selector";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

/**
 * Convierte entre los formatos de LocationOption y ComboboxOption
 * dependiendo del modo seleccionado
 */
export function LocationAdapter({
  options,
  value,
  onChange,
  placeholder,
  mode = "grouped",
  className,
}: {
  options: LocationOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode?: "grouped" | "simple";
  className?: string;
}) {
  // Convertir LocationOption[] a ComboboxOption[] si es necesario
  const comboboxOptions: ComboboxOption[] = React.useMemo(() => {
    return options.map(opt => ({
      value: opt.value,
      label: `${opt.place}, ${opt.city}`
    }));
  }, [options]);

  return mode === "grouped" ? (
    <LocationSelector
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Seleccionar ubicación..."}
      className={className}
    />
  ) : (
    <Combobox
      options={comboboxOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
}