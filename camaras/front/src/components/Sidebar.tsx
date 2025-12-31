import React from 'react';
import { Stream } from '../types';
import StreamCard from './StreamCard';
import { Camera, Users, Gamepad2, Heart, RefreshCw, ChevronDown } from 'lucide-react';

interface SidebarProps {
  streams: Stream[];
  currentStream: Stream | null;
  loading: boolean;
  onSelectStream: (stream: Stream) => void;
  onRefresh: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  streams, 
  currentStream, 
  loading, 
  onSelectStream, 
  onRefresh 
}) => {
  return (
    <div className="w-full h-full bg-[#0E0E10] overflow-y-auto flex flex-col">
      {/* Categories */}
      <div className="p-4 space-y-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 text-white">
          <Heart size={20} className="text-purple-500" />
          <span className="font-medium">Following</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white">
          <Camera size={20} />
          <span className="font-medium">Live Channels</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white">
          <Gamepad2 size={20} />
          <span className="font-medium">Categories</span>
        </button>
      </div>

      <div className="px-4 py-2 border-t border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Users size={20} className="text-purple-500" />
            <h2 className="font-bold">Live Channels</h2>
          </div>
          <button 
            onClick={onRefresh}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center items-center text-gray-400 py-8">
              <RefreshCw size={24} className="animate-spin mr-2" />
              <span>Loading streams...</span>
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No streams available
            </div>
          ) : (
            streams.map(stream => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isSelected={currentStream?.id === stream.id}
                onClick={() => onSelectStream(stream)}
              />
            ))
          )}
        </div>
      </div>

      {/* Recommended Channels */}
      <div className="mt-4 px-4 py-2 border-t border-gray-800">
        <button className="w-full flex items-center justify-between text-gray-400 hover:text-white py-2">
          <span className="font-medium">Recommended Channels</span>
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;