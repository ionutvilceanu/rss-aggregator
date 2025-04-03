import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitem doar metoda GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metoda nepermisă' });
  }

  // Parametrul url
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL-ul imaginii lipsește' });
  }

  try {
    // Decodificăm URL-ul pentru a obține URL-ul original
    const decodedUrl = decodeURIComponent(url);
    
    console.log(`Proxy pentru imaginea: ${decodedUrl}`);
    
    // Facem un fetch la imaginea cerută
    const imageResponse = await fetch(decodedUrl);
    
    if (!imageResponse.ok) {
      console.error(`Eroare la preluarea imaginii: ${imageResponse.status} ${imageResponse.statusText}`);
      return res.status(imageResponse.status).json({ 
        error: `Eroare la preluarea imaginii: ${imageResponse.status} ${imageResponse.statusText}` 
      });
    }

    // Extragem tipul conținutului
    const contentType = imageResponse.headers.get('content-type');
    
    if (!contentType || !contentType.startsWith('image/')) {
      console.error(`Conținutul nu este o imagine: ${contentType}`);
      return res.status(400).json({ error: 'Conținutul nu este o imagine' });
    }
    
    // Obținem buffer-ul imaginii
    const imageBuffer = await imageResponse.buffer();
    
    // Setăm header-urile pentru a permite cross-origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cachează imaginile pentru 24 de ore
    
    // Trimitem imaginea
    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('Eroare la proxy-ul imaginii:', error);
    res.status(500).json({ error: 'Eroare internă la preluarea imaginii' });
  }
} 