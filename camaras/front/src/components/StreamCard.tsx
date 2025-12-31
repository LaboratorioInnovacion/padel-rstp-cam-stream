import React from 'react';
import { Stream } from '../types';
import { Users, Video, VideoOff } from 'lucide-react';

interface StreamCardProps {
  stream: Stream;
  isSelected: boolean;
  onClick: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ stream, isSelected, onClick }) => {
  return (
    <div 
      className={`
        relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300 
        transform hover:scale-105 hover:shadow-xl
        ${isSelected ? 'ring-2 ring-purple-500 scale-105' : ''}
      `}
      onClick={onClick}
    >
      <div className="aspect-video bg-gray-900 overflow-hidden relative group">
        <img 
          src={stream.thumbnail} 
          alt={stream.title} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Status indicator */}
        <div className={`
          absolute top-2 left-2 px-2 py-1 rounded-full flex items-center space-x-1
          ${stream.isLive ? 'bg-red-600' : 'bg-gray-600'}
        `}>
          {stream.isLive ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-bold">LIVE</span>
            </>
          ) : (
            <>
              <VideoOff size={12} className="text-white" />
              <span className="text-white text-xs font-bold">OFFLINE</span>
            </>
          )}
        </div>
        
        {/* View count */}
        {stream.isLive && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <Users size={12} className="mr-1" />
            <span>{stream.viewCount.toLocaleString()}</span>
          </div>
        )}
      </div>
      
      <div className="p-3 bg-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-medium truncate">{stream.title}</h3>
            <p className="text-gray-400 text-xs mt-1">{stream.id}</p>
          </div>
          {stream.isLive && (
            <div className="flex items-center text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
              <Video size={14} className="mr-1" />
              <span className="text-xs">Ready</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamCard