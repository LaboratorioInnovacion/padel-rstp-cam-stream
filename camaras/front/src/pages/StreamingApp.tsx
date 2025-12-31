import React, { useEffect, useState } from 'react';
import { useStreamStore } from '../store/streamStore';
import { fetchStreams, startRecording, stopRecording } from '../services/api';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import VideoPlayer from '../components/VideoPlayer';
import RecordingIndicator from '../components/RecordingIndicator';
import { Info, Camera, Users } from 'lucide-react';

const StreamingApp: React.FC = () => {
  const { 
    streams, 
    currentStream, 
    loading, 
    error,
    recordingState,
    setStreams, 
    setCurrentStream, 
    setLoading, 
    setError,
    startRecording: startRecordingState,
    stopRecording: stopRecordingState,
    updateRecordingDuration
  } = useStreamStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const loadStreams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStreams();
      setStreams(data);
      
      if (data.length > 0 && !currentStream) {
        setCurrentStream(data[0]);
      }
    } catch (err) {
      console.error('Error loading streams:', err);
      setError('Failed to load streams. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStreams();
  }, []);

  useEffect(() => {
    let intervalId: number;
    
    if (recordingState.isRecording) {
      intervalId = window.setInterval(() => {
        updateRecordingDuration();
      }, 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [recordingState.isRecording, updateRecordingDuration]);

  const handleToggleRecording = async () => {
    if (!currentStream) return;
    
    try {
      if (recordingState.isRecording) {
        await stopRecording(currentStream.id);
        stopRecordingState();
      } else {
        await startRecording(currentStream.id);
        startRecordingState(currentStream.id);
      }
    } catch (err) {
      console.error('Error toggling recording:', err);
      setError('Failed to toggle recording');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0E0E10] text-white">
      <Header isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 pt-14 overflow-hidden">
        {/* Sidebar */}
        <div className={`
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          w-64 fixed lg:static left-0 top-14 bottom-0 z-40 bg-[#0E0E10] border-r border-gray-800
        `}>
          <Sidebar
            streams={streams}
            currentStream={currentStream}
            loading={loading}
            onSelectStream={setCurrentStream}
            onRefresh={loadStreams}
          />
        </div>
        
        {/* Main content */}
        <div className="flex-1 p-4 lg:pl-4 overflow-y-auto w-full">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-white rounded-lg flex items-start">
              <Info size={20} className="mr-2 flex-shrink-0 text-red-400" />
              <p>{error}</p>
            </div>
          )}
          
          {currentStream ? (
            <div className="h-full flex flex-col max-w-6xl mx-auto">
              <div className="flex-1 rounded-lg overflow-hidden bg-black min-h-[300px]">
                <VideoPlayer 
                  stream={currentStream}
                  isRecording={recordingState.isRecording && recordingState.streamId === currentStream.id}
                  onToggleRecording={handleToggleRecording}
                />
              </div>
              
              <div className="mt-4 bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold mb-2">{currentStream.title}</h2>
                    <div className="flex items-center text-sm text-gray-400 space-x-4">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${currentStream.isLive ? 'bg-red-500' : 'bg-gray-500'} mr-2`}></div>
                        <span>{currentStream.isLive ? 'Live' : 'Offline'}</span>
                      </div>
                      <div className="flex items-center">
                        <Users size={14} className="mr-1" />
                        <span>{currentStream.viewCount.toLocaleString()} viewers</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleToggleRecording}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2
                      ${recordingState.isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}
                      transition-colors
                    `}
                  >
                    <Camera size={16} />
                    <span>{recordingState.isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Camera size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-xl">No stream selected</p>
                <p className="mt-2">Select a stream from the sidebar to start watching</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {recordingState.isRecording && (
        <RecordingIndicator 
          duration={recordingState.duration} 
          streamId={recordingState.streamId}
        />
      )}
    </div>
  );
};

export default StreamingApp;