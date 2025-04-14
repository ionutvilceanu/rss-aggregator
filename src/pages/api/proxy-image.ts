import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

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
    
    // Verificăm dacă este o imagine de placeholder și încercăm să folosim una locală
    if (decodedUrl.includes('placeholder.com')) {
      // Extragem parametrii din URL (culoare, text)
      const text = decodedUrl.includes('text=') ? 
        decodedUrl.split('text=')[1].split('&')[0].replace(/\+/g, ' ') : 
        'Sport News';
        
      // Determinăm ce tip de imagine de sport este bazat pe text
      let sportType = 'default_sport';
      const sportKeywords = {
        'fotbal': 'football',
        'baschet': 'basketball',
        'tenis': 'tennis',
        'box': 'boxing',
        'kickbox': 'boxing'
      };
      
      // Verificăm ce cuvinte cheie sportive sunt în text
      for (const [keyword, sportImage] of Object.entries(sportKeywords)) {
        if (text.toLowerCase().includes(keyword)) {
          sportType = sportImage;
          break;
        }
      }
      
      // Căile către imaginile locale
      const localImagePath = path.join(process.cwd(), 'public', 'images', 'sport', `${sportType}.jpg`);
      const defaultImagePath = path.join(process.cwd(), 'public', 'images', 'sport', 'default_sport.jpg');
      
      // Verificăm dacă imaginea specifică sportului există
      if (fs.existsSync(localImagePath)) {
        const imageBuffer = fs.readFileSync(localImagePath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(imageBuffer);
      } 
      // Verificăm dacă avem măcar imaginea default
      else if (fs.existsSync(defaultImagePath)) {
        const imageBuffer = fs.readFileSync(defaultImagePath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(imageBuffer);
      }
      // Dacă nu avem imagini locale, încercăm un alt serviciu
      else {
        // Încercăm un serviciu alternativ pentru placeholder
        const alternativeUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
        try {
          const altResponse = await fetch(alternativeUrl);
          if (altResponse.ok) {
            const contentType = altResponse.headers.get('content-type') || 'image/jpeg';
            const imageBuffer = await altResponse.buffer();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.status(200).send(imageBuffer);
          }
        } catch (error) {
          console.error('Eroare la serviciul alternativ de imagini:', error);
          // Continuăm cu încercarea URL-ului original
        }
      }
    }
    
    // Facem un fetch la imaginea cerută (URL-ul original)
    const imageResponse = await fetch(decodedUrl);
    
    if (!imageResponse.ok) {
      console.error(`Eroare la preluarea imaginii: ${imageResponse.status} ${imageResponse.statusText}`);
      
      // Încercăm o imagine alternativă din alt serviciu
      const alternativeUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
      try {
        const altResponse = await fetch(alternativeUrl);
        if (altResponse.ok) {
          const contentType = altResponse.headers.get('content-type') || 'image/jpeg';
          const imageBuffer = await altResponse.buffer();
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.status(200).send(imageBuffer);
        }
      } catch (alternativeError) {
        console.error('Eroare la serviciul alternativ de imagini:', alternativeError);
      }
      
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
    
    // Încercăm să returnăm o imagine alternativă
    try {
      const alternativeUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
      const altResponse = await fetch(alternativeUrl);
      
      if (altResponse.ok) {
        const contentType = altResponse.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = await altResponse.buffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(imageBuffer);
      }
    } catch (alternativeError) {
      console.error('Eroare și la serviciul alternativ de imagini:', alternativeError);
    }
    
    res.status(500).json({ error: 'Eroare internă la preluarea imaginii' });
  }
} 