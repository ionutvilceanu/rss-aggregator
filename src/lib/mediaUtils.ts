// mediaUtils.ts - Utilități pentru manipularea media în browser

/**
 * Combină un stream video și un blob audio într-un singur fișier video
 * @param videoBlob Blob-ul conținând videoclipul
 * @param audioBlob Blob-ul conținând audio
 * @returns Promisiune care se rezolvă cu URL-ul blob-ului combinat
 */
export async function combineVideoAudio(videoBlob: Blob, audioBlob: Blob): Promise<string> {
  try {
    console.log('Încep combinarea video și audio...');
    
    // Creăm un FormData pentru a trimite fișierele la server
    const formData = new FormData();
    formData.append('video', videoBlob, 'video.webm');
    formData.append('audio', audioBlob, 'audio.mp3');
    
    // Verificăm dacă avem endpoint-ul API disponibil
    const hasServerSideProcessing = false; // Setăm la true doar dacă avem API-ul funcțional
    
    if (hasServerSideProcessing) {
      // Trimitem la server pentru procesare
      const response = await fetch('/api/combine-audio-video', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Eroare la procesarea server: ${errorText}`);
      }
      
      // Primim blob-ul rezultat
      const combinedBlob = await response.blob();
      return URL.createObjectURL(combinedBlob);
    } else {
      // Alternativă client-side: folosim MediaRecorder pentru a înregistra ambele stream-uri
      // Creăm elementele media pentru video și audio
      console.log('Folosim metoda client-side pentru combinare...');
      const videoElement = document.createElement('video');
      const audioElement = document.createElement('audio');
      
      // Setăm sursele
      videoElement.src = URL.createObjectURL(videoBlob);
      audioElement.src = URL.createObjectURL(audioBlob);
      
      // Setăm proprietățile
      videoElement.muted = true; // Mutăm video-ul original
      videoElement.loop = false;
      audioElement.loop = false;
      
      // Așteptăm să se încarce media
      await Promise.all([
        new Promise(resolve => { videoElement.onloadedmetadata = resolve; }),
        new Promise(resolve => { audioElement.onloadedmetadata = resolve; })
      ]);
      
      // Sincronizăm duratele
      const duration = Math.min(videoElement.duration, audioElement.duration);
      console.log(`Durată sincronizată: ${duration}s`);
      
      // Creăm un canvas pentru a desena fiecare cadru
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 1080;
      canvas.height = videoElement.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Nu s-a putut obține contextul canvas');
      }
      
      // Creăm un MediaRecorder pentru a înregistra canvas-ul
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Adăugăm și track-ul audio
      try {
        // Încercăm să captăm stream-ul audio
        if (typeof audioElement.captureStream === 'function') {
          const audioStream = audioElement.captureStream();
          audioStream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        }
      } catch (e) {
        console.warn('Nu s-a putut adăuga track-ul audio la stream:', e);
      }
      
      // Determinăm formatul media suportat
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      
      // Creăm recorder-ul
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      
      // Colectăm fragmentele de date
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      // Promisiune care se va rezolva la finalizarea înregistrării
      const recordingPromise = new Promise<string>((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType });
          resolve(URL.createObjectURL(finalBlob));
        };
      });
      
      // Începem înregistrarea
      recorder.start(1000); // Chunk la fiecare secundă
      
      // Pornire video și audio
      videoElement.currentTime = 0;
      audioElement.currentTime = 0;
      
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          audioElement.play().catch(e => console.error('Eroare la redarea audio:', e));
        }).catch(e => console.error('Eroare la redarea video:', e));
      }
      
      // Funcție pentru desenarea cadrelor
      const drawFrame = () => {
        if (videoElement.ended || videoElement.paused || videoElement.currentTime >= duration) {
          // Am terminat de redat video, oprim înregistrarea
          recorder.stop();
          return;
        }
        
        // Desenăm cadrul curent pe canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Solicităm următorul cadru
        requestAnimationFrame(drawFrame);
      };
      
      // Începem bucla de desenare
      drawFrame();
      
      // Așteptăm finalizarea înregistrării
      return await recordingPromise;
    }
  } catch (error) {
    console.error('Eroare la combinarea audio-video:', error);
    throw error;
  }
} 