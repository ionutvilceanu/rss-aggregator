import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { buffer } from 'micro';
import ffmpegPath from 'ffmpeg-static';

// Convertim exec în promisiune pentru a putea folosi async/await
const execAsync = promisify(exec);

// Directorul pentru fisiere temporare
const TMP_DIR = path.join(process.cwd(), 'public', 'tmp');

// Asigurăm că directorul temporar există
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Verificăm că avem o cale validă către FFmpeg
if (!ffmpegPath) {
  console.error('EROARE: Nu s-a putut găsi calea către FFmpeg. Pachetul ffmpeg-static este instalat?');
  process.exit(1);
}

console.log('Folosim FFmpeg de la calea:', ffmpegPath);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisă' });
  }

  try {
    // Citim datele din request
    const buf = await buffer(req);
    const data = JSON.parse(buf.toString());
    
    // Extragem datele necesare
    const { imageData, effect = 'fade', duration = 5 } = data;
    
    if (!imageData) {
      return res.status(400).json({ error: 'Date lipsă: imageData este obligatoriu' });
    }

    // Generăm un ID unic pentru fișierele temporare
    const uniqueId = uuidv4();
    const inputImagePath = path.join(TMP_DIR, `${uniqueId}-input.jpeg`);
    const outputVideoPath = path.join(TMP_DIR, `${uniqueId}-output.mp4`);
    const publicVideoPath = `/tmp/${uniqueId}-output.mp4`;
    
    // Convertim base64 în imagine
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');
    fs.writeFileSync(inputImagePath, Buffer.from(base64Data, 'base64'));
    
    // Definim efectele disponibile cu parametri ffmpeg
    const effects = {
      fade: `fade=in:0:25,fade=out:${(duration * 30) - 25}:25`,
      zoom: `zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 30}:s=1080x1920`,
      slideUp: `crop=w=iw:h=ih:x=0:y='min(0,ih-t*20)':enable='between(t,0,${duration})'`,
      slideRight: `crop=w=iw:h=ih:x='min(0,iw-t*20)':y=0:enable='between(t,0,${duration})'`,
      pulse: `crop=iw:ih:x=0:y=0,scale=w='iw+40*sin(t)':h='ih+20*sin(t)'`,
    };
    
    // Selectăm efectul sau folosim fade ca valoare implicită
    const selectedEffect = effects[effect as keyof typeof effects] || effects.fade;
    
    // Construim comanda ffmpeg folosind calea exactă către binarul ffmpeg
    const ffmpegCommand = `"${ffmpegPath}" -y -loop 1 -i "${inputImagePath}" -t ${duration} -vf "${selectedEffect},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:color=black" -c:v libx264 -pix_fmt yuv420p -preset ultrafast -shortest "${outputVideoPath}"`;
    
    console.log('Executăm comanda FFmpeg:', ffmpegCommand);
    
    // Executăm comanda ffmpeg
    await execAsync(ffmpegCommand);
    
    // Verificăm dacă fișierul a fost generat
    if (!fs.existsSync(outputVideoPath)) {
      throw new Error('Generarea video a eșuat');
    }
    
    // Returnăm calea către videoclip
    res.status(200).json({ 
      success: true, 
      videoUrl: publicVideoPath
    });
    
    // Programăm ștergerea fișierelor după 1 oră
    setTimeout(() => {
      try {
        if (fs.existsSync(inputImagePath)) fs.unlinkSync(inputImagePath);
        if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
      } catch (err) {
        console.error('Eroare la ștergerea fișierelor temporare:', err);
      }
    }, 3600000); // 1 oră
    
  } catch (error) {
    console.error('Eroare la generarea video:', error);
    res.status(500).json({ error: 'Eroare la procesarea video' });
  }
} 