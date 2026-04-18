
import { AUDIO_MANIFEST } from '../utils/assets';
import { CARDS, LOCATION_DEFS } from '../constants';
import { audio } from './audio';

/**
 * LEAN ASSET PIPELINE
 * Focused on speed. The previous metric-lock was causing unacceptable lag.
 */
export const preloadAssets = async (onProgress: (progress: number) => void) => {
  let loaded = 0;
  
  const imagesToLoad = [
    ...CARDS.map(c => c.imageUrl),
    ...LOCATION_DEFS.map(l => l.imageUrl),
  ];

  const audioKeys = Object.keys(AUDIO_MANIFEST);
  const totalAssets = imagesToLoad.length + audioKeys.length + 10;

  const updateProgress = (steps = 1) => {
    loaded += steps;
    const percentage = Math.min(100, Math.floor((loaded / totalAssets) * 100));
    onProgress(percentage);
  };

  const mainLoadTask = (async () => {
      // 1. Parallel Image Loading
      const imagePromises = imagesToLoad.map(src => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => { updateProgress(); resolve(); };
          img.onerror = () => { updateProgress(); resolve(); }; 
        });
      });

      // 2. Audio Init
      audio.init();
      updateProgress(audioKeys.length);

      // 3. FONT GATING (Simplified)
      if ('fonts' in document) {
        try {
            await (document as any).fonts.ready;
            updateProgress(10);
        } catch {
            console.warn("Typography calibration bypassed");
        }
      }
      
      document.body.classList.add('fonts-ready');
      await Promise.all([...imagePromises]);
  })();

  try {
      // 5 second safety ceiling for preloading
      await Promise.race([
          mainLoadTask, 
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
      ]);
  } catch {
      document.body.classList.add('fonts-ready');
  }
  
  onProgress(100);
};
