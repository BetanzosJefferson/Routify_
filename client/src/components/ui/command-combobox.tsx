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
    // Si no hay búsqueda, mostrar todas las opciones
    if (!searchValue) return groupedOptions
    
    const filtered: GroupedLocations = {}
    const searchLower = searchValue.toLowerCase().trim()
    
    // Si la búsqueda está vacía después de limpiarla, mostrar todas las opciones
    if (!searchLower) return groupedOptions
    
    // Dividir la búsqueda en palabras clave individuales para búsqueda más flexible
    const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0)
    
    Object.entries(groupedOptions).forEach(([city, locations]) => {
      // Verificar si algún término de búsqueda coincide con el nombre de la ciudad
      const cityLower = city.toLowerCase()
      const cityMatches = searchTerms.some(term => cityLower.includes(term))
      
      // Filtrar ubicaciones que coinciden con la búsqueda
      const matchingLocations = locations.filter(loc => {
        // Si la ciudad coincide completamente, incluir todas sus ubicaciones
        if (cityMatches) return true
        
        const placeLower = loc.place.toLowerCase()
        const fullTextLower = `${placeLower}, ${cityLower}`.toLowerCase()
        
        // Verificar si TODOS los términos de búsqueda están en el texto completo
        // o si cada término coincide con alguna parte del texto
        return searchTerms.every(term => 
          fullTextLower.includes(term) || 
          placeLower.includes(term) || 
          cityLower.includes(term)
        )
      })
      
      if (matchingLocations.length > 0) {
        filtered[city] = matchingLocations
      }
    })
    
    // Si no hay coincidencias exactas, intentar búsqueda con coincidencias parciales
    if (Object.keys(filtered).length === 0) {
      Object.entries(groupedOptions).forEach(([city, locations]) => {
        const cityWords = city.toLowerCase().split(/\s+/)
        
        // Buscar coincidencias parciales al inicio de palabras
        const matchingLocations = locations.filter(loc => {
          const placeWords = loc.place.toLowerCase().split(/\s+/)
          const allWords = [...cityWords, ...placeWords]
          
          // Verificar si alguna palabra comienza con algún término de búsqueda
          return searchTerms.some(term => 
            allWords.some(word => word.startsWith(term))
          )
        })
        
        if (matchingLocations.length > 0) {
          filtered[city] = matchingLocations
        }
      })
    }
    
    // Si aún no hay coincidencias, buscar coincidencias muy parciales
    if (Object.keys(filtered).length === 0 && searchLower.length >= 2) {
      Object.entries(groupedOptions).forEach(([city, locations]) => {
        // Buscar ubicaciones donde al menos 2 caracteres coincidan en alguna palabra
        const matchingLocations = locations.filter(loc => {
          const fullText = `${loc.place} ${city}`.toLowerCase()
          return searchTerms.some(term => fullText.includes(term.substring(0, 2)))
        })
        
        if (matchingLocations.length > 0) {
          filtered[city] = matchingLocations
        }
      })
    }
    
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
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      // Cuando se abre el popover, limpiar la búsqueda para mostrar todas las opciones
      if (isOpen) {
        setSearchValue("")
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between overflow-hidden cursor-pointer",
            className
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(!open)
            // Limpiar búsqueda al hacer clic para mostrar todas las opciones
            if (!open) {
              setSearchValue("")
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            setOpen(!open)
            if (!open) {
              setSearchValue("")
            }
          }}
        >
          <div className="flex items-center truncate pointer-events-none">
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
            onFocus={() => {
              // Cuando el usuario hace foco en el input, limpiar la búsqueda para mostrar todas las opciones
              if (!searchValue) {
                setSearchValue("")
              }
            }}
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
                      onSelect={(currentValue) => {
                        // Usar setTimeout para evitar conflictos de timing
                        setTimeout(() => {
                          onChange(currentValue)
                          setOpen(false)
                          setSearchValue("")
                        }, 0)
                      }}
                      className="flex py-2 cursor-pointer hover:bg-gray-100 touch-manipulation"
                      onMouseDown={(e) => {
                        // Prevenir el comportamiento por defecto pero permitir que onSelect se ejecute
                        e.preventDefault()
                      }}
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