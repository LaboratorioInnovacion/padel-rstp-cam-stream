export interface Stream {
  id: string;
  url: string;
  title?: string;
  isLive?: boolean;
  viewCount?: number;
  thumbnail?: string;
}

export interface RecordingState {
  isRecording: boolean;
  streamId: string | null;
  startTime: Date | null;
  duration: number;
}