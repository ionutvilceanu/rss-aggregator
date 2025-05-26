import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

// Declarăm tipurile globale pentru captureStream și MediaRecorder
declare global {
  interface HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream;
  }
  interface HTMLAudioElement {
    captureStream(): MediaStream;
  }
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// AudioManager – gestionarea stocării audio în IndexedDB
class AudioManager {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'audioStorage';
  private readonly STORE_NAME = 'audioBlobs';
  private readonly DB_VERSION = 1;
  
  async init(): Promise<void> {
    if (this.db) return;
    this.db = await this.initDB();
    console.log('AudioManager initialized successfully');
  }
  
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = (event) => {
        console.error('Error opening IndexedDB:', event);
        reject('Unable to open audio storage database');
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('IndexedDB opened successfully');
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          console.log('Created audio object store');
        }
      };
    });
  }
  
  async saveAudio(id: string, audioBlob: Blob, metadata: any = {}): Promise<string> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const audioData = {
        id,
        blob: audioBlob,
        url: URL.createObjectURL(audioBlob),
        timestamp: Date.now(),
        ...metadata
      };
      const request = store.put(audioData);
      request.onsuccess = () => {
        console.log(`Audio saved with ID: ${id}`);
        resolve(audioData.url);
      };
      request.onerror = (event) => {
        console.error('Error saving audio in IndexedDB:', event);
        reject('Unable to save audio in local database');
      };
    });
  }
  
  async getAudio(id: string): Promise<{ url: string, blob: Blob } | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          console.log(`Audio found for ID: ${id}`);
          resolve({ url: request.result.url, blob: request.result.blob });
        } else {
          console.log(`Audio not found for ID: ${id}`);
          resolve(null);
        }
      };
      request.onerror = (event) => {
        console.error('Error retrieving audio from IndexedDB:', event);
        reject('Unable to retrieve audio from local database');
      };
    });
  }
  
  async generateSilentAudio(duration: number = 5): Promise<Blob> {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = audioContext.sampleRate * duration;
      const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate);
      const offlineContext = new OfflineAudioContext(2, bufferSize, audioContext.sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineContext.destination);
      source.start();
      const renderedBuffer = await offlineContext.startRendering();
      const audioDataArray = this.bufferToWave(renderedBuffer, 0, bufferSize);
      return new Blob([audioDataArray], { type: 'audio/wav' });
    } catch (error) {
      console.error('Error generating silent audio:', error);
      const silentAudio = new Uint8Array([/* minimal silent bytes placeholder */]);
      return new Blob([silentAudio], { type: 'audio/mpeg' });
    }
  }
  
  private bufferToWave(buffer: AudioBuffer, start: number, end: number): Uint8Array {
    const numOfChannels = buffer.numberOfChannels;
    const length = end - start;
    const sampleRate = buffer.sampleRate;
    const dataSize = length * numOfChannels * 2;
    const buffer8 = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer8);
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    const channelData = [];
    for (let channel = 0; channel < numOfChannels; channel++) {
      channelData.push(buffer.getChannelData(channel));
    }
    let offset = 44;
    for (let i = start; i < end; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Uint8Array(buffer8);
  }
  
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
  
const audioManager = new AudioManager();
  
// Funcție utilitară pentru curățarea titlurilor
function cleanTitle(title: string): string {
  return title.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}
  
// Tipul articolului
interface Article {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  source?: string;
  imageUrl?: string;
}
  
// Componenta pentru afișarea unui card de articol
interface ArticleCardProps {
  article: Article;
  isSelected: boolean;
  onClick: () => void;
}
  
const ArticleCard: React.FC<ArticleCardProps> = ({ article, isSelected, onClick }) => {
  const [imageError, setImageError] = useState(false);
  let imgSrc = article.imageUrl || '';
  // Dacă imaginea este URL extern, folosim proxy-ul
  if (imgSrc && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://'))) {
    imgSrc = `/api/proxy-image?url=${encodeURIComponent(imgSrc)}`;
  }
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        margin: '10px 0',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        backgroundColor: isSelected ? '#f0f7ff' : 'white'
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>{cleanTitle(article.title)}</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
          {new Date(article.pubDate).toLocaleDateString('ro-RO')}
        </p>
        {article.source && (
          <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
            Sursa: {article.source}
          </p>
        )}
        {imgSrc && !imageError && (
          <div style={{
            position: 'relative',
            height: '180px',
            marginTop: 'auto',
            overflow: 'hidden',
            borderRadius: '4px'
          }}>
            <img
              src={imgSrc}
              alt={article.title}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              onError={() => setImageError(true)}
            />
          </div>
        )}
        {imageError && (
          <div style={{
            position: 'relative',
            height: '180px',
            marginTop: 'auto',
            backgroundColor: '#eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}>
            <p style={{ fontSize: '14px', color: '#999' }}>Imagine indisponibilă</p>
          </div>
        )}
      </div>
    </div>
  );
};
  
// Adăugăm helper pentru verificarea formatelor media suportate de browser
function getSupportedMimeTypes() {
  const possibleTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/mp4;codecs=h264,aac',
    'video/webm',
    'video/mp4'
  ];
  
  return possibleTypes.filter(type => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch (e) {
      return false;
    }
  });
}
  
// Verificăm dacă browser-ul suportă funcționalitățile necesare
function isBrowserCompatible() {
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const hasCanvasCapture = HTMLCanvasElement.prototype.captureStream !== undefined;
  return { 
    hasMediaRecorder, 
    hasCanvasCapture,
    isFullyCompatible: hasMediaRecorder && hasCanvasCapture
  };
}
  
// Componenta principală pentru generarea reelurilor
export default function GenerateReels() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [reelImage, setReelImage] = useState<string | null>(null);
  const [reelVideo, setReelVideo] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoEffect, setVideoEffect] = useState('fade');
  const [voiceoverChoice, setVoiceoverChoice] = useState<'yes' | 'no' | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processingVoiceover, setProcessingVoiceover] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState('ro-RO');
  const [voiceGender, setVoiceGender] = useState('male');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  
  // Stiluri simple pentru container și header
  const containerStyle = { maxWidth: '1200px', margin: '0 auto', padding: '20px' };
  const headerStyle = { padding: '1rem 0', borderBottom: '1px solid #f0f0f0', marginBottom: '1rem' };
  const navStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' };
  const logoStyle = { fontSize: '1.5rem', fontWeight: 'bold' as const, cursor: 'pointer', color: '#333' };
  const navLinksStyle = { display: 'flex', gap: '1.5rem' };
  const navLinkStyle = { color: '#333', textDecoration: 'none' };
  
  const reelContainerStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9fafb' };
  
  // Adăugăm state pentru a stoca blob-ul video și tipul MIME
  const [reelVideoBlob, setReelVideoBlob] = useState<Blob | null>(null);
  const [reelVideoType, setReelVideoType] = useState<string>('');
  
  // Declarăm mediaRecorder înainte de a-l utiliza, pentru a evita erori de referință
  const mediaRecorder: MediaRecorder | null = null;
  
  // Funcție de logout
  const handleLogout = async () => {
    if (confirm('Ești sigur că vrei să te deloghezi?')) {
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (response.ok) router.push('/login');
      } catch (err) {
        console.error('Eroare la delogare:', err);
      }
    }
  };
  
  // Încarcă articolele de la API
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/fetchRSS?page=1&limit=50');
        const data = await response.json();
        if (data && data.articles) {
          const processedArticles = data.articles.map((article: Article) => {
            if (!article.imageUrl) {
              if (article.source && article.source.includes('digisport')) {
                article.imageUrl = 'https://s.iw.ro/gateway/g/ZmlsZVNvdXJjZT1odHRwJTNBJTJGJTJG/c3RvcmFnZTA3dHJhbnNjb2Rlci5yY3Mt/cmRzLnJvJTJGc3RvcmFnZSUyRjIwMjIl/MkYwNyUyRjA3JTJGMTUxNzE5MV8xNTE3/MTkxX2RpZ2lzcG9ydC1nb2xhLWxvZ28t/Z2VuZXJpYy0xOTIweDEwODAuanBn/Jm1heF93aWR0aD0xMjgw/digisport-gola-logo-generic-1920x1080.jpg';
              } else if (article.source && article.source.includes('gazzetta')) {
                article.imageUrl = 'https://via.placeholder.com/1080x1920/00CCBB/FFFFFF?text=Gazzetta+Sport';
              } else {
                article.imageUrl = 'https://via.placeholder.com/1080x1920/FF4400/FFFFFF?text=Sport+News';
              }
            }
            return article;
          });
          setArticles(processedArticles);
        } else {
          setError('Nu s-au putut încărca articolele');
        }
      } catch (error) {
        console.error('Eroare la încărcarea articolelor:', error);
        setError('Eroare la încărcarea articolelor');
      } finally {
        setLoading(false);
      }
    };
  
    fetchArticles();
  }, []);
  
  // Procesează reelul folosind imaginea ca fundal (pentru video)
  const procesareReelCuImagine = (defaultImg: HTMLImageElement) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) { setError('Canvas indisponibil'); setGenerating(false); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { setError('Context canvas indisponibil'); setGenerating(false); return; }
  
      const width = 1080, height = 1920;
      canvas.width = width;
      canvas.height = height;
  
      // Calculare dimensiuni imagine pentru a acoperi canvas-ul cu păstrarea raportului de aspect
      const imgRatio = defaultImg.width / defaultImg.height;
      const canvasRatio = width / height;
      let renderWidth, renderHeight, offsetX, offsetY;
      if (imgRatio > canvasRatio) {
        renderHeight = height;
        renderWidth = height * imgRatio;
        offsetX = (width - renderWidth) / 2;
        offsetY = 0;
      } else {
        renderWidth = width;
        renderHeight = width / imgRatio;
        offsetX = 0;
        offsetY = (height - renderHeight) / 2;
      }
  
      // Desenăm imaginea pe fundal
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(defaultImg, offsetX, offsetY, renderWidth, renderHeight);
  
      // Efecte vizuale – gradient și overlay de brand
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0.8)');
      gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(0,66,255,0.3)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, 80, width, 10);
      ctx.fillRect(0, height - 150, width, 10);
  
      // Text
      const text = customText || (selectedArticle ? selectedArticle.title : 'AiSport News');
      ctx.font = 'bold 72px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
  
      const wrapText = (text: string, maxWidth: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const lineWidth = ctx.measureText(currentLine + ' ' + word).width;
          if (lineWidth < maxWidth) { currentLine += ' ' + word; }
          else { lines.push(currentLine); currentLine = word; }
        }
        lines.push(currentLine);
        return lines;
      };
  
      const lines = wrapText(text, width - 100);
      const lineHeight = 85;
      let y = (height - lines.length * lineHeight) / 2;
      lines.forEach(line => { ctx.fillText(line, width/2, y); y += lineHeight; });
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.fillText('AiSport', width/2, height - 100);
      if (selectedArticle && selectedArticle.source) {
        ctx.font = '32px Arial, sans-serif';
        ctx.fillText('Sursa: ' + selectedArticle.source, width/2, height - 60);
      }
  
      setReelImage(canvas.toDataURL('image/jpeg', 0.9));
      setGenerating(false);
    } catch (error) {
      console.error('Error processing canvas image:', error);
      setError('Eroare la procesarea imaginii. Încearcă alt articol.');
      setGenerating(false);
    }
  };
  
  // Functie pentru generarea voiceover-ului (apel API definit separat pe server)
  const generateVoiceover = async (text: string, language: string, gender: string): Promise<string> => {
    try {
      console.log(`Generating voiceover for ${text.length} characters`);
      
      // Gestionăm mai bine diacriticele românești pentru a evita problemele de pronunție
      const processedText = text
        .replace(/â/g, 'î')  // Înlocuim â cu î pentru mai bună pronunție
        .replace(/ț/g, 't')  // Simplificăm ț la t pentru evitarea problemelor
        .replace(/ș/g, 'ș')  // Păstrăm ș neschimbat
        .replace(/ă/g, 'a')  // Simplificăm ă la a pentru pronunție mai bună
        .replace(/î/g, 'i'); // Simplificăm î la i pentru pronunție mai bună

      const audioId = uuidv4();
      const audioMgr = new AudioManager();
      await audioMgr.init();
      const savedAudio = await audioMgr.getAudio(audioId);
      if (savedAudio) { setAudioUrl(savedAudio.url); return savedAudio.url; }
  
      const response = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: processedText, language, gender, quality: 'high', format: 'mp3' }),
      });
  
      if (!response.ok) { throw new Error(`Voiceover API error: ${response.status}`); }
  
      const data = await response.json();
      if (!data.audioUrl) { throw new Error('Invalid audio URL received'); }
  
      const generatedUrl = data.audioUrl;
      setAudioUrl(generatedUrl);
  
      return generatedUrl;
    } catch (error: any) {
      console.error('Error generating voiceover:', error);
      throw error;
    }
  };
  
  // Declarăm funcția previewVoiceover fără a utiliza useFullContent
  const previewVoiceover = async () => {
    if (!reelImage) { setError('Generează mai întâi o imagine pentru reel.'); return; }
    setError(null); setProcessingVoiceover(true);
    try {
      // Utilizăm doar titlul sau text personalizat pentru voiceover
      let voiceoverText = '';
      if (customText?.trim()) {
        voiceoverText = customText.trim();
      } else if (selectedArticle) {
        // Folosim doar titlul pentru voiceover
        voiceoverText = cleanTitle(selectedArticle.title);
      }
      
      if (!voiceoverText) { throw new Error('Nu există text valid pentru voiceover.'); }
      console.log(`Voiceover text length: ${voiceoverText.length}`);
      const generatedAudioUrl = await generateVoiceover(voiceoverText, voiceLanguage, voiceGender);
      if (!generatedAudioUrl) { throw new Error('Voiceover generation failed.'); }
      setAudioUrl(generatedAudioUrl);
    } catch (error: any) {
      console.error('Voiceover preview error:', error);
      setError(`Eroare la generarea voiceover: ${error.message || 'Eroare necunoscută'}`);
    } finally {
      setProcessingVoiceover(false);
    }
  };
  
  // Generare video TikTok cu opțional voiceover
  const generateVideoWithOptionalVoiceover = async () => {
    if (!reelImage) { setError('Generează mai întâi o imagine pentru reel.'); return; }
    if (voiceoverChoice === null) { setError('Selectează dacă dorești voiceover.'); return; }
    setError(null); setProcessingVideo(true); setReelVideo(null);
  
    try {
      let audioBlobForVideo: Blob | null = null;
      if (voiceoverChoice === 'yes') {
        setProcessingVoiceover(true);
        try {
          // Utilizăm doar titlul sau text personalizat pentru voiceover, fără conținut
          let voiceoverText = '';
          if (customText?.trim()) {
            voiceoverText = customText.trim();
          } else if (selectedArticle) {
            // Folosim doar titlul articolului pentru voiceover
            voiceoverText = cleanTitle(selectedArticle.title);
          }
          
          if (!voiceoverText) { throw new Error('Nu există text valid pentru voiceover.'); }
          const generatedAudioUrl = await generateVoiceover(voiceoverText, voiceLanguage, voiceGender);
          if (!generatedAudioUrl) { throw new Error('Voiceover generation failed.'); }
  
          if (generatedAudioUrl.startsWith('blob:')) {
            const response = await fetch(generatedAudioUrl);
            audioBlobForVideo = await response.blob();
          } else {
            const fullAudioUrl = generatedAudioUrl.startsWith('/') ? `${window.location.origin}${generatedAudioUrl}` : generatedAudioUrl;
            const response = await fetch(fullAudioUrl);
            audioBlobForVideo = await response.blob();
          }

          console.log(`Audio blob obținut pentru video, dimensiune: ${audioBlobForVideo.size} bytes`);
        } catch (audioError) {
          console.error('Audio generation error for video:', audioError);
          setError(`Eroare doar la generarea voiceover: ${audioError instanceof Error ? audioError.message : 'Eroare necunoscută'}. Continuăm cu generarea video fără audio.`);
          // Continuăm fără audio în loc să aruncăm eroare
        } finally {
          setProcessingVoiceover(false);
        }
      }
  
      // Generare video folosind canvas + audio (dacă este disponibil)
      const canvas = canvasRef.current;
      if (!canvas) { throw new Error('Canvas indisponibil pentru generare video.'); }

      // Facem canvas-ul vizibil și clar în interfață
      canvas.style.display = 'block';
      canvas.style.width = '320px';  // Dimensiune mai mică pe ecran
      canvas.style.height = '640px';
      canvas.style.margin = '20px auto';  // Centrat
      canvas.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';

      const ctx = canvas.getContext('2d');
      if (!ctx) { throw new Error('Contextul canvas nu poate fi obținut.'); }
  
      const width = 1080, height = 1920;
      canvas.width = width; canvas.height = height;
  
      // Verificăm dacă avem o imagine valabilă
      if (!reelImage) {
        throw new Error('Nu avem o imagine validă pentru video');
      }

      // Încărcăm imaginea în canvas pentru video
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          resolve();
        };
        img.onerror = () => {
          reject(new Error('Nu s-a putut încărca imaginea în canvas'));
        };
        img.src = reelImage;
      });

      const imageData = ctx.getImageData(0, 0, width, height);
      console.log('Imagine încărcată în canvas pentru video');

      // Configurare pentru înregistrarea video
      const fps = 30;
      const totalFrames = Math.ceil(fps * videoDuration);
      console.log(`Generăm ${totalFrames} cadre pentru video de ${videoDuration} secunde...`);

      // Creăm un stream din canvas
      let canvasStream: MediaStream;
      try {
        const compatibility = isBrowserCompatible();
        console.log('Compatibilitate browser:', compatibility);
        
        // Verificăm dacă browserul suportă captureStream pentru canvas
        if (!compatibility.hasCanvasCapture) {
          throw new Error('Browser-ul nu suportă captureStream pentru canvas');
        }
        
        if (!compatibility.hasMediaRecorder) {
          throw new Error('Browser-ul nu suportă MediaRecorder API');
        }
        
        // Metoda standard
        canvasStream = canvas.captureStream(fps);
      } catch (err) {
        console.error('Eroare la utilizarea captureStream sau MediaRecorder:', err);
        // Nu putem folosi MediaRecorder, vom folosi o metodă alternativă
        // Vom genera un video folosind o serie de capturi de ecran și le vom converti în format video
        
        setError('Browser-ul nu suportă înregistrarea directă a canvas-ului. Vom folosi o metodă alternativă.');
        
        // Funcția pentru captura și descărcarea cadrelor
        const captureAndGenerateVideo = async () => {
          const frames: string[] = [];
          const totalFrames = Math.ceil(fps * videoDuration);
          const interval = 1000 / fps;
          
          setError('Generăm cadrele video...');
          
          // Generăm toate cadrele
          for (let i = 0; i < totalFrames; i++) {
            const progress = i / (totalFrames - 1);
            
            // Reset la imagine originală
            ctx.putImageData(imageData, 0, 0);
            
            // Aplicăm efecte
            if (videoEffect === 'zoom') {
              const scale = 1 + progress * 0.1;
              ctx.save();
              ctx.translate(width/2, height/2);
              ctx.scale(scale, scale);
              ctx.translate(-width/2, -height/2);
              ctx.drawImage(img, 0, 0, width, height);
              ctx.restore();
            } else if (videoEffect === 'fade') {
              if (progress < 0.2) { 
                ctx.fillStyle = `rgba(0,0,0,${1 - progress*5})`;
                ctx.fillRect(0,0,width,height);
              } else if (progress > 0.8) {
                ctx.fillStyle = `rgba(0,0,0,${(progress - 0.8)*5})`;
                ctx.fillRect(0,0,width,height);
              }
            }
            
            // Capturăm cadrul
            frames.push(canvas.toDataURL('image/jpeg', 0.85));
            
            // Actualizăm starea
            if (i % 10 === 0) {
              setError(`Generare video alternativă: ${Math.round(progress * 100)}% complet...`);
              // Dăm un răgaz thread-ului UI să se actualizeze
              await new Promise(r => setTimeout(r, 0));
            }
          }
          
          setError('Pregătim descărcarea cadrelor video...');
          
          // Pregătim un link pentru descărcare
          const zip = new JSZip();
          const videoFolder = zip.folder('video-frames');
          
          // Adăugăm toate cadrele în arhivă
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const base64Data = frame.replace(/^data:image\/jpeg;base64,/, '');
            videoFolder?.file(`frame-${i.toString().padStart(5, '0')}.jpg`, base64Data, {base64: true});
          }
          
          // Adăugăm și audio dacă există
          if (audioBlobForVideo) {
            const audioBuffer = await audioBlobForVideo.arrayBuffer();
            zip.file('audio.mp3', audioBuffer);
          }
          
          // Adăugăm un fișier README cu instrucțiuni
          zip.file('README.txt', `
          Video generat pentru articolul: "${selectedArticle?.title || 'Custom'}"
          
          INSTRUCȚIUNI:
          1. Acest arhivă conține ${frames.length} cadre video în folderul 'video-frames'
          2. Poți folosi un software precum Adobe Premiere, DaVinci Resolve sau FFmpeg pentru a converti aceste cadre în video
          3. Exemplu de comandă FFmpeg:
             ffmpeg -framerate ${fps} -i video-frames/frame-%05d.jpg -c:v libx264 -pix_fmt yuv420p output.mp4
          
          4. Dacă există un fișier audio.mp3, poți adăuga și audio-ul:
             ffmpeg -framerate ${fps} -i video-frames/frame-%05d.jpg -i audio.mp3 -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest output.mp4
          `);
          
          // Generăm și descărcăm arhiva
          const content = await zip.generateAsync({type: 'blob'});
          const url = URL.createObjectURL(content);
          
          // Salvăm pentru descărcare ulterioară
          setReelVideo(url);
          setReelVideoType('application/zip');
          setReelVideoBlob(content);
          
          // Actualizăm starea
          setError('Video generat cu succes! Arhiva ZIP cu cadrele video și audio este pregătită pentru descărcare.');
          setProcessingVideo(false);
          
          // Ascundem canvas-ul
          canvas.style.display = 'none';
        };
        
        // Pornim procesul alternativ
        captureAndGenerateVideo();
        return; // Ieșim din funcție - nu mai continuăm cu MediaRecorder
      }

      // Verificăm formatele suportate
      const supportedTypes = getSupportedMimeTypes();
      console.log('Formate de media suportate:', supportedTypes);
      
      // Setăm să primim date la fiecare 1 secundă, pentru a evita memoria insuficientă
      const chunks: Blob[] = [];
      
      // Cream mediaRecorder ca variabilă
      let mediaRecorder: MediaRecorder;

      if (supportedTypes.length > 0) {
        mediaRecorder = new MediaRecorder(canvasStream, {
          mimeType: supportedTypes[0],
          videoBitsPerSecond: 2500000
        });
      } else {
        mediaRecorder = new MediaRecorder(canvasStream);
      }
      
      // Configurăm mediaRecorder
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'video/webm';
        const videoBlob = new Blob(chunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        setReelVideo(videoUrl);
        setReelVideoBlob(videoBlob);
        setReelVideoType(mimeType);
        setError(`Video generat cu succes! Format: ${mimeType}, Durată: ${videoDuration} secunde.`);
        setProcessingVideo(false);
        
        canvas.style.display = 'none';
      };

      // Configurăm audio
      if (audioBlobForVideo) {
        try {
          // Creăm un element audio pentru a obține stream-ul
          const audioElement = new Audio();
          const audioUrl = URL.createObjectURL(audioBlobForVideo);
          audioElement.src = audioUrl;
          audioElement.loop = false;
          
          // Configurăm sincronizarea audio-video
          mediaRecorder.onstart = () => {
            console.log('MediaRecorder a început, pornind audio sincronizat');
            audioElement.currentTime = 0;
            audioElement.play().catch(err => {
              console.error('Eroare la redarea audio sincronizat:', err);
            });
          };
          
          // Dacă browser-ul suportă combinarea track-urilor
          if (audioElement.captureStream) {
            const audioStream = audioElement.captureStream();
            
            if (audioStream.getAudioTracks().length > 0) {
              // Combinăm track-urile audio și video
              const combinedTracks = [
                ...canvasStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
              ];
              
              // Creăm un nou stream cu ambele track-uri
              const combinedStream = new MediaStream(combinedTracks);
              
              // Recreăm mediaRecorder cu stream-ul combinat
              if (supportedTypes.length > 0) {
                mediaRecorder = new MediaRecorder(combinedStream, {
                  mimeType: supportedTypes[0],
                  videoBitsPerSecond: 2500000
                });
              } else {
                mediaRecorder = new MediaRecorder(combinedStream);
              }
              
              // Reconfigurăm event handler-ele
              mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                  chunks.push(e.data);
                }
              };
              
              mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'video/webm';
                const videoBlob = new Blob(chunks, { type: mimeType });
                const videoUrl = URL.createObjectURL(videoBlob);
                
                setReelVideo(videoUrl);
                setReelVideoBlob(videoBlob);
                setReelVideoType(mimeType);
                setError(`Video generat cu succes! Format: ${mimeType}, Durată: ${videoDuration} secunde.`);
                setProcessingVideo(false);
                
                canvas.style.display = 'none';
              };
              
              mediaRecorder.onstart = () => {
                console.log('MediaRecorder combinat a început, pornind audio');
                audioElement.currentTime = 0;
                audioElement.play().catch(err => {
                  console.error('Eroare la redarea audio în timpul înregistrării:', err);
                });
              };
            }
          }
        } catch (error) {
          console.error('Eroare la configurarea audio:', error);
        }
      }
      
      // Funcție pentru animarea cadrelor și înregistrarea video
      const animateAndRecord = async () => {
        let frameCount = 0;
        const startTime = performance.now();
        
        // Începem înregistrarea cu timeslice de 1000ms pentru a primi bucăți de date în timpul înregistrării
        mediaRecorder?.start(1000);
        
        // Funcție pentru desenarea unui cadru la un moment dat
        const drawFrame = (timestamp: number) => {
          // Calculăm progresul animației (0-1)
          const progress = Math.min(1, (timestamp - startTime) / (videoDuration * 1000));
          frameCount++;
          
          // Reset la imagine originală
          ctx.putImageData(imageData, 0, 0);
          
          // Aplicăm efecte
          if (videoEffect === 'zoom') {
            const scale = 1 + progress * 0.1;
            ctx.save();
            ctx.translate(width/2, height/2);
            ctx.scale(scale, scale);
            ctx.translate(-width/2, -height/2);
            ctx.drawImage(img, 0, 0, width, height);
            ctx.restore();
          } else if (videoEffect === 'fade') {
            if (progress < 0.2) { 
              ctx.fillStyle = `rgba(0,0,0,${1 - progress*5})`;
              ctx.fillRect(0,0,width,height);
            } else if (progress > 0.8) {
              ctx.fillStyle = `rgba(0,0,0,${(progress - 0.8)*5})`;
              ctx.fillRect(0,0,width,height);
            }
          }
          
          // Putem adăuga text sau alte elemente vizuale
          if (frameCount % 15 === 0) { // Actualizăm UI-ul mai rar pentru performanță
            setError(`Generare video: ${Math.round(progress * 100)}% complet...`);
          }
          
          // Continuăm animația până când am terminat
          if (progress < 1) {
            requestAnimationFrame(drawFrame);
          } else {
            // Oprim înregistrarea când am terminat
            mediaRecorder?.stop();
          }
        };
        
        // Începem animația
        requestAnimationFrame(drawFrame);
      };

      // Pornim procesul de animare și înregistrare
      await animateAndRecord();
    } catch (error: any) {
      console.error('Error generating video:', error);
      setError(`Eroare la generarea video: ${error.message || 'Eroare necunoscută'}`);
      setProcessingVideo(false);
      
      // Restaurăm canvas-ul în caz de eroare
      if (canvasRef.current) {
        canvasRef.current.style.display = 'none';
      }
    }
  };
  
  // Helper: Obține durata audio dintr-un Blob (dacă este posibil)
  const audioElementDuration = async (audioBlob: Blob): Promise<number> => {
    try {
      const audio = new Audio();
      const url = URL.createObjectURL(audioBlob);
      audio.src = url;
      return new Promise<number>(resolve => {
        audio.onloadedmetadata = () => { resolve(Math.max(audio.duration * 1000, 5000)); URL.revokeObjectURL(url); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(5000); };
        setTimeout(() => { resolve(5000); }, 3000);
      });
    } catch (e) { return 5000; }
  };
  
  const handleDownload = () => {
    if (!reelImage) return;
    const a = document.createElement('a');
    a.href = reelImage;
    a.download = `reel-${selectedArticle?.id || 'news'}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const handleVideoDownload = async () => {
    if (!reelVideo) { setError('Nu există videoclip de descărcat.'); return; }
    try {
      const a = document.createElement('a');
      a.href = reelVideo;
      
      // Determinăm extensia corectă în funcție de tipul MIME
      let extension = 'webm';
      if (reelVideoType) {
        if (reelVideoType.includes('mp4')) {
          extension = 'mp4';
        } else if (reelVideoType.includes('zip')) {
          extension = 'zip';
        }
      }
      
      a.download = `reel-video-${selectedArticle?.id || 'custom'}-${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); }, 100);
    } catch (error) {
      console.error('Video download error:', error);
      setError(`Eroare la descărcarea videoclipului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    }
  };
  
  const handleAudioDownload = async () => {
    if (!audioUrl) { setError('Nu există audio de descărcat.'); return; }
    try {
      if (audioUrl.startsWith('blob:')) {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voiceover-${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      } else {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voiceover-${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      }
    } catch (error) {
      console.error('Audio download error:', error);
      setError(`Eroare la descărcarea audio: ${error}`);
    }
  };
  
  // Generare de reel - imagini pentru TikTok
  const generateReel = async () => {
    if (!selectedArticle) {
      setError('Selectează un articol pentru a genera un reel.');
      return;
    }
    
    setError(null);
    setGenerating(true);
    
    try {
      // Obține imaginea principală a articolului
      let imageUrl = selectedArticle.imageUrl;
      
      // Verificăm dacă avem o imagine validă
      if (!imageUrl) {
        console.warn('Nu există imagine pentru articol, folosim o imagine de rezervă');
        // Folosim o imagine de rezervă bazată pe sursă
        if (selectedArticle.source && selectedArticle.source.includes('digisport')) {
          imageUrl = 'https://s.iw.ro/gateway/g/ZmlsZVNvdXJjZT1odHRwJTNBJTJGJTJG/c3RvcmFnZTA3dHJhbnNjb2Rlci5yY3Mt/cmRzLnJvJTJGc3RvcmFnZSUyRjIwMjIl/MkYwNyUyRjA3JTJGMTUxNzE5MV8xNTE3/MTkxX2RpZ2lzcG9ydC1nb2xhLWxvZ28t/Z2VuZXJpYy0xOTIweDEwODAuanBn/Jm1heF93aWR0aD0xMjgw/digisport-gola-logo-generic-1920x1080.jpg';
        } else if (selectedArticle.source && selectedArticle.source.includes('gazzetta')) {
          imageUrl = 'https://via.placeholder.com/1080x1920/00CCBB/FFFFFF?text=Gazzetta+Sport';
        } else {
          imageUrl = 'https://via.placeholder.com/1080x1920/FF4400/FFFFFF?text=Sport+News';
        }
      }
      
      console.log(`Generăm reel cu imaginea: ${imageUrl}`);
      
      // Încărcăm imaginea
      const img = new Image();
      
      img.onload = () => {
        procesareReelCuImagine(img);
      };
      
      img.onerror = () => {
        console.error(`Eroare la încărcarea imaginii: ${imageUrl}`);
        
        // Fallback la un reel simplu cu gradient
        if (canvasRef.current && selectedArticle) {
          procesareReelCuImagine(new Image()); // Folosim o imagine goală pentru gradient
        }
      };
      
      // Încercăm prima dată să încărcăm direct
      img.src = imageUrl;
      
      // Dacă după 3 secunde imaginea nu s-a încărcat, folosim proxy-ul
      setTimeout(() => {
        if (!img.complete || img.naturalHeight === 0) {
          console.warn(`Încărcare lentă/eșuată pentru imaginea originală, încercăm proxy: ${imageUrl}`);
          img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
      }, 3000);
    } catch (error) {
      console.error('Eroare la generarea reelului:', error);
      setError(`Eroare la generarea reelului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setGenerating(false);
    }
  };
  
  // Alias pentru funcția de generare video cu voiceover opțional
  const generateVideo = generateVideoWithOptionalVoiceover;

  return (
    <div>
      <Head>
        <title>Generator Reeluri | AiSport</title>
        <meta name="description" content="Generator de reeluri din știri sportive" />
      </Head>

      <header style={headerStyle}>
        <nav style={navStyle}>
          <div style={logoStyle}>
            <Link href="/admin" style={{ textDecoration: 'none', color: '#333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/logo.svg" alt="AiSport Logo" style={{ height: '30px', width: 'auto' }} />
                <span>Panou Administrare</span>
              </div>
            </Link>
          </div>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>Acasă</Link>
            <Link href="/admin" style={navLinkStyle}>Dashboard</Link>
            <Link href="/admin/create-article" style={navLinkStyle}>Creare articol</Link>
            <Link href="/admin/generate-news" style={navLinkStyle}>Generare știri</Link>
            <button 
              onClick={handleLogout}
              style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px', backgroundColor: '#e53e3e' }}
            >
              Delogare
            </button>
          </div>
        </nav>
      </header>

      <main style={containerStyle}>
        <h1>Generator Reeluri TikTok</h1>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '15px', borderRadius: '4px', marginBottom: '20px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Eroare:</div>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '30px' }}>
          {/* Lista de articole */}
          <div style={{ width: '50%' }}>
            <h2>Selectează un articol</h2>
            {loading ? (
              <p>Se încarcă articolele...</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {articles.length === 0 ? (
                  <div>
                    <p>Nu s-au găsit articole pentru reeluri.</p>
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                      Cauze posibile:
                      <ul>
                        <li>Nu există articole în baza de date</li>
                        <li>Eroare la preluarea datelor</li>
                      </ul>
                    </p>
                  </div>
                ) : (
                  articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      isSelected={selectedArticle?.id === article.id}
                      onClick={() => {
                        setSelectedArticle(article);
                        setCustomText(cleanTitle(article.title));
                        setReelImage(null);
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Secțiunea de generare Reel */}
          <div style={{ width: '50%' }}>
            <h2>Generare Reel</h2>
            {selectedArticle ? (
              <div style={reelContainerStyle}>
                <div>
                  <label htmlFor="customText" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Text Personalizat:
                  </label>
                  <textarea
                    id="customText"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px', resize: 'vertical', marginBottom: '15px' }}
                    placeholder="Introdu textul pentru reel sau lasă gol pentru a folosi titlul articolului"
                  />
                  <button
                    onClick={generateReel}
                    disabled={generating}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#0066ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: generating ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      width: '100%',
                      marginBottom: '20px'
                    }}
                  >
                    {generating ? 'Generare în curs...' : 'Generează Reel'}
                  </button>
                </div>

                {/* Elementul canvas pentru generarea video */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {/* Afișare imagine generată */}
                {reelImage && (
                  <div style={{ textAlign: 'center', marginBottom: '20px', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <img
                      src={reelImage}
                      alt="Previzualizare Reel"
                      style={{ maxWidth: '100%', maxHeight: '500px', marginBottom: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
                    />
                    
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleDownload}
                        style={{ padding: '8px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                      >
                        Descarcă Imagine
                      </button>
                      
                      <button
                        onClick={generateVideo}
                        disabled={processingVideo}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: processingVideo ? 'not-allowed' : 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {processingVideo ? 'Se generează video...' : 'Generează Video TikTok'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Secțiunea de opțiuni pentru voiceover */}
                {reelImage && (
                  <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ marginTop: '0', marginBottom: '15px' }}>Opțiuni Voiceover</h3>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Dorești voiceover pentru video?</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="voiceoverChoice"
                            checked={voiceoverChoice === 'yes'}
                            onChange={() => setVoiceoverChoice('yes')}
                            style={{ marginRight: '8px' }}
                          />
                          Da
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="voiceoverChoice"
                            checked={voiceoverChoice === 'no'}
                            onChange={() => setVoiceoverChoice('no')}
                            style={{ marginRight: '8px' }}
                          />
                          Nu
                        </label>
                      </div>
                    </div>
                    
                    {voiceoverChoice === 'yes' && (
                      <>
                        <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="voiceLanguage" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                            Limba:
                          </label>
                          <select
                            id="voiceLanguage"
                            value={voiceLanguage}
                            onChange={(e) => setVoiceLanguage(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="ro-RO">Română</option>
                            <option value="en-US">Engleză (SUA)</option>
                            <option value="en-GB">Engleză (UK)</option>
                            <option value="es-ES">Spaniolă</option>
                            <option value="fr-FR">Franceză</option>
                            <option value="de-DE">Germană</option>
                            <option value="it-IT">Italiană</option>
                          </select>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="voiceGender" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                            Gen voce:
                          </label>
                          <select
                            id="voiceGender"
                            value={voiceGender}
                            onChange={(e) => setVoiceGender(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="male">Masculin</option>
                            <option value="female">Feminin</option>
                          </select>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="videoDuration" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                            Durata video (secunde): {videoDuration}
                          </label>
                          <input
                            type="range"
                            id="videoDuration"
                            min="3"
                            max="30"
                            step="1"
                            value={videoDuration}
                            onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="videoEffect" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                            Efect video:
                          </label>
                          <select
                            id="videoEffect"
                            value={videoEffect}
                            onChange={(e) => setVideoEffect(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="fade">Fade In/Out</option>
                            <option value="zoom">Zoom lent</option>
                            <option value="none">Fără efect</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                          <button
                            onClick={previewVoiceover}
                            disabled={processingVoiceover}
                            style={{
                              padding: '8px 15px',
                              backgroundColor: '#8b5cf6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processingVoiceover ? 'not-allowed' : 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            {processingVoiceover ? 'Se generează...' : 'Previzualizează Voiceover'}
                          </button>
                        </div>
                      </>
                    )}
                    
                    {/* Afișare audio voiceover generat */}
                    {audioUrl && (
                      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>Voiceover generat:</h4>
                        <audio controls style={{ width: '100%', marginBottom: '10px' }} src={audioUrl} />
                        <button
                          onClick={handleAudioDownload}
                          style={{
                            padding: '8px 15px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Descarcă Audio
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Afișare video generat */}
                {reelVideo && (
                  <div style={{ textAlign: 'center', marginTop: '20px', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <h4>Video TikTok generat:</h4>
                    <video 
                      src={reelVideo} 
                      controls
                      autoPlay
                      loop
                      style={{ maxWidth: '100%', maxHeight: '500px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
                    />
                    
                    <div style={{ marginTop: '15px' }}>
                      <button 
                        onClick={handleVideoDownload}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Descarcă Video
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #ddd' }}>
                <p>Selectează un articol din lista din stânga pentru a genera un reel.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
