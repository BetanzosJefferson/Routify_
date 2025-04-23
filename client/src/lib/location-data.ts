import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './queryClient';

// Estructura para datos de ubicación en México
export interface LocationData {
  states: LocationState[];
}

export interface LocationState {
  id?: number;
  state?: string;
  name?: string;
  code: string;
  municipalities: Municipality[];
}

export interface Municipality {
  name: string;
  code: string;
}

// Hook para obtener datos de ubicación
export function useLocationData() {
  return useQuery<LocationState[]>({
    queryKey: ['/api/locations'],
    queryFn: async () => {
      const response = await apiRequest<LocationState[]>("GET", '/api/locations');
      return response;
    }
  });
}

// Datos estáticos (fallback para desarrollo)
const staticMexicoStates: LocationState[] = [
  {
    name: "Aguascalientes",
    code: "01",
    municipalities: [
      { name: "Aguascalientes", code: "001" },
      { name: "Asientos", code: "002" },
      { name: "Calvillo", code: "003" },
      { name: "Cosío", code: "004" },
      { name: "Jesús María", code: "005" },
      { name: "Pabellón de Arteaga", code: "006" },
      { name: "Rincón de Romos", code: "007" },
      { name: "San José de Gracia", code: "008" },
      { name: "Tepezalá", code: "009" },
      { name: "El Llano", code: "010" },
      { name: "San Francisco de los Romo", code: "011" }
    ]
  },
  {
    name: "Baja California",
    code: "02",
    municipalities: [
      { name: "Ensenada", code: "001" },
      { name: "Mexicali", code: "002" },
      { name: "Tecate", code: "003" },
      { name: "Tijuana", code: "004" },
      { name: "Playas de Rosarito", code: "005" }
    ]
  },
  {
    name: "Baja California Sur",
    code: "03",
    municipalities: [
      { name: "Comondú", code: "001" },
      { name: "Mulegé", code: "002" },
      { name: "La Paz", code: "003" },
      { name: "Los Cabos", code: "008" },
      { name: "Loreto", code: "009" }
    ]
  },
  {
    name: "Campeche",
    code: "04",
    municipalities: [
      { name: "Calkiní", code: "001" },
      { name: "Campeche", code: "002" },
      { name: "Carmen", code: "003" },
      { name: "Champotón", code: "004" },
      { name: "Hecelchakán", code: "005" },
      { name: "Hopelchén", code: "006" },
      { name: "Palizada", code: "007" },
      { name: "Tenabo", code: "008" },
      { name: "Escárcega", code: "009" },
      { name: "Calakmul", code: "010" },
      { name: "Candelaria", code: "011" }
    ]
  },
  {
    name: "Coahuila de Zaragoza",
    code: "05",
    municipalities: [
      { name: "Saltillo", code: "030" },
      { name: "Torreón", code: "035" },
      { name: "Monclova", code: "018" },
      { name: "Piedras Negras", code: "025" },
      { name: "Acuña", code: "002" }
    ]
  },
  {
    name: "Colima",
    code: "06",
    municipalities: [
      { name: "Colima", code: "002" },
      { name: "Manzanillo", code: "007" },
      { name: "Tecomán", code: "009" },
      { name: "Villa de Álvarez", code: "010" }
    ]
  },
  {
    name: "Chiapas",
    code: "07",
    municipalities: [
      { name: "Tuxtla Gutiérrez", code: "101" },
      { name: "Tapachula", code: "089" },
      { name: "San Cristóbal de las Casas", code: "078" },
      { name: "Comitán de Domínguez", code: "019" }
    ]
  },
  {
    name: "Chihuahua",
    code: "08",
    municipalities: [
      { name: "Chihuahua", code: "019" },
      { name: "Ciudad Juárez", code: "037" },
      { name: "Delicias", code: "021" },
      { name: "Cuauhtémoc", code: "017" },
      { name: "Hidalgo del Parral", code: "032" }
    ]
  },
  {
    name: "Ciudad de México",
    code: "09",
    municipalities: [
      { name: "Álvaro Obregón", code: "010" },
      { name: "Azcapotzalco", code: "002" },
      { name: "Benito Juárez", code: "014" },
      { name: "Coyoacán", code: "003" },
      { name: "Cuajimalpa de Morelos", code: "004" },
      { name: "Cuauhtémoc", code: "015" },
      { name: "Gustavo A. Madero", code: "005" },
      { name: "Iztacalco", code: "006" },
      { name: "Iztapalapa", code: "007" },
      { name: "Magdalena Contreras", code: "008" },
      { name: "Miguel Hidalgo", code: "016" },
      { name: "Milpa Alta", code: "009" },
      { name: "Tlalpan", code: "012" },
      { name: "Tláhuac", code: "011" },
      { name: "Venustiano Carranza", code: "017" },
      { name: "Xochimilco", code: "013" }
    ]
  },
  {
    name: "Durango",
    code: "10",
    municipalities: [
      { name: "Durango", code: "005" },
      { name: "Gómez Palacio", code: "007" },
      { name: "Lerdo", code: "012" }
    ]
  },
  {
    name: "Guanajuato",
    code: "11",
    municipalities: [
      { name: "León", code: "020" },
      { name: "Irapuato", code: "017" },
      { name: "Celaya", code: "007" },
      { name: "Salamanca", code: "027" },
      { name: "Guanajuato", code: "015" }
    ]
  },
  {
    name: "Guerrero",
    code: "12",
    municipalities: [
      { name: "Acapulco de Juárez", code: "001" },
      { name: "Chilpancingo de los Bravo", code: "029" },
      { name: "Iguala de la Independencia", code: "035" },
      { name: "Taxco de Alarcón", code: "055" },
      { name: "Zihuatanejo de Azueta", code: "038" }
    ]
  },
  {
    name: "Hidalgo",
    code: "13",
    municipalities: [
      { name: "Pachuca de Soto", code: "048" },
      { name: "Tulancingo de Bravo", code: "077" },
      { name: "Tizayuca", code: "069" }
    ]
  },
  {
    name: "Jalisco",
    code: "14",
    municipalities: [
      { name: "Guadalajara", code: "039" },
      { name: "Zapopan", code: "120" },
      { name: "Tlaquepaque", code: "098" },
      { name: "Tonalá", code: "101" },
      { name: "Puerto Vallarta", code: "067" }
    ]
  },
  {
    name: "México",
    code: "15",
    municipalities: [
      { name: "Ecatepec de Morelos", code: "033" },
      { name: "Nezahualcóyotl", code: "058" },
      { name: "Toluca", code: "106" },
      { name: "Naucalpan de Juárez", code: "057" },
      { name: "Tlalnepantla de Baz", code: "104" }
    ]
  },
  {
    name: "Michoacán de Ocampo",
    code: "16",
    municipalities: [
      { name: "Morelia", code: "053" },
      { name: "Uruapan", code: "102" },
      { name: "Lázaro Cárdenas", code: "052" },
      { name: "Zamora", code: "108" }
    ]
  },
  {
    name: "Morelos",
    code: "17",
    municipalities: [
      { name: "Cuernavaca", code: "007" },
      { name: "Jiutepec", code: "011" },
      { name: "Cuautla", code: "006" }
    ]
  },
  {
    name: "Nayarit",
    code: "18",
    municipalities: [
      { name: "Tepic", code: "017" },
      { name: "Bahía de Banderas", code: "020" }
    ]
  },
  {
    name: "Nuevo León",
    code: "19",
    municipalities: [
      { name: "Monterrey", code: "039" },
      { name: "Guadalupe", code: "026" },
      { name: "San Nicolás de los Garza", code: "046" },
      { name: "Apodaca", code: "006" },
      { name: "General Escobedo", code: "021" }
    ]
  },
  {
    name: "Oaxaca",
    code: "20",
    municipalities: [
      { name: "Oaxaca de Juárez", code: "067" },
      { name: "San Juan Bautista Tuxtepec", code: "184" },
      { name: "Salina Cruz", code: "079" }
    ]
  },
  {
    name: "Puebla",
    code: "21",
    municipalities: [
      { name: "Puebla", code: "114" },
      { name: "Tehuacán", code: "156" },
      { name: "San Martín Texmelucan", code: "132" }
    ]
  },
  {
    name: "Querétaro",
    code: "22",
    municipalities: [
      { name: "Querétaro", code: "014" },
      { name: "San Juan del Río", code: "016" },
      { name: "Corregidora", code: "006" }
    ]
  },
  {
    name: "Quintana Roo",
    code: "23",
    municipalities: [
      { name: "Benito Juárez (Cancún)", code: "005" },
      { name: "Othón P. Blanco (Chetumal)", code: "004" },
      { name: "Solidaridad (Playa del Carmen)", code: "008" }
    ]
  },
  {
    name: "San Luis Potosí",
    code: "24",
    municipalities: [
      { name: "San Luis Potosí", code: "028" },
      { name: "Soledad de Graciano Sánchez", code: "035" },
      { name: "Ciudad Valles", code: "013" }
    ]
  },
  {
    name: "Sinaloa",
    code: "25",
    municipalities: [
      { name: "Culiacán", code: "006" },
      { name: "Mazatlán", code: "012" },
      { name: "Ahome", code: "001" }
    ]
  },
  {
    name: "Sonora",
    code: "26",
    municipalities: [
      { name: "Hermosillo", code: "030" },
      { name: "Cajeme", code: "018" },
      { name: "Nogales", code: "043" }
    ]
  },
  {
    name: "Tabasco",
    code: "27",
    municipalities: [
      { name: "Centro (Villahermosa)", code: "004" },
      { name: "Cárdenas", code: "002" },
      { name: "Comalcalco", code: "005" }
    ]
  },
  {
    name: "Tamaulipas",
    code: "28",
    municipalities: [
      { name: "Reynosa", code: "032" },
      { name: "Matamoros", code: "022" },
      { name: "Nuevo Laredo", code: "027" },
      { name: "Tampico", code: "038" },
      { name: "Ciudad Victoria", code: "041" }
    ]
  },
  {
    name: "Tlaxcala",
    code: "29",
    municipalities: [
      { name: "Tlaxcala", code: "033" },
      { name: "Apizaco", code: "005" }
    ]
  },
  {
    name: "Veracruz de Ignacio de la Llave",
    code: "30",
    municipalities: [
      { name: "Veracruz", code: "193" },
      { name: "Xalapa", code: "087" },
      { name: "Coatzacoalcos", code: "039" },
      { name: "Córdoba", code: "044" },
      { name: "Poza Rica de Hidalgo", code: "131" }
    ]
  },
  {
    name: "Yucatán",
    code: "31",
    municipalities: [
      { name: "Mérida", code: "050" },
      { name: "Valladolid", code: "102" },
      { name: "Tizimín", code: "096" }
    ]
  },
  {
    name: "Zacatecas",
    code: "32",
    municipalities: [
      { name: "Zacatecas", code: "056" },
      { name: "Fresnillo", code: "010" },
      { name: "Guadalupe", code: "017" }
    ]
  }
];

// Exportamos los datos estáticos para uso de fallback (aunque no es lo ideal)
export const mexicoStates = staticMexicoStates;

// Funciones actualizadas para trabajar con datos de la base de datos
export function getMunicipalitiesByState(stateCode: string, states?: LocationState[]): Municipality[] {
  // Si se proporcionan estados, usar esos; de lo contrario, usar los estáticos
  const statesData = states || staticMexicoStates;
  const state = statesData.find(state => state.code === stateCode);
  return state ? state.municipalities : [];
}

// Función para obtener un estado por su código
export function getStateByCode(stateCode: string, states?: LocationState[]): LocationState | undefined {
  // Si se proporcionan estados, usar esos; de lo contrario, usar los estáticos
  const statesData = states || staticMexicoStates;
  return statesData.find(state => state.code === stateCode);
}

// Función para obtener un municipio por su código dentro de un estado
export function getMunicipalityByCode(stateCode: string, municipalityCode: string, states?: LocationState[]): Municipality | undefined {
  const state = getStateByCode(stateCode, states);
  return state?.municipalities.find(municipality => municipality.code === municipalityCode);
}

// Función para obtener opciones de estados para componentes Select
export function getStateOptions(states?: LocationState[]): { label: string, value: string }[] {
  const statesData = states || staticMexicoStates;
  return statesData.map(state => ({
    label: state.state || state.name || "", // Compatibilidad con ambos formatos
    value: state.code
  }));
}

// Función para obtener opciones de municipios para componentes Select
export function getMunicipalityOptions(stateCode: string, states?: LocationState[]): { label: string, value: string }[] {
  const municipalities = getMunicipalitiesByState(stateCode, states);
  return municipalities.map(municipality => ({
    label: municipality.name,
    value: municipality.code
  }));
}