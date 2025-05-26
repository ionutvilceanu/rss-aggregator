import { NextApiRequest, NextApiResponse } from 'next';

// Dezactivăm body parser-ul implicit pentru a putea primi fișiere
export const config = {
  api: {
    bodyParser: false,
  }
};

// API pentru combinarea audio-video - versiune simplificată pentru serverless
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisă. Folosiți POST.' });
  }

  try {
    // Pe platforme serverless (Vercel), FFmpeg nu este disponibil
    // Returnăm o eroare explicativă și sugerăm alternative
    return res.status(501).json({ 
      error: 'Combinarea audio-video nu este disponibilă pe platforme serverless.',
      message: 'Această funcționalitate necesită FFmpeg care nu este disponibil pe Vercel.',
      alternatives: [
        'Folosiți MediaRecorder API în browser pentru a combina audio și video',
        'Descărcați fișierele separat și combinați-le local',
        'Folosiți un serviciu extern pentru procesarea video'
      ]
    });
  } catch (error) {
    console.error('Eroare la API-ul de combinare audio-video:', error);
    res.status(500).json({ error: 'Eroare la procesarea cererii' });
  }
} 