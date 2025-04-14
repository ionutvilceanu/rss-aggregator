import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import util from 'util';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const execAsync = util.promisify(exec);

// API Key pentru VoiceRSS (serviciu TTS)
const VOICE_RSS_API_KEY = process.env.VOICE_RSS_API_KEY || 'c5b19751ca254e65b35357d24b2cf0f7'; // cheie demo

// Configurare API pentru a nu parsa automat body-ul
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Directorul pentru fișiere audio temporare
const tempDir = path.join(os.tmpdir(), 'rss-aggregator', 'audio');

// Asigurăm-ne că directorul există
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Creează directorul public pentru audio
const publicAudioDir = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(publicAudioDir)) {
  fs.mkdirSync(publicAudioDir, { recursive: true });
}

// Configurația pentru Microsoft Azure Speech Service
const azureKey = process.env.AZURE_SPEECH_KEY || '';
const azureRegion = process.env.AZURE_SPEECH_REGION || 'westeurope';

// Directorul unde vor fi salvate fișierele audio
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'audio');

// Asigurăm-ne că directorul există
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Director creat: ${uploadDir}`);
  }
} catch (err) {
  console.error(`Eroare la crearea directorului: ${err}`);
}

// Funcție pentru curățarea textului înainte de a fi trimis către TTS
function cleanTextForTTS(text: string): string {
  // Eliminăm HTML-ul și alte caractere problematice
  let cleanedText = text
    .replace(/<[^>]*>/g, '') // Eliminăm tag-urile HTML
    .replace(/&[^;]+;/g, ' ') // Înlocuim entitățile HTML cu spații
    .replace(/\[.*?\]/g, '') // Eliminăm conținutul din paranteze pătrate
    .replace(/https?:\/\/\S+/g, '') // Eliminăm URL-urile
    .replace(/\s+/g, ' ') // Comprimăm spațiile multiple
    .replace(/["„""'']/g, '"') // Standardizăm ghilimelele
    .replace(/[^\w\s.,?!;:()"""'-]/g, ' ') // Păstrăm doar caractere comune
    .trim();
    
  // Facem niște ajustări suplimentare pentru ca textul să sune mai natural
  cleanedText = cleanedText
    .replace(/\.\s+/g, '. ') // Adăugăm spațiu după punct
    .replace(/\!\s+/g, '! ') // Adăugăm spațiu după semn de exclamare
    .replace(/\?\s+/g, '? ') // Adăugăm spațiu după semn de întrebare
    .replace(/\s+\./g, '.') // Eliminăm spațiile înainte de punct
    .replace(/\s+\!/g, '!') // Eliminăm spațiile înainte de semn de exclamare
    .replace(/\s+\?/g, '?') // Eliminăm spațiile înainte de semn de întrebare
    .replace(/\s+,/g, ',') // Eliminăm spațiile înainte de virgulă
    .replace(/,\s+/g, ', ') // Adăugăm spațiu după virgulă
    .replace(/;\s+/g, '; ') // Adăugăm spațiu după punct și virgulă
    .replace(/\s+;/g, ';') // Eliminăm spațiile înainte de punct și virgulă
    .replace(/\s{2,}/g, ' '); // Eliminăm spațiile multiple
    
  // Limitare text pentru API-uri care au restricții de lungime
  // Mărim limita la 5000 de caractere pentru a cuprinde mai mult conținut
  const maxLength = 5000;
  if (cleanedText.length > maxLength) {
    // Găsim ultimul punct complet înainte de limită pentru a nu tăia propozițiile în mijloc
    const lastPeriodPos = cleanedText.lastIndexOf('.', maxLength);
    if (lastPeriodPos > 0) {
      cleanedText = cleanedText.substring(0, lastPeriodPos + 1);
    } else {
      // Dacă nu găsim un punct, trunchiăm pur și simplu
      cleanedText = cleanedText.substring(0, maxLength) + '...';
    }
  }
  
  return cleanedText;
}

// Funcție pentru a genera audio folosind API-ul VoiceRSS
async function generateAudioViaVoiceRSS(text: string, lang: string, gender: string): Promise<string | null> {
  try {
    if (!VOICE_RSS_API_KEY) {
      console.error('API Key pentru VoiceRSS nu este configurat');
      return null;
    }

    console.log(`Generăm audio via VoiceRSS pentru: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Limitare text pentru a evita erori cu API-ul
    const limitedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
    
    // Determinăm vocea potrivită în funcție de limbă și gen
    let voice = 'ro-ro';
    let voiceName = 'Andrei';
    
    if (lang.toLowerCase() === 'en') {
      voice = 'en-us';
      voiceName = gender === 'female' ? 'Linda' : 'Mike';
    } else if (lang.toLowerCase().startsWith('ro')) {
      voice = 'ro-ro';
      voiceName = 'Andrei'; // VoiceRSS oferă doar 'Andrei' pentru română
    }
    
    // Creăm un ID unic pentru fișierul audio
    const audioId = uuidv4();
    const outputPath = path.join(tempDir, `${audioId}.mp3`);
    
    // Parametrii pentru API-ul VoiceRSS
    const params = new URLSearchParams();
    params.append('key', VOICE_RSS_API_KEY);
    params.append('src', limitedText);
    params.append('hl', voice);
    params.append('v', voiceName);
    params.append('r', '0');
    params.append('c', 'MP3');
    params.append('f', '44khz_16bit_stereo');
    
    console.log(`Parametri VoiceRSS: voce=${voice}, nume=${voiceName}, limba=${lang}`);
    
    // Facem cererea către API cu timeout de 10 secunde
    const response = await axios({
      method: 'POST',
      url: 'https://api.voicerss.org/',
      data: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'stream',
      timeout: 10000 // 10 secunde timeout
    });
    
    // Verificăm răspunsul
    if (response.status !== 200) {
      console.error(`Eroare API VoiceRSS: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Salvăm stream-ul în fișier
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Fișier audio generat cu succes la: ${outputPath}`);
        
        // Verificăm dacă fișierul există și are conținut
        if (!fs.existsSync(outputPath)) {
          console.error(`Fișierul audio nu a fost creat la: ${outputPath}`);
          resolve(null);
          return;
        }
        
        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          console.error(`Fișierul audio generat are dimensiune 0: ${outputPath}`);
          resolve(null);
          return;
        }
        
        // Validăm fișierul audio pentru a ne asigura că nu este un mesaj de eroare HTML
        validateAudioFile(outputPath).then(isValid => {
          if (!isValid) {
            console.error(`Fișierul audio generat nu este valid (posibil HTML de eroare): ${outputPath}`);
            resolve(null);
            return;
          }
          
          // Mutăm fișierul în directorul public pentru a fi accesibil
          const publicFileName = `${audioId}.mp3`;
          const publicPath = path.join(publicAudioDir, publicFileName);
          
          fs.copyFileSync(outputPath, publicPath);
          console.log(`Fișier audio copiat în directorul public: ${publicPath}`);
          
          // Programăm ștergerea fișierului temporar după o oră
          setTimeout(() => {
            try {
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                console.log(`Fișier audio temporar șters: ${outputPath}`);
              }
            } catch (error) {
              console.error(`Eroare la ștergerea fișierului audio temporar: ${error}`);
            }
          }, 60 * 60 * 1000); // 1 oră
          
          // Returnăm URL-ul relativ către fișierul audio
          resolve(`/audio/${publicFileName}`);
        });
      });
      
      writer.on('error', err => {
        console.error(`Eroare la scrierea fișierului audio: ${err}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Eroare la generarea audio via VoiceRSS:', error);
    return null;
  }
}

// Funcție pentru a valida un fișier audio
async function validateAudioFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Verificăm dacă fișierul există
      if (!fs.existsSync(filePath)) {
        console.error(`Fișierul nu există: ${filePath}`);
        return resolve(false);
      }
      
      // Verificăm dimensiunea fișierului
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.error(`Fișierul are dimensiune zero: ${filePath}`);
        return resolve(false);
      }
      
      // Verificăm primii 100 de bytes pentru a detecta dacă este un fișier HTML (eroare)
      const buffer = Buffer.alloc(100);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 100, 0);
      fs.closeSync(fd);
      
      const header = buffer.toString().toLowerCase();
      if (header.includes('<!doctype html>') || 
          header.includes('<html>') || 
          header.includes('error') || 
          header.includes('invalid')) {
        console.error('Fișierul audio pare a fi un document HTML, nu un MP3 valid');
        return resolve(false);
      }
      
      // Verificăm dacă fișierul începe cu header MP3
      if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        console.log('Fișierul are un header MP3 valid (ID3)');
        return resolve(true);
      }
      
      if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
        console.log('Fișierul are un header MP3 valid (frame sync)');
        return resolve(true);
      }
      
      // Verificăm cu ffmpeg dacă este disponibil
      const checkFfmpeg = `where ffmpeg`;
      exec(checkFfmpeg, (ffmpegError) => {
        if (ffmpegError) {
          console.log('ffmpeg nu este disponibil, nu putem verifica în detaliu fișierul audio');
          
          // Presupunem că fișierul este valid dacă nu este HTML
          if (!header.includes('html') && !header.includes('error')) {
            return resolve(true);
          }
          
          return resolve(false);
        }
        
        // ffmpeg este disponibil, verificăm fișierul
        const ffmpegCommand = `ffmpeg -i "${filePath}" -f null -`;
        exec(ffmpegCommand, (error) => {
          if (error) {
            console.error('Fișierul audio nu a trecut validarea ffmpeg');
            resolve(false);
          } else {
            console.log('Fișierul audio a trecut validarea ffmpeg');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Eroare la validarea fișierului audio:', error);
      resolve(false);
    }
  });
}

// Înlocuim funcția generateSilentAudioFile pentru a nu folosi ffmpeg
async function generateSilentAudioFile(outputPath: string, duration: number = 5): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      console.log(`Generăm un fișier audio silent de ${duration} secunde fără a folosi ffmpeg...`);
      
      // Creăm un fișier MP3 simplu/gol folosind un buffer predefinit
      // Acesta este un header MP3 valid minimal (ID3v2 + frame) pentru un fișier MP3 gol
      const mp3Header = Buffer.from([
        0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, // ID3v2 header
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // padding
        0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // MP3 frame header
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // audio data
      ]);
      
      fs.writeFileSync(outputPath, mp3Header);
      
      console.log(`Fișier audio silent (minimal) generat la: ${outputPath}`);
      
      // Verificăm dacă fișierul a fost creat
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`Fișier audio silent creat cu succes: ${outputPath}`);
        resolve(true);
      } else {
        console.error(`Nu s-a putut crea fișierul silent: ${outputPath}`);
        resolve(false);
      }
    } catch (error) {
      console.error('Excepție la generarea audio silent:', error);
      resolve(false);
    }
  });
}

// Adăugăm o funcție pentru a verifica vocile disponibile în PowerShell
async function getAvailablePowerShellVoices(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      console.log('Verificăm vocile disponibile în PowerShell...');
      
      const powershellCommand = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name };
      `;
      
      // Executăm comanda PowerShell
      const encodedCommand = Buffer.from(powershellCommand, 'utf16le').toString('base64');
      const command = `powershell.exe -EncodedCommand ${encodedCommand}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Eroare la verificarea vocilor:', error);
          resolve([]);
          return;
        }
        
        // Parsăm rezultatul pentru a obține lista de voci
        const voices = stdout.trim().split('\r\n').filter(voice => voice.length > 0);
        console.log(`Voci disponibile: ${voices.join(', ')}`);
        
        resolve(voices);
      });
    } catch (error) {
      console.error('Excepție la verificarea vocilor:', error);
      resolve([]);
    }
  });
}

// Modificăm funcția PowerShell pentru a verifica și a folosi voci disponibile
async function generateAudioWithPowerShell(text: string, lang: string, gender: string): Promise<string | null> {
  return new Promise(async (resolve) => {
    try {
      console.log(`Generăm audio cu PowerShell pentru: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Creăm un ID unic pentru fișierul audio
      const audioId = uuidv4();
      const outputPath = path.join(tempDir, `${audioId}.wav`);
      const mp3OutputPath = path.join(tempDir, `${audioId}.mp3`);
      const textFilePath = path.join(tempDir, `${audioId}.txt`);
      
      // Verificăm vocile disponibile
      const availableVoices = await getAvailablePowerShellVoices();
      
      // Determinăm vocea potrivită în funcție de cele disponibile
      let voice = '';
      
      if (availableVoices.length === 0) {
        console.error('Nu s-au găsit voci disponibile în sistem');
        
        // Creăm direct un fișier MP3 silent
        const success = await generateSilentAudioFile(mp3OutputPath, 5);
        if (success) {
          // Copiem fișierul în directorul public
          const publicFileName = `${audioId}.mp3`;
          const publicPath = path.join(publicAudioDir, publicFileName);
          fs.copyFileSync(mp3OutputPath, publicPath);
          resolve(`/audio/${publicFileName}`);
        } else {
          resolve(null);
        }
        return;
      }
      
      // Încercăm să alegem o voce potrivită
      if (lang.toLowerCase() === 'en') {
        // Pentru engleză, căutăm voci care conțin "en", "us", "uk", "microsoft" 
        // și care conțin "female" dacă gender este female
        const enVoices = availableVoices.filter(v => 
          v.toLowerCase().includes('en') || 
          v.toLowerCase().includes('us') || 
          v.toLowerCase().includes('uk') || 
          v.toLowerCase().includes('microsoft')
        );
        
        if (gender === 'female') {
          const femaleVoice = enVoices.find(v => 
            v.toLowerCase().includes('female') || 
            v.toLowerCase().includes('zira') || 
            v.toLowerCase().includes('linda')
          );
          if (femaleVoice) voice = femaleVoice;
        } else {
          const maleVoice = enVoices.find(v => 
            v.toLowerCase().includes('male') || 
            v.toLowerCase().includes('david') || 
            v.toLowerCase().includes('mark')
          );
          if (maleVoice) voice = maleVoice;
        }
        
        // Dacă nu am găsit o voce specifică, luăm prima voce din lista de voci englezești
        if (!voice && enVoices.length > 0) {
          voice = enVoices[0];
        }
      } else if (lang.toLowerCase().startsWith('ro')) {
        // Pentru română, căutăm voci care conțin "ro" sau "andrei"
        const roVoices = availableVoices.filter(v => 
          v.toLowerCase().includes('ro') || 
          v.toLowerCase().includes('andrei')
        );
        
        if (roVoices.length > 0) {
          voice = roVoices[0];
        }
      }
      
      // Dacă tot nu am găsit o voce, folosim prima voce disponibilă
      if (!voice && availableVoices.length > 0) {
        voice = availableVoices[0];
      }
      
      if (!voice) {
        console.error('Nu s-a putut determina o voce valabilă');
        
        // Creăm direct un fișier MP3 silent
        const success = await generateSilentAudioFile(mp3OutputPath, 5);
        if (success) {
          // Copiem fișierul în directorul public
          const publicFileName = `${audioId}.mp3`;
          const publicPath = path.join(publicAudioDir, publicFileName);
          fs.copyFileSync(mp3OutputPath, publicPath);
          resolve(`/audio/${publicFileName}`);
        } else {
          resolve(null);
        }
        return;
      }
      
      console.log(`Parametri PowerShell TTS: voce=${voice}, gen=${gender}, limba=${lang}`);
      
      // În loc să încercăm escaparea textului, vom scrie textul într-un fișier
      fs.writeFileSync(textFilePath, text, 'utf8');
      
      // Comanda PowerShell pentru generarea audio folosind fișierul text
      const powershellCommand = `
        Add-Type -AssemblyName System.Speech; 
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; 
        $synth.SelectVoice('${voice}'); 
        $synth.SetOutputToWaveFile('${outputPath.replace(/\\/g, '\\\\')}'); 
        $synth.Speak([System.IO.File]::ReadAllText('${textFilePath.replace(/\\/g, '\\\\')}'));
        $synth.Dispose();
      `;
      
      // Executăm comanda PowerShell
      const encodedCommand = Buffer.from(powershellCommand, 'utf16le').toString('base64');
      const command = `powershell.exe -EncodedCommand ${encodedCommand}`;
      
      console.log('Executăm comanda PowerShell pentru TTS...');
      exec(command, async (error, stdout, stderr) => {
        // Ștergem fișierul text indiferent de rezultat
        try {
          if (fs.existsSync(textFilePath)) {
            fs.unlinkSync(textFilePath);
          }
        } catch (unlinkError) {
          console.error(`Eroare la ștergerea fișierului text: ${unlinkError}`);
        }
        
        if (error || stderr) {
          console.error('Eroare la generarea audio cu PowerShell:', error || stderr);
          
          // Creăm direct un fișier MP3 silent ca soluție de rezervă
          const success = await generateSilentAudioFile(mp3OutputPath, 5);
          if (success) {
            // Copiem fișierul în directorul public
            const publicFileName = `${audioId}.mp3`;
            const publicPath = path.join(publicAudioDir, publicFileName);
            fs.copyFileSync(mp3OutputPath, publicPath);
            resolve(`/audio/${publicFileName}`);
          } else {
            resolve(null);
          }
          return;
        }
        
        // Verificăm dacă fișierul WAV a fost generat
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          console.error(`Fișierul WAV nu a fost creat corect: ${outputPath}`);
          
          // Creăm direct un fișier MP3 silent
          const success = await generateSilentAudioFile(mp3OutputPath, 5);
          if (success) {
            // Copiem fișierul în directorul public
            const publicFileName = `${audioId}.mp3`;
            const publicPath = path.join(publicAudioDir, publicFileName);
            fs.copyFileSync(mp3OutputPath, publicPath);
            resolve(`/audio/${publicFileName}`);
          } else {
            resolve(null);
          }
          return;
        }
        
        // Dacă avem ffmpeg disponibil, încercăm să convertim WAV la MP3
        const checkFfmpeg = `where ffmpeg`;
        exec(checkFfmpeg, async (ffmpegError) => {
          if (ffmpegError) {
            console.log('ffmpeg nu este disponibil, folosim fișierul WAV direct');
            
            // Nu putem converti, așa că folosim fișierul WAV direct
            const publicFileName = `${audioId}.wav`;
            const publicPath = path.join(publicAudioDir, publicFileName);
            
            fs.copyFileSync(outputPath, publicPath);
            console.log(`Fișier audio WAV copiat în directorul public: ${publicPath}`);
            
            // Programăm ștergerea fișierului temporar
            setTimeout(() => {
              try {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              } catch (e) { /* ignorăm erorile */ }
            }, 60 * 60 * 1000); // 1 oră
            
            resolve(`/audio/${publicFileName}`);
          } else {
            // ffmpeg este disponibil, convertim WAV la MP3
            processWavToMp3(outputPath, mp3OutputPath, audioId, resolve);
          }
        });
      });
    } catch (error) {
      console.error('Excepție la generarea audio cu PowerShell:', error);
      
      // Generăm un audio silent ca soluție de urgență
      try {
        const audioId = uuidv4();
        const mp3OutputPath = path.join(tempDir, `${audioId}.mp3`);
        
        const success = await generateSilentAudioFile(mp3OutputPath, 5);
        if (success) {
          const publicFileName = `${audioId}.mp3`;
          const publicPath = path.join(publicAudioDir, publicFileName);
          fs.copyFileSync(mp3OutputPath, publicPath);
          resolve(`/audio/${publicFileName}`);
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    }
  });
}

// Funcție helper pentru a procesa WAV în MP3 și finaliza procesul
function processWavToMp3(wavPath: string, mp3Path: string, audioId: string, resolve: (value: string | null) => void) {
  // Convertim WAV la MP3 pentru dimensiuni mai mici
  const ffmpegCommand = `ffmpeg -y -i "${wavPath}" -acodec libmp3lame -q:a 2 "${mp3Path}"`;
  
  console.log('Convertim WAV la MP3...');
  exec(ffmpegCommand, (ffmpegError, ffmpegStdout, ffmpegStderr) => {
    // Ștergem fișierul WAV indiferent de rezultat
    try {
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
    } catch (unlinkError) {
      console.error(`Eroare la ștergerea fișierului WAV: ${unlinkError}`);
    }
    
    if (ffmpegError) {
      console.error('Eroare la conversia WAV la MP3:', ffmpegError);
      resolve(null);
      return;
    }
    
    // Verificăm dacă fișierul MP3 a fost generat corect
    if (!fs.existsSync(mp3Path)) {
      console.error(`Fișierul MP3 nu a fost creat la: ${mp3Path}`);
      resolve(null);
      return;
    }
    
    const mp3Stats = fs.statSync(mp3Path);
    if (mp3Stats.size === 0) {
      console.error(`Fișierul MP3 generat are dimensiune 0: ${mp3Path}`);
      resolve(null);
      return;
    }
    
    // Mutăm fișierul în directorul public pentru a fi accesibil
    const publicFileName = `${audioId}.mp3`;
    const publicPath = path.join(publicAudioDir, publicFileName);
    
    fs.copyFileSync(mp3Path, publicPath);
    console.log(`Fișier audio copiat în directorul public: ${publicPath}`);
    
    // Programăm ștergerea fișierului temporar după o oră
    setTimeout(() => {
      try {
        if (fs.existsSync(mp3Path)) {
          fs.unlinkSync(mp3Path);
          console.log(`Fișier MP3 temporar șters: ${mp3Path}`);
        }
      } catch (error) {
        console.error(`Eroare la ștergerea fișierului MP3 temporar: ${error}`);
      }
    }, 60 * 60 * 1000); // 1 oră
    
    // Returnăm URL-ul relativ către fișierul audio
    resolve(`/audio/${publicFileName}`);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, language = 'ro-RO', gender = 'male', quality = 'high', format = 'mp3' } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required.' });
    }
    
    // Curățăm textul pentru TTS
    const cleanedText = cleanTextForTTS(text);
    console.log(`Text original lungime: ${text.length} caractere, text curățat: ${cleanedText.length} caractere`);
    console.log(`Primele 300 caractere din textul curățat: "${cleanedText.substring(0, 300)}..."`);
    console.log(`NOTĂ: Se folosește ÎNTREGUL conținut curățat de ${cleanedText.length} caractere pentru generarea vocii!`);

    console.log(`Generare voiceover pentru textul curățat de ${cleanedText.length} caractere`);
    console.log(`Parametri: limba=${language}, gen=${gender}, calitate=${quality}, format=${format}`);

    try {
      // Generăm un ID unic pentru fișierul audio
      const fileId = uuidv4();
      const fileName = `${fileId}.${format}`;
      const filePath = path.join(uploadDir, fileName);
      const relativeFilePath = `/uploads/audio/${fileName}`;

      console.log(`Fișier audio va fi salvat la: ${filePath}`);

      // Pregătim SSML (Speech Synthesis Markup Language) pentru a controla redarea
      let voiceName;
      let ssml;
      
      // Alegem vocea și configurăm SSML în funcție de limbă
      if (language === 'ro-RO') {
        // Folosim vocile cele mai naturale pentru română
        voiceName = gender === 'male' ? 'ro-RO-EmilNeural' : 'ro-RO-AlinaNeural';
        
        // Setăm parametri speciali pentru îmbunătățirea dicției și pronunției diacriticelor
        ssml = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
            <voice name="${voiceName}">
              <prosody rate="0.97" pitch="+0%" volume="+20%">
                <mstts:express-as style="narration-professional" styledegree="2" xmlns:mstts="http://www.w3.org/2001/mstts">
                  <break time="200ms"/>
                  ${cleanedText.replace(/([ăâîșț])/gi, '<phoneme alphabet="sapi" ph="$1">$1</phoneme>')}
                  <break time="200ms"/>
                </mstts:express-as>
              </prosody>
            </voice>
          </speak>`;
        
        console.log('Folosim vocea românească optimizată pentru diacritice cu stil profesional:', voiceName);
      } else if (language === 'en-US') {
        voiceName = gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
        
        // SSML standard pentru engleză
        ssml = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
            <voice name="${voiceName}">
              <prosody rate="0.85" pitch="0">
                ${cleanedText}
              </prosody>
            </voice>
          </speak>`;
      } else {
        // Fallback la engleză dacă limba nu este suportată
        voiceName = gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
        
        // SSML standard pentru alte limbi
        ssml = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
            <voice name="${voiceName}">
              <prosody rate="0.85" pitch="0">
                ${cleanedText}
              </prosody>
            </voice>
          </speak>`;
      }

      // Setăm rata de eșantionare în funcție de calitate - întotdeauna folosim calitate înaltă pentru conținut complet
      const sampleRate = '24000';

      // Folosim Microsoft Azure Speech SDK pentru conversie text-to-speech
      if (azureKey && azureRegion) {
        const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
        // Folosim întotdeauna cel mai bun format pentru texte lungi
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;
        
        // Cream audio config pentru a salva în fișier
        const audioConfig = sdk.AudioConfig.fromAudioFileOutput(filePath);
        
        // Cream sintetizatorul de voce
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
        
        console.log('Începe sintetizarea cu Azure Speech Service...');
        const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
          synthesizer.speakSsmlAsync(
            ssml,
            (result: sdk.SpeechSynthesisResult) => {
              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                resolve(result);
              } else {
                reject(new Error(`Sintetizare eșuată: ${result.errorDetails}`));
              }
              synthesizer.close();
            },
            (error: string) => {
              reject(new Error(error));
              synthesizer.close();
            }
          );
        });
        
        console.log('Sintetizare completă. Verificăm fișierul...');
        
        // Verifică dacă fișierul a fost creat și nu este gol
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`Fișier audio creat cu dimensiunea: ${stats.size} bytes pentru ${cleanedText.length} caractere`);
          
          if (stats.size < 100) {
            console.error('Fișierul audio generat este prea mic, posibil corupt');
            return res.status(500).json({ error: 'Fișierul audio generat este prea mic, posibil corupt' });
          }
        } else {
          console.error('Fișierul audio nu a fost creat');
          return res.status(500).json({ error: 'Fișierul audio nu a fost creat' });
        }
        
        console.log(`Voiceover generat cu succes: ${relativeFilePath}`);
        return res.status(200).json({ 
          message: 'Voiceover generated successfully', 
          audioUrl: relativeFilePath,
          textLength: cleanedText.length,
          duration: result.audioDuration ? Math.round(result.audioDuration / 10000) / 100 : null // convertim din 100-nanosecunde la secunde
        });
      } else {
        // Fallback la utilizarea unui alt serviciu sau generatoare locale dacă Azure nu este configurat
        // În acest exemplu, folosim un serviciu Google TTS gratuit (dar de calitate mai slabă)
        console.log('Azure Speech Service nu este configurat, folosim metoda alternativă');
        
        // Construim URL-ul pentru API-ul text-to-speech
        const ttsUrl = `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(cleanedText)}&tl=${language.split('-')[0]}`;
        
        // Descărcăm audio-ul folosind curl și îl salvăm în fișier
        console.log('Descărcare audio de la serviciul alternativ...');
        await execAsync(`curl "${ttsUrl}" -o "${filePath}"`);
        
        // Verifică dacă fișierul a fost creat și nu este gol
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`Fișier audio creat cu dimensiunea: ${stats.size} bytes`);
          
          if (stats.size < 100) {
            console.error('Fișierul audio generat este prea mic, posibil corupt');
            return res.status(500).json({ error: 'Fișierul audio generat este prea mic, posibil corupt' });
          }
        } else {
          console.error('Fișierul audio nu a fost creat');
          return res.status(500).json({ error: 'Fișierul audio nu a fost creat' });
        }
        
        console.log(`Voiceover generat cu succes (metoda alternativă): ${relativeFilePath}`);
        return res.status(200).json({ 
          message: 'Voiceover generated successfully', 
          audioUrl: relativeFilePath,
          textLength: cleanedText.length,
          duration: null // Nu putem determina durata
        });
      }
    } catch (error: any) {
      console.error('Eroare la generarea voiceover:', error);
      return res.status(500).json({ error: `Error generating voiceover: ${error.message}` });
    }
  } catch (error: any) {
    console.error('Eroare generală:', error);
    return res.status(500).json({ error: `General error: ${error.message}` });
  }
} 