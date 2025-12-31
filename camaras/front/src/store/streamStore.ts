import { create } from 'zustand';
import { Stream, RecordingState } from '../types';

interface StreamState {
  streams: Stream[];
  currentStream: Stream | null;
  loading: boolean;
  error: string | null;
  recordingState: RecordingState;
  setStreams: (streams: Stream[]) => void;
  setCurrentStream: (stream: Stream) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  startRecording: (streamId: string) => void;
  stopRecording: () => void;
  updateRecordingDuration: () => void;
}

export const useStreamStore = create<StreamState>((set, get) => ({
  streams: [],
  currentStream: null,
  loading: false,
  error: null,
  recordingState: {
    isRecording: false,
    streamId: null,
    startTime: null,
    duration: 0,
  },
  setStreams: (streams) => set({ streams }),
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  startRecording: (streamId) => set({ 
    recordingState: {
      isRecording: true,
      streamId,
      startTime: new Date(),
      duration: 0,
    }
  }),
  stopRecording: () => set({ 
    recordingState: {
      isRecording: false,
      streamId: null,
      startTime: null,
      duration: 0,
    }
  }),
  updateRecordingDuration: () => {
    const { recordingState } = get();
    if (recordingState.isRecording && recordingState.startTime) {
      const now = new Date();
      const duration = Math.floor((now.getTime() - recordingState.startTime.getTime()) / 1000);
      set({ recordingState: { ...recordingState, duration } });
    }
  },
}));