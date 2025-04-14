import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Directorul temporar pentru fișierele audio
const tempDir = path.join(os.tmpdir(), 'tts-audio');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metoda nu este permisă' });
  }

  try {
    // Obținem ID-ul din parametrul URL
    const { id } = req.query;
    
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'ID invalid' });
    }
    
    // Construim calea către fișierul audio
    const audioFile = path.join(tempDir, `${id}.mp3`);
    
    // Verificăm dacă fișierul există
    if (!fs.existsSync(audioFile)) {
      return res.status(404).json({ error: 'Fișierul audio nu a fost găsit' });
    }
    
    // Verificăm dimensiunea fișierului
    const stats = fs.statSync(audioFile);
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Fișierul audio este gol' });
    }
    
    // Setăm header-urile pentru streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="audio-${id}.mp3"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache pentru 1 oră
    
    // Transmitem fișierul ca stream
    const stream = fs.createReadStream(audioFile);
    stream.pipe(res);
    
    // Gestionăm erorile de streaming
    stream.on('error', (error) => {
      console.error('Eroare la streaming-ul fișierului audio:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Eroare la streamarea fișierului audio' });
      }
      res.end();
    });
  } catch (error) {
    console.error('Eroare la procesarea cererii audio:', error);
    return res.status(500).json({ error: 'Eroare la procesarea cererii audio' });
  }
} 