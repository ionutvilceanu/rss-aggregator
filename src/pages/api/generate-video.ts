import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { exec, ExecException } from 'child_process';
import formidable from 'formidable';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { getAudioDurationInSeconds } from 'get-audio-duration';
// Importăm ffmpeg-static pentru a obține calea către executabilul ffmpeg instalat prin pachetul ffmpeg-static
import ffmpegStatic from 'ffmpeg-static';
import { IncomingForm } from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Funcția pentru descărcarea fișierelor (imagini sau audio) de la un URL cu fallback la fișiere locale
const downloadFile = async (url: string, outputPath: string, isAudio: boolean = false): Promise<string> => {
  try {
    console.log(`Descărcare fișier de la URL: ${url}`);
    
    // Verificăm dacă URL-ul este relativ (începe cu /) și îl convertim la URL absolut
    const isRelativeUrl = url.startsWith('/');
    const actualUrl = isRelativeUrl ? `${process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`}${url}` : url;
    
    console.log(`URL procesat pentru descărcare: ${actualUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: actualUrl,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Eroare la descărcarea ${isAudio ? 'audio' : 'imaginii'}:`, error);
    
    if (isAudio) {
      // Pentru fișiere audio, doar raportăm eroarea
      throw error;
    }
    
    // Pentru imagini, implementăm fallback cu imagini locale
    console.log('Folosim o imagine locală ca fallback...');
    
    // Determinăm ce tip de imagine să folosim bazat pe URL (de ex. dacă URL-ul conține "fotbal", folosim imaginea de fotbal)
    let sportType = 'default_sport';
    
    // Căile către imaginile locale
    const localImagePath = path.join(process.cwd(), 'public', 'images', 'sport', `${sportType}.jpg`);
    const defaultImagePath = path.join(process.cwd(), 'public', 'images', 'sport', 'default_sport.jpg');
    
    // Verificăm dacă imaginea specifică sportului există
    if (fs.existsSync(localImagePath)) {
      console.log(`Folosim imaginea locală pentru ${sportType}: ${localImagePath}`);
      fs.copyFileSync(localImagePath, outputPath);
      return outputPath;
    }
    // Altfel folosim imaginea default
    else if (fs.existsSync(defaultImagePath)) {
      console.log(`Folosim imaginea default: ${defaultImagePath}`);
      fs.copyFileSync(defaultImagePath, outputPath);
      return outputPath;
    }
    
    throw new Error('Nu s-a putut găsi nicio imagine locală de rezervă');
  }
};

// Funcția getAudioDuration îmbunătățită cu mai mult logging
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    console.log(`Verificare durată audio pentru fișierul: ${audioPath}`);
    
    // Verificăm mai întâi dacă fișierul există
    if (!fs.existsSync(audioPath)) {
      console.error(`Fișierul audio nu există la calea: ${audioPath}`);
      return 0; // Returnăm 0 ca durată implicită
    }
    
    const fileStats = fs.statSync(audioPath);
    console.log(`Dimensiune fișier audio: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      console.error(`Fișierul audio este gol (0 bytes): ${audioPath}`);
      return 0;
    }
    
    const ffmpegPath = ffmpegStatic || 'ffmpeg';
    return new Promise((resolve, reject) => {
      const ffmpegCommand = `"${ffmpegPath}" -i "${audioPath}" 2>&1 | findstr "Duration"`;
      console.log(`Comanda pentru obținerea duratei: ${ffmpegCommand}`);
      
      exec(ffmpegCommand, (error: unknown, stdout: string) => {
        if (error || !stdout) {
          console.error(`Eroare la obținerea duratei audio:`, error instanceof Error ? error.message : String(error));
          console.log(`Încercăm o comandă alternativă pentru a verifica fișierul audio`);
          
          // Încercăm o comandă alternativă pentru a vedea formatul fișierului
          exec(`"${ffmpegPath}" -i "${audioPath}" 2>&1`, (err: unknown, output: string) => {
            console.log(`Informații fișier audio:\n${output}`);
            // Returnăm o durată implicită
            resolve(5);
          });
          return;
        }
        
        console.log(`Output FFmpeg pentru durată: ${stdout}`);
        const match = stdout.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseFloat(match[3]);
          const duration = hours * 3600 + minutes * 60 + seconds;
          console.log(`Durată audio detectată: ${duration} secunde`);
          resolve(duration);
        } else {
          console.error(`Nu s-a putut extrage durata din output-ul FFmpeg: ${stdout}`);
          resolve(5); // Returnăm o durată implicită
        }
      });
    });
  } catch (error: unknown) {
    console.error(`Excepție la obținerea duratei audio:`, error instanceof Error ? error.message : String(error));
    return 5; // Returnăm o durată implicită în caz de eroare
  }
}

// Funcție îmbunătățită pentru a executa o comandă și a returna stdout/stderr
const execPromise = (command: string): Promise<{ stdout: string; stderr: string }> => {
  console.log(`Executăm comanda: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Eroare la execuția comenzii: ${command}`);
        console.error(error instanceof Error ? error.message : String(error));
        console.error(`Stderr: ${stderr}`);
        reject({ error, stdout, stderr });
      } else {
        console.log(`Comanda executată cu succes: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
        if (stdout) console.log(`Stdout: ${stdout.substring(0, 200)}${stdout.length > 200 ? '...' : ''}`);
        resolve({ stdout, stderr });
      }
    });
  });
};

// Funcție pentru a verifica starea unui fișier
const checkFile = (filePath: string) => {
  const results = {
    exists: false,
    size: 0,
    isReadable: false
  };
  
  try {
    if (fs.existsSync(filePath)) {
      results.exists = true;
      const stats = fs.statSync(filePath);
      results.size = stats.size;
      
      try {
        // Verificăm dacă fișierul poate fi citit
        const fd = fs.openSync(filePath, 'r');
        fs.closeSync(fd);
        results.isReadable = true;
      } catch (readError) {
        console.error(`Fișierul ${filePath} există dar nu poate fi citit:`, readError);
      }
    }
  } catch (error) {
    console.error(`Eroare la verificarea fișierului ${filePath}:`, error);
  }
  
  return results;
};

// Function to parse formData
const parseFormData = (req: NextApiRequest) => {
  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    const form = new IncomingForm({
      multiples: true,
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

// Directorul temporar pentru fișiere
const tempDir = path.join(process.cwd(), 'temp');
// Creăm directorul dacă nu există
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Funcție pentru verificarea stării unui fișier
async function checkFileStatus(filePath: string): Promise<{exists: boolean, size?: number, isReadable?: boolean}> {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false };
    }
    
    const stats = fs.statSync(filePath);
    const isReadable = await new Promise<boolean>((resolve) => {
      fs.access(filePath, fs.constants.R_OK, (err) => {
        resolve(!err);
      });
    });
    
    return {
      exists: true,
      size: stats.size,
      isReadable
    };
  } catch (error) {
    console.error(`Eroare la verificarea fișierului ${filePath}:`, error);
    return { exists: false };
  }
}

// Modificare în funcția downloadAudio pentru a gestiona URL-uri relative
async function downloadAudio(url: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`Descărcare audio de la: ${url} către: ${outputPath}`);
    
    // Verificăm dacă URL-ul este valid - permitem URL-uri relative care încep cu "/"
    if (!url) {
      console.error('URL audio nespecificat');
      return false;
    }
    
    // Transformăm URL-urile relative în URL-uri absolute
    let fullUrl = url;
    if (url.startsWith('/')) {
      // Este un URL relativ, îl transformăm în URL absolut
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      fullUrl = `${baseUrl}${url}`;
      console.log(`URL relativ detectat, transformăm în URL absolut: ${fullUrl}`);
    } else if (!url.startsWith('http')) {
      console.error('URL audio invalid (trebuie să înceapă cu "http" sau "/")', url);
      return false;
    }
    
    // Asigurăm-ne că directorul de ieșire există
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return new Promise(async (resolve, reject) => {
      // Descărcăm fișierul folosind axios
      try {
        console.log(`Inițiem descărcarea de la URL: ${fullUrl}`);
        const response = await axios({
          url: fullUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 15000, // 15 secunde timeout
          headers: {
            'Accept': 'audio/*,*/*',
            'User-Agent': 'Mozilla/5.0 RSS-Aggregator'
          }
        });
        
        console.log(`Răspuns primit cu status: ${response.status}, content-type: ${response.headers['content-type']}`);
        
        // Salvăm stream-ul în fișier
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        
        writer.on('finish', async () => {
          console.log(`Fișier audio descărcat la: ${outputPath}`);
          
          // Verificăm fișierul descărcat
          if (!fs.existsSync(outputPath)) {
            console.error(`Fișierul audio nu a fost creat la: ${outputPath}`);
            resolve(false);
            return;
          }
          
          const fileStats = fs.statSync(outputPath);
          console.log(`Dimensiune fișier audio descărcat: ${fileStats.size} bytes`);
          
          if (fileStats.size === 0) {
            console.error(`Fișierul audio descărcat este gol (0 bytes): ${outputPath}`);
            resolve(false);
            return;
          }
          
          // Verificăm dacă fișierul audio este valid
          const ffmpegPath = ffmpegStatic || 'ffmpeg';
          try {
            await execPromise(`"${ffmpegPath}" -i "${outputPath}" -f null -`)
              .then(() => {
                console.log(`Fișierul audio descărcat este valid: ${outputPath}`);
                resolve(true);
              })
              .catch(() => {
                console.error(`Fișierul audio descărcat nu este valid. Încercăm să-l convertim.`);
                return execPromise(`"${ffmpegPath}" -y -i "${outputPath}" -c:a libmp3lame "${outputPath}.converted.mp3"`)
                  .then(() => {
                    console.log(`Fișier audio convertit cu succes la: ${outputPath}.converted.mp3`);
                    fs.renameSync(`${outputPath}.converted.mp3`, outputPath);
                    resolve(true);
                  })
                  .catch((convErr) => {
                    console.error(`Nu s-a putut converti fișierul audio: ${
                      typeof convErr === 'object' && convErr !== null && 'error' in convErr 
                        ? String(convErr.error) 
                        : String(convErr)
                    }`);
                    resolve(false);
                  });
              });
          } catch (ffmpegErr) {
            console.error(`Eroare la verificarea fișierului audio cu FFmpeg: ${
              ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr)
            }`);
            resolve(false);
          }
        });
        
        writer.on('error', (err) => {
          console.error(`Eroare la scrierea fișierului audio: ${
            err instanceof Error ? err.message : String(err)
          }`);
          reject(err);
        });
      } catch (axiosErr) {
        console.error(`Eroare la descărcarea audio cu axios: ${
          axiosErr instanceof Error ? axiosErr.message : String(axiosErr)
        }`);
        resolve(false);
      }
    });
  } catch (error: unknown) {
    console.error(`Excepție la descărcarea audio: ${
      error instanceof Error ? error.message : String(error)
    }`);
    return false;
  }
}

// Îmbunătățim funcția generateSilentAudio pentru a crea audio silent corect
async function generateSilentAudio(outputPath: string, duration: number): Promise<boolean> {
  try {
    console.log(`Generăm audio silent cu durata ${duration} secunde la ${outputPath}`);
    const ffmpegPath = ffmpegStatic || 'ffmpeg';
    
    // Verificăm extensia fișierului pentru a alege codec-ul potrivit
    const ext = path.extname(outputPath).toLowerCase();
    
    // Comandă specifică în funcție de extensie
    let ffmpegCommand = '';
    if (ext === '.mp3') {
      ffmpegCommand = `"${ffmpegPath}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame -q:a 2 "${outputPath}"`;
    } else if (ext === '.m4a' || ext === '.aac') {
      ffmpegCommand = `"${ffmpegPath}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a aac -b:a 128k "${outputPath}"`;
    } else {
      // Pentru orice altă extensie, folosim libmp3lame care e mai compatibil
      ffmpegCommand = `"${ffmpegPath}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame -q:a 2 "${outputPath}"`;
    }
    
    console.log(`Comandă generare audio silent: ${ffmpegCommand}`);
    
    return new Promise((resolve) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Eroare la generarea audio silent:`, error instanceof Error ? error.message : String(error));
          console.error(`FFmpeg stderr: ${stderr}`);
          
          // Încercăm o comandă alternativă cu WAV
          const wavPath = `${outputPath}.wav`;
          const altCommand = `"${ffmpegPath}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} "${wavPath}"`;
          
          console.log(`Încercăm comandă alternativă: ${altCommand}`);
          exec(altCommand, (wavError, wavStdout, wavStderr) => {
            if (wavError) {
              console.error(`Și comanda alternativă a eșuat:`, wavError instanceof Error ? wavError.message : String(wavError));
              resolve(false);
            } else {
              // Convertim WAV la formatul dorit
              const convertCommand = `"${ffmpegPath}" -y -i "${wavPath}" "${outputPath}"`;
              exec(convertCommand, (convError) => {
                if (convError) {
                  console.error(`Eroare la conversia WAV:`, convError instanceof Error ? convError.message : String(convError));
                  resolve(false);
                } else {
                  console.log(`Audio silent generat cu succes via WAV la: ${outputPath}`);
                  
                  // Ștergem fișierul WAV temporar
                  try { fs.unlinkSync(wavPath); } catch (e) { /* ignorăm erorile la ștergere */ }
                  
                  resolve(true);
                }
              });
            }
          });
        } else {
          console.log(`Audio silent generat cu succes la: ${outputPath}`);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error(`Excepție la generarea audio silent:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Handler pentru endpoint-ul API
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificăm dacă metoda este POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisă' });
  }

  try {
    console.log('Începem procesarea formularului...');
    const { fields, files } = await parseFormData(req);
    
    console.log('Date primite:', { fields });
    
    // Conversie corectă a câmpurilor pentru a evita erorile de tip string[]
    let text = Array.isArray(fields.text) ? fields.text[0] : fields.text || 'Conținut video implicit';
    const effect = Array.isArray(fields.effect) ? fields.effect[0] : fields.effect || 'zoom';
    const duration = Array.isArray(fields.duration) ? fields.duration[0] : fields.duration || '10';
    const audioUrl = Array.isArray(fields.audioUrl) ? fields.audioUrl[0] : fields.audioUrl || '';
    let imageUrl = Array.isArray(fields.imageUrl) ? fields.imageUrl[0] : fields.imageUrl || '';
    
    console.log(`Effect: ${effect}, Duration: ${duration}`);
    console.log(`Audio URL: ${audioUrl}`);

    // Creăm directorul temporar dacă nu există
    const tempDir = path.join(os.tmpdir(), 'rss-aggregator');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Obținem calea către ffmpeg din pachetul ffmpeg-static
    const ffmpegPath = ffmpegStatic || 'ffmpeg';
    console.log(`Folosim FFmpeg de la calea: ${ffmpegPath}`);

    // Generăm un ID unic pentru fișiere - folosim același ID pentru toate fișierele
    const uniqueId = uuidv4();
    const videoFileName = `video_${uniqueId}.mp4`;
    const inputImagePath = path.join(tempDir, `input_${uniqueId}.jpg`);
    const outputVideoPath = path.join(tempDir, videoFileName);
    let audioFilePath = audioUrl ? path.join(tempDir, `audio_${uniqueId}.mp3`) : '';
    
    // Folosim extensia .m4a pentru audio silent, AAC este mai compatibil cu MP4
    const testAudioPath = path.join(tempDir, `test_audio_${uniqueId}.m4a`);

    console.log(`Video output path: ${outputVideoPath}`);
    
    // Descărcăm imaginea sau o copiem din fișierul încărcat
    let imageFilePath = '';
    const imageFile = files.image;
    
    if (imageFile) {
      // Dacă am primit imaginea ca fișier, o copiem în locația temporară
      console.log('Am primit imaginea ca fișier încărcat');
      
      // Fix pentru eroarea de tip: Property 'filepath' does not exist on type 'never'
      // Verificăm tipul și tratăm corect structura formidable.Files
      const uploadedFile = Array.isArray(imageFile) 
        ? (imageFile[0] as unknown as formidable.File) 
        : (imageFile as unknown as formidable.File);
      
      if (uploadedFile && uploadedFile.filepath) {
        fs.copyFileSync(uploadedFile.filepath, inputImagePath);
        console.log(`Imagine copiată la: ${inputImagePath}`);
        imageFilePath = inputImagePath;
      } else {
        console.error('Eroare: Fișierul încărcat nu conține o cale validă');
        throw new Error('Fișierul imagine încărcat nu este valid');
      }
    } else {
      // Dacă nu am primit fișierul, verificăm dacă avem un URL pentru imagine
      if (imageUrl) {
        // Descărcăm imaginea de la URL
        console.log(`Descărcăm imaginea de la URL: ${imageUrl}`);
        await downloadFile(imageUrl, inputImagePath);
        imageFilePath = inputImagePath;
      } else {
        // Dacă nu avem nici fișier, nici URL, folosim o imagine default
        console.log('Nu am primit nici fișier, nici URL de imagine. Folosim o imagine default.');
        const defaultImagePath = path.join(process.cwd(), 'public', 'images', 'sport', 'default_sport.jpg');
        fs.copyFileSync(defaultImagePath, inputImagePath);
        imageFilePath = inputImagePath;
      }
    }
    
    console.log(`Imagine pregătită la: ${imageFilePath}`);
    
    // Verificăm imaginea după procesare
    const imageStatus = checkFile(inputImagePath);
    console.log('Stare imagine:', imageStatus);
    
    if (!imageStatus.exists || !imageStatus.isReadable || imageStatus.size === 0) {
      return res.status(400).json({ error: 'Imaginea nu a putut fi procesată corect' });
    }

    // Asigurăm-ne că duration este convertit la număr mai devreme în cod
    let durationNum = parseInt(duration as string, 10) || 5; // Valoare implicită de 5 secunde
    
    // În partea unde se procesează audioUrl
    let audioDuration = 0;
    let hasAudio = false;
    if (audioUrl) {
      console.log(`Se procesează audio URL: ${audioUrl}`);
      audioFilePath = path.join(tempDir, `audio-${uuidv4()}.mp3`);
      
      const audioDownloaded = await downloadAudio(audioUrl, audioFilePath);
      
      if (audioDownloaded) {
        hasAudio = true;
        console.log(`Audio descărcat cu succes la: ${audioFilePath}`);
        
        try {
          audioDuration = await getAudioDuration(audioFilePath);
          console.log(`Durată audio detectată: ${audioDuration} secunde`);
          
          // Dacă durata audio este mai mare decât durata video, adaptăm
          if (audioDuration > 0 && audioDuration > durationNum) {
            console.log(`Durata audio (${audioDuration}s) este mai mare decât durata video (${durationNum}s). Folosim durata audio.`);
            durationNum = audioDuration;
          }
        } catch (durationError) {
          console.error(`Eroare la obținerea duratei audio: ${durationError instanceof Error ? durationError.message : String(durationError)}`);
          // Continuăm cu durata video originală
        }
      } else {
        console.error(`Nu s-a putut descărca fișierul audio de la URL: ${audioUrl}`);
      }
    }

    // Creăm un fișier audio de test dacă nu avem unul valid
    if (!hasAudio || !fs.existsSync(audioFilePath) || fs.statSync(audioFilePath).size === 0) {
      try {
        console.log('Creăm un fișier audio de test...');
        const videoDuration = durationNum; // Folosim durationNum actualizat
        
        // Generăm un audio de test (tăcere) cu funcția îmbunătățită
        const silentAudioCreated = await generateSilentAudio(testAudioPath, videoDuration);
        
        if (silentAudioCreated && fs.existsSync(testAudioPath) && fs.statSync(testAudioPath).size > 0) {
          console.log('Vom folosi fișierul audio silent pentru video');
          audioFilePath = testAudioPath;
          audioDuration = videoDuration;
          hasAudio = true;
        } else {
          console.log('Nu s-a putut genera audio silent. Vom crea un video fără audio.');
          hasAudio = false;
          audioFilePath = '';
        }
      } catch (silentAudioError) {
        console.error('Eroare la crearea fișierului audio silent:', silentAudioError instanceof Error ? silentAudioError.message : String(silentAudioError));
        hasAudio = false;
        audioFilePath = '';
      }
    }

    // Calculăm durata finală a video-ului
    console.log(`Durata video setată la: ${durationNum} secunde`);

    // În partea unde se construiește comanda FFmpeg
    let ffmpegCommand = '';
    
    if (hasAudio && audioFilePath) {
      console.log(`Creăm video cu audio de la: ${audioFilePath}`);
      
      // Comanda cu audio
      if (effect === 'zoom') {
        // Effect zoom in/out cu audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -i "${audioFilePath}" -t ${durationNum} -filter_complex "zoompan=z='min(zoom+0.0005,1.5)':d=${durationNum*25}:s=1280x720" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outputVideoPath}"`;
      } else if (effect === 'scroll') {
        // Effect scroll cu audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -i "${audioFilePath}" -t ${durationNum} -filter_complex "crop=in_w/2:in_h:in_w/4*(1-t/${durationNum}):0" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outputVideoPath}"`;
      } else {
        // Default effect (static) cu audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -i "${audioFilePath}" -t ${durationNum} -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outputVideoPath}"`;
      }
    } else {
      console.log('Creăm video fără audio');
      
      // Comanda fără audio
      if (effect === 'zoom') {
        // Effect zoom in/out fără audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -t ${durationNum} -filter_complex "zoompan=z='min(zoom+0.0005,1.5)':d=${durationNum*25}:s=1280x720" -c:v libx264 -pix_fmt yuv420p "${outputVideoPath}"`;
      } else if (effect === 'scroll') {
        // Effect scroll fără audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -t ${durationNum} -filter_complex "crop=in_w/2:in_h:in_w/4*(1-t/${durationNum}):0" -c:v libx264 -pix_fmt yuv420p "${outputVideoPath}"`;
      } else {
        // Default effect (static) fără audio
        ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -t ${durationNum} -c:v libx264 -pix_fmt yuv420p "${outputVideoPath}"`;
      }
    }

    console.log(`Executăm comanda FFmpeg: ${ffmpegCommand}`);
    
    await execPromise(ffmpegCommand)
      .then(({stdout, stderr}) => {
        console.log('Video generat cu succes!');
        console.log(`Stdout: ${stdout}`);
        if (stderr) console.log(`Stderr: ${stderr}`);
      })
      .catch(({error, stderr}) => {
        console.error('Eroare la generarea video:', error instanceof Error ? error.message : String(error));
        console.error(`Stderr: ${stderr}`);
        
        // Încercăm o comandă de backup cu mai puține filtre
        console.log('Încercăm o comandă simplificată pentru generarea video...');
        const backupCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" ${hasAudio ? `-i "${audioFilePath}" -c:a aac -shortest` : ''} -t ${durationNum} -c:v libx264 -pix_fmt yuv420p "${outputVideoPath}"`;
        
        return execPromise(backupCommand);
      })
      .catch(({error, stderr}) => {
        // Dacă și comanda de backup eșuează
        console.error('Și comanda de backup a eșuat:', error instanceof Error ? error.message : String(error));
        console.error(`Stderr: ${stderr}`);
        throw new Error('Nu s-a putut genera video-ul nici cu comanda de backup');
      });

    // După execuția FFmpeg și înainte de a construi URL-ul, verificăm fișierul video
    // Verificăm dacă fișierul video a fost creat și are dimensiune
    console.log(`Verificăm fișierul video generat: ${outputVideoPath}`);
    if (!fs.existsSync(outputVideoPath)) {
      throw new Error(`Fișierul video nu a fost creat la calea: ${outputVideoPath}`);
    }
    
    const videoStats = fs.statSync(outputVideoPath);
    console.log(`Dimensiune fișier video: ${videoStats.size} bytes`);
    
    // Construim URL-ul video
    // Schimbăm calea de la /tmp la server storage
    const videoDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }
    
    const publicVideoPath = path.join(videoDir, videoFileName);
    
    // Copiem videoclipul în directorul public pentru a fi servit
    fs.copyFileSync(outputVideoPath, publicVideoPath);
    console.log(`Video copiat în directorul public: ${publicVideoPath}`);
    
    // Construim URL-ul relativ pentru videoclip
    const videoUrl = `/videos/${videoFileName}`;
    console.log(`URL video final: ${videoUrl}`);
    
    // Programăm curățarea fișierelor temporare
    setTimeout(() => {
      try {
        console.log(`Curățăm fișierele temporare...`);
        
        // Ștergem fișierele temporare
        if (fs.existsSync(inputImagePath)) {
          fs.unlinkSync(inputImagePath);
          console.log(`Fișier imagine șters: ${inputImagePath}`);
        }
        
        if (fs.existsSync(outputVideoPath)) {
          fs.unlinkSync(outputVideoPath);
          console.log(`Fișier video temporar șters: ${outputVideoPath}`);
        }
        
        if (audioFilePath && fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
          console.log(`Fișier audio șters: ${audioFilePath}`);
        }
        
        if (fs.existsSync(testAudioPath)) {
          fs.unlinkSync(testAudioPath);
          console.log(`Fișier audio de test șters: ${testAudioPath}`);
        }
        
        console.log(`Curățare completă a fișierelor temporare.`);
      } catch (cleanupError) {
        console.error(`Eroare la curățarea fișierelor temporare:`, cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
    }, 60 * 60 * 1000); // Curățăm după o oră
    
    // Returnăm URL-ul video
    return res.status(200).json({ success: true, videoUrl });
  } catch (error: any) {
    console.error('Eroare generală în handler:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ 
      error: 'Eroare la generarea video-ului', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
} 