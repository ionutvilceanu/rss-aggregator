import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filename } = req.query;
  
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Numele fișierului este necesar' });
  }

  try {
    // Construim calea către fișierul video în directorul temporar
    const tempDir = path.join(os.tmpdir(), 'rss-aggregator');
    const filePath = path.join(tempDir, filename);

    // Verificăm calea alternativă în directorul public
    const publicPath = path.join(process.cwd(), 'public', 'videos', filename);

    // Determinăm calea corectă a fișierului
    let videoPath = '';
    if (fs.existsSync(filePath)) {
      videoPath = filePath;
    } else if (fs.existsSync(publicPath)) {
      videoPath = publicPath;
    } else {
      console.error(`Fișierul video nu a fost găsit: ${filePath} sau ${publicPath}`);
      return res.status(404).json({ error: 'Fișierul video nu a fost găsit' });
    }

    // Determinăm tipul MIME al fișierului
    const fileExtension = path.extname(videoPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo'
    };

    const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
    
    // Statistici despre fișier
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    // Gestionăm range requests pentru streaming video
    const range = req.headers.range;
    
    // Dacă nu avem range request, servim fișierul întreg
    if (!range) {
      console.log(`Servim fișierul video întreg: ${videoPath}, dimensiune: ${fileSize} bytes`);
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(videoPath).pipe(res);
      return;
    }
    
    // Dacă avem range request, procesăm range-ul
    // Range-ul are format "bytes=start-end", exemplu "bytes=0-1023"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    // Dacă fișierul este foarte mic, servim tot fișierul
    if (fileSize < 1024) {
      console.log(`Fișier video mic (${fileSize} bytes), servim tot fișierul`);
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(videoPath).pipe(res);
      return;
    }
    
    const chunkSize = end - start + 1;
    console.log(`Servim range pentru video: ${start}-${end}/${fileSize}, chunk size: ${chunkSize} bytes`);
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    
    const stream = fs.createReadStream(videoPath, { start, end });
    stream.pipe(res);
  } catch (error) {
    console.error('Eroare la servirea videoclipului:', error);
    return res.status(500).json({ error: 'Eroare internă la servirea videoclipului' });
  }
} 