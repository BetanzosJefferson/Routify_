import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db';
import { locationData } from '@shared/schema';

// Obtén la ruta del directorio actual para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function populateLocationData() {
  try {
    // Leer el archivo JSON
    const filePath = path.join(__dirname, '../attached_assets/estados-municipios (1).json');
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const statesData = JSON.parse(jsonData);

    // Convertir el objeto a un formato adecuado para la base de datos
    const formattedData = Object.entries(statesData).map(([stateName, municipalities]) => {
      // Generar un código único para el estado (primeras 3 letras en mayúsculas)
      const stateCode = stateName.substring(0, 3).toUpperCase();
      
      // Formatear municipios
      const formattedMunicipalities = (municipalities as string[]).map((name, index) => {
        // Generar un código único para el municipio (código del estado + índice con padding)
        const municipalityCode = `${stateCode}${String(index + 1).padStart(3, '0')}`;
        return {
          name,
          code: municipalityCode
        };
      });

      return {
        state: stateName,
        code: stateCode,
        municipalities: formattedMunicipalities
      };
    });

    // Verificar si ya existen datos en la tabla
    const existingData = await db.select().from(locationData);

    if (existingData.length > 0) {
      console.log('La tabla de datos de ubicación ya está poblada. No se agregarán nuevos datos.');
      return;
    }

    // Insertar datos en la base de datos
    const result = await db.insert(locationData).values(formattedData);
    console.log('Datos de ubicación insertados correctamente:', result);
  } catch (error) {
    console.error('Error al poblar los datos de ubicación:', error);
  }
}

// En ES modules, no podemos usar require.main === module
// Simplemente exportamos la función para usarla desde otros archivos

// Ejecución para pruebas (descomentar si es necesario)
/*
populateLocationData()
  .then(() => console.log('Datos cargados exitosamente'))
  .catch((error) => {
    console.error('Error al ejecutar el script:', error);
  });
*/

export { populateLocationData };