import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

// API pentru generarea video - versiune simplificată pentru serverless
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisă' });
  }

  try {
    // Pe platforme serverless (Vercel), FFmpeg nu este disponibil
    // Returnăm o eroare explicativă și sugerăm alternative
    return res.status(501).json({ 
      error: 'Generarea video nu este disponibilă pe platforme serverless.',
      message: 'Această funcționalitate necesită FFmpeg care nu este disponibil pe Vercel.',
      alternatives: [
        'Folosiți MediaRecorder API în browser pentru a genera video',
        'Folosiți Canvas API pentru a crea animații',
        'Folosiți un serviciu extern pentru procesarea video (CloudConvert, etc.)',
        'Implementați generarea video pe client-side'
      ],
      clientSideOptions: {
        mediaRecorder: 'Folosiți MediaRecorder cu Canvas.captureStream()',
        webCodecs: 'Folosiți WebCodecs API pentru browsers moderne',
        ffmpegWasm: 'Folosiți @ffmpeg/ffmpeg pentru procesare în browser'
      }
    });
  } catch (error) {
    console.error('Eroare la API-ul de generare video:', error);
    res.status(500).json({ error: 'Eroare la procesarea cererii' });
  }
} 