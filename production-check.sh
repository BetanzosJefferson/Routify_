#!/bin/bash

echo "Verificando configuración para producción..."

# Verificar Node.js version
echo "Node.js version:"
node --version

# Verificar npm version
echo "npm version:"
npm --version

# Verificar que los archivos críticos existen
echo "Verificando archivos críticos..."

if [ ! -f ".env" ]; then
    echo "❌ Archivo .env no encontrado"
    echo "Crea un archivo .env con:"
    echo "DATABASE_URL=tu_url_de_supabase"
    echo "NODE_ENV=production"
    echo "SESSION_SECRET=tu_clave_secreta"
    exit 1
fi

if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ ecosystem.config.js no encontrado"
    exit 1
fi

echo "✅ Archivos críticos verificados"

# Verificar dependencies
echo "Verificando dependencias..."
npm ls --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Problemas con dependencias. Ejecutando npm install..."
    npm install
fi

echo "✅ Dependencias verificadas"

# Limpiar caché si existe
echo "Limpiando caché..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf dist 2>/dev/null || true

echo "✅ Verificación completada. Listo para deployment."