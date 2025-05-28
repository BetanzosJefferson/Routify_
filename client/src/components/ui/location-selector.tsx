import React, { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface LocationOption {
  city: string
  place: string
  value: string
}

export interface GroupedLocations {
  [city: string]: LocationOption[]
}

interface LocationSelectorProps {
  value?: string
  onChange: (value: string) => void
  options: LocationOption[]
  placeholder: string
  className?: string
  emptyMessage?: string
}

export function LocationSelector({
  value,
  onChange,
  options,
  placeholder,
  className,
  emptyMessage = "No se encontraron opciones"
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Agrupar opciones por ciudad
  const groupedOptions: GroupedLocations = React.useMemo(() => {
    return options.reduce((acc, option) => {
      const city = option.city
      if (!acc[city]) {
        acc[city] = []
      }
      acc[city].push(option)
      return acc
    }, {} as GroupedLocations)
  }, [options])

  // Filtrar opciones basadas en búsqueda
  const filteredGroupedOptions: GroupedLocations = React.useMemo(() => {
    if (!searchValue) return groupedOptions

    const filtered: GroupedLocations = {}
    Object.entries(groupedOptions).forEach(([city, locations]) => {
      const filteredLocations = locations.filter(location =>
        location.place.toLowerCase().includes(searchValue.toLowerCase()) ||
        city.toLowerCase().includes(searchValue.toLowerCase())
      )
      if (filteredLocations.length > 0) {
        filtered[city] = filteredLocations
      }
    })
    return filtered
  }, [groupedOptions, searchValue])

  // Obtener etiqueta de la opción seleccionada
  const selectedOptionLabel = React.useMemo(() => {
    if (!value) return null
    
    for (const locations of Object.values(groupedOptions)) {
      for (const location of locations) {
        if (location.value === value) {
          return `${location.place}, ${location.city}`
        }
      }
    }
    return value
  }, [value, groupedOptions])

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchValue("")
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    setSearchValue("")
  }

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setIsOpen(false)
    setSearchValue("")
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={buttonRef}
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className={cn(
          "w-full justify-between overflow-hidden",
          className
        )}
        onClick={handleToggle}
        type="button"
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
        <ChevronDown className={cn(
          "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
          isOpen && "rotate-180"
        )} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[350px] max-w-[500px] rounded-md border bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder={`Buscar ${placeholder.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {Object.keys(filteredGroupedOptions).length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              Object.entries(filteredGroupedOptions).map(([city, locations]) => (
                <div key={city}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b">
                    {city}
                  </div>
                  {locations.map((location) => (
                    <div
                      key={location.value}
                      className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSelect(location.value)}
                    >
                      <div className="mr-3 flex h-4 w-4 items-center justify-center">
                        <Check
                          className={cn(
                            "h-4 w-4 text-blue-600",
                            value === location.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-medium text-gray-900 leading-relaxed">
                          {location.place}
                        </span>
                        {location.place !== "Todas las paradas" && (
                          <span className="text-xs text-gray-500 mt-0.5">
                            {location.city}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}