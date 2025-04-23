import * as React from "react"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface LocationOption {
  city: string
  place: string
  value: string
}

export interface GroupedLocations {
  [city: string]: LocationOption[]
}

interface CommandComboboxProps {
  options: LocationOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}

export function CommandCombobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar ubicación...",
  emptyMessage = "No se encontraron resultados.",
  className,
}: CommandComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Agrupar opciones por ciudad para mostrarlas organizadas
  const groupedOptions: GroupedLocations = React.useMemo(() => {
    const grouped: GroupedLocations = {}
    
    options.forEach(option => {
      if (!grouped[option.city]) {
        grouped[option.city] = []
      }
      grouped[option.city].push(option)
    })
    
    return grouped
  }, [options])
  
  // Filtrar opciones basadas en texto de búsqueda
  const filteredGroupedOptions: GroupedLocations = React.useMemo(() => {
    if (!searchValue) return groupedOptions
    
    const filtered: GroupedLocations = {}
    const searchLower = searchValue.toLowerCase()
    
    Object.entries(groupedOptions).forEach(([city, locations]) => {
      const matchingLocations = locations.filter(
        loc => 
          loc.city.toLowerCase().includes(searchLower) ||
          loc.place.toLowerCase().includes(searchLower) ||
          loc.value.toLowerCase().includes(searchLower)
      )
      
      if (matchingLocations.length) {
        filtered[city] = matchingLocations
      }
    })
    
    return filtered
  }, [groupedOptions, searchValue])
  
  // Encuentra el texto a mostrar en el botón basado en el valor seleccionado
  const selectedOptionLabel = React.useMemo(() => {
    if (!value) return ""
    
    for (const locations of Object.values(groupedOptions)) {
      const found = locations.find(loc => loc.value === value)
      if (found) {
        return `${found.place}, ${found.city}`
      }
    }
    
    return value // Si no se encuentra, mostrar el valor tal cual
  }, [value, groupedOptions])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between overflow-hidden",
            className
          )}
        >
          <div className="flex items-center truncate">
            {value ? (
              <>
                <MapPin className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                <span className="truncate">{selectedOptionLabel}</span>
              </>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[350px]" align="start">
        <Command>
          <CommandInput 
            placeholder={`Buscar ${placeholder.toLowerCase()}...`} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {Object.entries(filteredGroupedOptions).map(([city, locations]) => (
              <div key={city}>
                <CommandGroup heading={city}>
                  {locations.map((location) => (
                    <CommandItem
                      key={location.value}
                      value={location.value}
                      onSelect={() => {
                        onChange(location.value)
                        setOpen(false)
                        setSearchValue("")
                      }}
                      className="flex items-start py-2 cursor-pointer hover:bg-gray-100 active:bg-gray-200"
                    >
                      <div className="flex items-center w-full">
                        <div className="mr-2 flex h-4 w-4 items-center justify-center">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              value === location.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="font-medium">{location.place}</span>
                          {location.place !== "Todas las paradas" && (
                            <span className="text-xs text-gray-500">{city}</span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}