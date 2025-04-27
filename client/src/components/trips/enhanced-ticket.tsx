/**
 * Enhanced Ticket Component
 * Este componente proporciona funciones mejoradas para imprimir boletos con estilos consistentes
 */

// Función para generar HTML de impresión con estilos mejorados que coinciden con la UI
export function generatePrintableTicket(contentHTML: string): string {
  return `
    <html>
      <head>
        <title>Ticket de Reservación</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .ticket { border: 2px solid #e2e8f0; border-radius: 8px; padding: 24px; max-width: 400px; margin: 0 auto; background-color: white; }
          
          /* Estilos para el encabezado */
          .text-center { text-align: center; }
          .border-b { border-bottom: 1px solid #e2e8f0; }
          .pb-4 { padding-bottom: 16px; }
          .mb-6 { margin-bottom: 24px; }
          .text-2xl { font-size: 24px; }
          .font-bold { font-weight: bold; }
          .text-primary { color: #0066cc; }
          .text-sm { font-size: 14px; }
          .text-gray-600 { color: #4b5563; }
          .mt-1 { margin-top: 4px; }
          
          /* Estilos para el QR */
          .flex { display: flex; }
          .justify-center { justify-content: center; }
          .mb-6 { margin-bottom: 24px; }
          .p-2 { padding: 8px; }
          .bg-white { background-color: white; }
          .border { border: 1px solid #e2e8f0; }
          .border-gray-200 { border-color: #e2e8f0; }
          .rounded { border-radius: 4px; }
          .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
          .w-40 { width: 160px; }
          .h-40 { height: 160px; }
          
          /* Estilos para el código de reservación */
          .mb-5 { margin-bottom: 20px; }
          .bg-gray-50 { background-color: #f9fafb; }
          .p-3 { padding: 12px; }
          .rounded-md { border-radius: 6px; }
          .border-gray-200 { border-color: #e2e8f0; }
          .font-bold { font-weight: bold; }
          .text-sm { font-size: 14px; }
          .text-gray-500 { color: #6b7280; }
          .mb-1 { margin-bottom: 4px; }
          .text-2xl { font-size: 24px; }
          .font-mono { font-family: monospace; }
          .tracking-wider { letter-spacing: 0.05em; }
          
          /* Estilos para los detalles */
          .space-y-2 > * + * { margin-top: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .grid { display: grid; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .col-span-2 { grid-column: span 2 / span 2; }
          .font-semibold { font-weight: 600; }
          .border-t { border-top: 1px solid #e2e8f0; }
          .pt-2 { padding-top: 8px; }
          .mt-2 { margin-top: 8px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .ml-4 { margin-left: 16px; }
          .mt-1 { margin-top: 4px; }
          
          /* Estilos para el pie de página */
          .border-t { border-top: 1px solid #e2e8f0; }
          .pt-4 { padding-top: 16px; }
          .text-xs { font-size: 12px; }
          .text-center { text-align: center; }
          .text-gray-500 { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${contentHTML}
        </div>
        <script>
          // Esperar un poco para que se carguen los estilos y el contenido
          setTimeout(() => {
            try {
              window.print();
              window.onfocus = function() { 
                setTimeout(function() { window.close(); }, 500);
              };
            } catch (e) {
              console.error("Error al imprimir:", e);
            }
          }, 500);
        </script>
      </body>
    </html>
  `;
}

// Función para abrir una ventana de impresión
export function openPrintWindow(contentHTML: string): Window | null {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return null;
    }
    
    printWindow.document.write(generatePrintableTicket(contentHTML));
    printWindow.document.close();
    return printWindow;
  } catch (error) {
    console.error("Error al abrir ventana de impresión:", error);
    return null;
  }
}