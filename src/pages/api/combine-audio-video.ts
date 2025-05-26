import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import ffmpeg from 'fluent-ffmpeg';

// Dezactivăm body parser-ul implicit pentru a putea primi fișiere
export const config = {
  api: {
    bodyParser: false,
  }
};

// Promisificăm funcțiile pentru a putea folosi async/await
const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const mkdirPromise = promisify(fs.mkdir);

// Funcție pentru combinarea audio-video
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisă. Folosiți POST.' });
  }

  try {
    // Directorul temporar pentru fișiere
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // Creăm directorul dacă nu există
    try {
      await mkdirPromise(tempDir, { recursive: true });
    } catch (err) {
      console.log('Directorul există deja sau nu poate fi creat:', err);
    }

    // ID-uri unice pentru fișiere
    const videoId = uuidv4();
    const audioId = uuidv4();
    const outputId = uuidv4();

    // Căi pentru fișiere
    const videoPath = path.join(tempDir, `${videoId}.webm`);
    const audioPath = path.join(tempDir, `${audioId}.mp3`);
    const outputPath = path.join(tempDir, `${outputId}.mp4`);

    // Parsăm fișierele din request
    const form = new formidable.IncomingForm({
      uploadDir: tempDir,
      keepExtensions: true,
      multiples: true,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Verificăm dacă avem fișierele necesare
    if (!files.video || !files.audio) {
      return res.status(400).json({ error: 'Lipsesc fișierele video sau audio' });
    }

    // Obținem căile temporare
    const videoTempPath = Array.isArray(files.video) ? files.video[0].filepath : files.video.filepath;
    const audioTempPath = Array.isArray(files.audio) ? files.audio[0].filepath : files.audio.filepath;

    // Copiem fișierele în locația dorită
    await fs.promises.copyFile(videoTempPath, videoPath);
    await fs.promises.copyFile(audioTempPath, audioPath);

    // Combinăm audio și video folosind FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
        .save(outputPath)
        .on('end', () => {
          console.log('Procesare terminată');
          resolve();
        })
        .on('error', (err) => {
          console.error('Eroare la procesare:', err);
          reject(err);
        });
    });

    // Verificăm că fișierul a fost creat
    if (!fs.existsSync(outputPath)) {
      throw new Error('Fișierul rezultat nu a fost creat');
    }

    // Citim fișierul rezultat
    const outputBuffer = await fs.promises.readFile(outputPath);

    // Curățăm fișierele temporare
    try {
      await Promise.all([
        unlinkPromise(videoPath),
        unlinkPromise(audioPath),
        unlinkPromise(outputPath),
        unlinkPromise(videoTempPath),
        unlinkPromise(audioTempPath),
      ]);
    } catch (err) {
      console.error('Eroare la ștergerea fișierelor temporare:', err);
    }

    // Setăm header-ele pentru răspuns
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="combined-${outputId}.mp4"`);
    
    // Trimitem fișierul rezultat
    res.status(200).send(outputBuffer);
  } catch (error) {
    console.error('Eroare la combinarea audio-video:', error);
    res.status(500).json({ error: 'Eroare la procesarea fișierelor' });
  }
} 