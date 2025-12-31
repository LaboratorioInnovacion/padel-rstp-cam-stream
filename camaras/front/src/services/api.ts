//api.ts
import axios from 'axios';
import { Stream } from '../types';

// Fallback en caso de error en la API
const MOCK_STREAMS: Stream[] = [
  {
    id: "cam1",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    title: "Main Studio Camera",
    isLive: true,
    viewCount: 156,
    thumbnail: "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg",
  },
  {
    id: "cam2",
    url: "https://test-streams.mux.dev/test_001/stream.m3u8",
    title: "Interview Room",
    isLive: true,
    viewCount: 89,
    thumbnail: "https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg",
  },
  {
    id: "cam3",
    url: "https://test-streams.mux.dev/x36xhzz/url_8/193039199_mp4_h264_aac_hq_7.m3u8",
    title: "Outdoor Events",
    isLive: false,
    viewCount: 0,
    thumbnail: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg",
  }
];

// URL base del backend (cámbiala en producción si hace falta)
const API_BASE = import.meta.env.VITE_API_BASE_URL 
// || 'http://localhost:3000';

export const fetchStreams = async (): Promise<Stream[]> => {
  console.log('🔄 Fetching streams from API:', `${API_BASE}/api/streams`);
  try {
    const response = await axios.get(`${API_BASE}/api/streams`);
    return response.data.map((stream: any) => ({
      id: stream.id,
      url: `${API_BASE}${stream.url}`,
      title: `Stream from ${stream.id}`,
      isLive: true,
      viewCount: Math.floor(Math.random() * 200) + 1,
      thumbnail: `https://picsum.photos/seed/${stream.id}/640/360`,
    }));
  } catch (error) {
    console.error('❌ Error fetching streams, fallback to mock:', error);
    return MOCK_STREAMS;
  }
};

export const startRecording = async (streamId: string): Promise<void> => {
  // Aquí puedes llamar al backend si tienes endpoints para grabar manualmente
  console.log(`📽️ Start recording ${streamId}`);
};

export const stopRecording = async (streamId: string): Promise<void> => {
  // Aquí puedes llamar al backend si tienes endpoints para parar grabación
  console.log(`⏹️ Stop recording ${streamId}`);
};

// import axios from 'axios';
// import { Stream } from '../types';

// // Fallback en caso de error en la API
// const MOCK_STREAMS: Stream[] = [
//   {
//     id: "cam1",
//     url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
//     title: "Main Studio Camera",
//     isLive: true,
//     viewCount: 156,
//     thumbnail: "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg",
//   },
//   {
//     id: "cam2",
//     url: "https://test-streams.mux.dev/test_001/stream.m3u8",
//     title: "Interview Room",
//     isLive: true,
//     viewCount: 89,
//     thumbnail: "https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg",
//   },
//   {
//     id: "cam3",
//     url: "https://test-streams.mux.dev/x36xhzz/url_8/193039199_mp4_h264_aac_hq_7.m3u8",
//     title: "Outdoor Events",
//     isLive: false,
//     viewCount: 0,
//     thumbnail: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg",
//   }
// ];

// // URL base del backend (cámbiala en producción si hace falta)
// const API_BASE = import.meta.env.VITE_API_BASE_URL 
// // || 'http://localhost:3000';

// export const fetchStreams = async (): Promise<Stream[]> => {
//   console.log('🔄 Fetching streams from API:', `${API_BASE}/api/streams`);
//   try {
//     const response = await axios.get(`${API_BASE}/api/streams`);
//     return response.data.map((stream: any) => ({
//       id: stream.id,
//       url: `${API_BASE}${stream.url}`,
//       title: `Stream from ${stream.id}`,
//       isLive: true,
//       viewCount: Math.floor(Math.random() * 200) + 1,
//       thumbnail: `https://picsum.photos/seed/${stream.id}/640/360`,
//     }));
//   } catch (error) {
//     console.error('❌ Error fetching streams, fallback to mock:', error);
//     return MOCK_STREAMS;
//   }
// };

// export const startRecording = async (streamId: string): Promise<void> => {
//   // Aquí puedes llamar al backend si tienes endpoints para grabar manualmente
//   console.log(`📽️ Start recording ${streamId}`);
// };

// export const stopRecording = async (streamId: string): Promise<void> => {
//   // Aquí puedes llamar al backend si tienes endpoints para parar grabación
//   console.log(`⏹️ Stop recording ${streamId}`);
// };

// import axios from 'axios';
// import { Stream } from '../types';

// const MOCK_STREAMS: Stream[] = [
//   {
//     id: "cam1",
//     url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
//     title: "Main Studio Camera",
//     isLive: true,
//     viewCount: 156,
//     thumbnail: "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg",
//   },
//   {
//     id: "cam2",
//     url: "https://test-streams.mux.dev/test_001/stream.m3u8",
//     title: "Interview Room",
//     isLive: true,
//     viewCount: 89,
//     thumbnail: "https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg",
//   },
//   {
//     id: "cam3",
//     url: "https://test-streams.mux.dev/x36xhzz/url_8/193039199_mp4_h264_aac_hq_7.m3u8",
//     title: "Outdoor Events",
//     isLive: false,
//     viewCount: 0,
//     thumbnail: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg",
//   }
// ];

// export const fetchStreams = async (): Promise<Stream[]> => {
//   // Simulating API delay
//   await new Promise(resolve => setTimeout(resolve, 800));
//   try {
//     // Siempre usa la API real
//     const response = await axios.get('http://localhost:3000/api/streams');
//     return response.data.map((stream: any) => ({
//       ...stream,
//       url: `http://localhost:3000${stream.url}`,
//       isLive: true,
//       viewCount: Math.floor(Math.random() * 100) + 1,
//       title: `Stream from ${stream.id}`,
//       thumbnail: `https://picsum.photos/seed/${stream.id}/640/360`,
//     }));
//   } catch (error) {
//     console.error('Error fetching streams:', error);
//     // Fallback a mock data si la API falla
//     return MOCK_STREAMS;
//   }
// };

// export const startRecording = async (streamId: string): Promise<void> => {
//   await new Promise(resolve => setTimeout(resolve, 500));
//   console.log(`Started recording stream ${streamId}`);
//   return Promise.resolve();
// };

// export const stopRecording = async (streamId: string): Promise<void> => {
//   await new Promise(resolve => setTimeout(resolve, 500));
//   console.log(`Stopped recording stream ${streamId}`);
//   return Promise.resolve();
// };


// import axios from 'axios';
// import { Stream } from '../types';

// const MOCK_STREAMS: Stream[] = [
//   {
//     id: "cam1",
//     url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
//     title: "Main Studio Camera",
//     isLive: true,
//     viewCount: 156,
//     thumbnail: "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg",
//   },
//   {
//     id: "cam2",
//     url: "https://test-streams.mux.dev/test_001/stream.m3u8",
//     title: "Interview Room",
//     isLive: true,
//     viewCount: 89,
//     thumbnail: "https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg",
//   },
//   {
//     id: "cam3",
//     url: "https://test-streams.mux.dev/x36xhzz/url_8/193039199_mp4_h264_aac_hq_7.m3u8",
//     title: "Outdoor Events",
//     isLive: false,
//     viewCount: 0,
//     thumbnail: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg",
//   }
// ];

// export const fetchStreams = async (): Promise<Stream[]> => {
//   // Simulating API delay
//   await new Promise(resolve => setTimeout(resolve, 800));
  
//   try {
//     // In development, return mock data
//     if (process.env.NODE_ENV === 'development') {
//       return MOCK_STREAMS;
//     }
    
//     // In production, use real API
//     const response = await axios.get('http://localhost:3000/api/streams');
//     return response.data.map((stream: any) => ({
//       ...stream,
//       url: `http://localhost:3000${stream.url}`,
//       isLive: true,
//       viewCount: Math.floor(Math.random() * 100) + 1,
//       title: `Stream from ${stream.id}`,
//       thumbnail: `https://picsum.photos/seed/${stream.id}/640/360`,
//     }));
//   } catch (error) {
//     console.error('Error fetching streams:', error);
//     // Fallback to mock data if API fails
//     return MOCK_STREAMS;
//   }
// };

// export const startRecording = async (streamId: string): Promise<void> => {
//   await new Promise(resolve => setTimeout(resolve, 500));
//   console.log(`Started recording stream ${streamId}`);
//   return Promise.resolve();
// };

// export const stopRecording = async (streamId: string): Promise<void> => {
//   await new Promise(resolve => setTimeout(resolve, 500));
//   console.log(`Stopped recording stream ${streamId}`);
//   return Promise.resolve();
// };