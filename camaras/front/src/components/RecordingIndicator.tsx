import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface RecordingIndicatorProps {
  duration: number;
  streamId: string | null;
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ duration, streamId }) => {
  const [formattedDuration, setFormattedDuration] = useState('00:00:00');
  
  useEffect(() => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    setFormattedDuration(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  }, [duration]);
  
  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white rounded-lg p-3 flex flex-col items-center z-50 animate-pulse">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-red-600 mr-2 animate-pulse"></div>
        <span className="font-bold">RECORDING</span>
      </div>
      <div className="text-sm mt-1">{formattedDuration}</div>
      <div className="text-xs text-gray-400 mt-1">Camera: {streamId}</div>
    </div>
  );
};

export default RecordingIndicator;