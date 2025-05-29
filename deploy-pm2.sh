#!/bin/bash

echo "🚀 Preparando proyecto para deployment en PM2..."

# 1. Limpiar PM2 completamente
echo "🧹 Limpiando PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# 2. Hacer build del proyecto
echo "🔨 Ejecutando build..."
npm run build

# 3. Corregir import.meta.dirname en todos los archivos compilados
echo "🔧 Corrigiendo import.meta.dirname para compatibilidad con Node.js..."

# Buscar y reemplazar en el archivo principal
if [ -f "dist/index.js" ]; then
    sed -i 's/import\.meta\.dirname/process.cwd()/g' dist/index.js
    echo "✅ Corregido dist/index.js"
fi

# Verificar si existen otros archivos JS en dist y corregirlos
find dist -name "*.js" -type f | while read file; do
    if grep -q "import\.meta\.dirname" "$file"; then
        sed -i 's/import\.meta\.dirname/process.cwd()/g' "$file"
        echo "✅ Corregido $file"
    fi
done

# 4. Verificar que el archivo .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Advertencia: Archivo .env no encontrado. Asegúrate de crear uno con:"
    echo "   DATABASE_URL=tu_url_de_supabase"
    echo "   NODE_ENV=production"
    echo "   SESSION_SECRET=tu_clave_secreta"
    exit 1
fi

# 5. Verificar que la carpeta dist/public existe (archivos estáticos del frontend)
if [ ! -d "dist/public" ]; then
    echo "❌ Error: No se encontró dist/public. El build del frontend falló."
    exit 1
fi

echo "✅ Verificaciones completadas"

# 6. Iniciar la aplicación con PM2
echo "🚀 Iniciando aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# 7. Mostrar estado
echo "📊 Estado de la aplicación:"
pm2 status

echo "🎉 ¡Deployment completado!"
echo "📝 Para ver los logs: pm2 logs transroute"
echo "🔄 Para reiniciar: pm2 restart transroute"
echo "⏹️  Para detener: pm2 stop transroute"