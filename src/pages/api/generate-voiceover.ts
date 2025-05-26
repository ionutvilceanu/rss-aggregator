import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// API Key pentru VoiceRSS (serviciu TTS)
const VOICE_RSS_API_KEY = process.env.VOICE_RSS_API_KEY || 'c5b19751ca254e65b35357d24b2cf0f7';

// Configurare API pentru a nu parsa automat body-ul
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Configurația pentru Microsoft Azure Speech Service
const azureKey = process.env.AZURE_SPEECH_KEY || '';
const azureRegion = process.env.AZURE_SPEECH_REGION || 'westeurope';

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
  const maxLength = 5000;
  if (cleanedText.length > maxLength) {
    const lastPeriodPos = cleanedText.lastIndexOf('.', maxLength);
    if (lastPeriodPos > 0) {
      cleanedText = cleanedText.substring(0, lastPeriodPos + 1);
    } else {
      cleanedText = cleanedText.substring(0, maxLength) + '...';
    }
  }
  
  return cleanedText;
}

// Funcție pentru a genera audio folosind API-ul VoiceRSS (doar pentru browser)
async function generateAudioViaVoiceRSS(text: string, lang: string, gender: string): Promise<ArrayBuffer | null> {
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
      voiceName = 'Andrei';
    }
    
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
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    if (response.status !== 200) {
      console.error(`Eroare API VoiceRSS: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error('Eroare la generarea audio cu VoiceRSS:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Metoda nu este permisă',
      message: 'Doar metodele POST sunt acceptate pentru acest endpoint.'
    });
  }

  try {
    const { text, lang = 'ro', gender = 'male', service = 'voicerss' } = req.body;

    if (!text) {
      return res.status(400).json({ 
        error: 'Text lipsă',
        message: 'Textul pentru generarea voiceover-ului este obligatoriu.'
      });
    }

    console.log(`Cerere voiceover: text="${text.substring(0, 100)}...", lang=${lang}, gender=${gender}, service=${service}`);

    // Curățăm textul pentru TTS
    const cleanedText = cleanTextForTTS(text);
    
    if (!cleanedText.trim()) {
      return res.status(400).json({ 
        error: 'Text invalid',
        message: 'Textul furnizat nu conține conținut valid pentru generarea voiceover-ului.'
      });
    }

    // Pentru platforme serverless, returnăm doar datele audio ca ArrayBuffer
    if (service === 'voicerss') {
      const audioBuffer = await generateAudioViaVoiceRSS(cleanedText, lang, gender);
      
      if (!audioBuffer) {
        return res.status(500).json({ 
          error: 'Eroare la generarea audio',
          message: 'Nu s-a putut genera fișierul audio cu serviciul VoiceRSS.'
        });
      }

      // Returnăm audio-ul ca base64 pentru a fi procesat în browser
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      
      return res.status(200).json({
        success: true,
        message: 'Audio generat cu succes',
        audioData: base64Audio,
        mimeType: 'audio/mpeg',
        service: 'voicerss',
        textLength: cleanedText.length,
        originalTextLength: text.length
      });
    }

    // Pentru alte servicii, returnăm o eroare explicativă
    return res.status(501).json({
      error: 'Serviciu indisponibil pe serverless',
      message: 'Pe platforme serverless, doar serviciul VoiceRSS este disponibil.',
      availableServices: ['voicerss'],
      alternatives: [
        'Folosiți serviciul VoiceRSS prin parametrul service=voicerss',
        'Implementați generarea audio în browser folosind Web Speech API',
        'Folosiți un serviciu extern de TTS cu API REST'
      ]
    });

  } catch (error: any) {
    console.error('Eroare în handler voiceover:', error);
    return res.status(500).json({ 
      error: 'Eroare internă de server',
      message: 'A apărut o eroare neașteptată la procesarea cererii.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 