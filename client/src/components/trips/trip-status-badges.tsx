import React from 'react';

interface TripStatusBadgesProps {
  visibility?: string; // 'publicado', 'oculto', 'cancelado'
  tripStatus?: string; // 'aun_no_inicia', 'en_progreso', 'finalizado'
  className?: string;
}

export const TripStatusBadges: React.FC<TripStatusBadgesProps> = ({
  visibility,
  tripStatus,
  className = ''
}) => {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {/* Badge de visibilidad */}
      {visibility && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          visibility === 'publicado' ? 'bg-green-100 text-green-800' :
          visibility === 'oculto' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {visibility === 'publicado' ? 'Publicado' :
           visibility === 'oculto' ? 'Oculto' : 'Cancelado'}
        </span>
      )}
      
      {/* Badge de estado */}
      {tripStatus && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          tripStatus === 'aun_no_inicia' ? 'bg-blue-100 text-blue-800' :
          tripStatus === 'en_progreso' ? 'bg-yellow-100 text-yellow-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {tripStatus === 'aun_no_inicia' ? 'Aún no inicia' :
           tripStatus === 'en_progreso' ? 'En progreso' : 'Finalizado'}
        </span>
      )}
    </div>
  );
};

export default TripStatusBadges;