import { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Part, File } from 'formidable';
import fs from 'fs';
import path from 'path';

// Dezactivăm bodyParser implicit pentru a permite formidable să proceseze formularele
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodă nepermisă' });
  }

  try {
    // Creăm directorul pentru încărcări dacă nu există
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (mkdirError) {
      console.error('Eroare la crearea directorului de încărcări:', mkdirError);
      return res.status(500).json({ message: 'Eroare la pregătirea serverului pentru încărcări' });
    }

    // Configurăm formidable pentru a procesa încărcarea
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFiles: 1,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filter: (part: Part) => {
        // Acceptăm doar imagini
        return part.mimetype?.includes('image/') || false;
      },
    });

    // Procesăm încărcarea
    const result: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });

    // Verificăm dacă avem un fișier
    const fileField = result.files.file;
    if (!fileField) {
      return res.status(400).json({ message: 'Nu s-a încărcat nicio imagine validă' });
    }

    // Transformăm în array dacă nu este deja
    const files = Array.isArray(fileField) ? fileField : [fileField];
    if (files.length === 0) {
      return res.status(400).json({ message: 'Nu s-a încărcat nicio imagine validă' });
    }

    const file = files[0] as File;

    // Obținem numele fișierului
    const fileName = path.basename(file.originalFilename || 'image');
    
    // Redenumim și mutăm fișierul în locația finală
    const fileExt = path.extname(file.originalFilename || '.jpg');
    const uniqueFileName = `${Date.now()}-${fileName}${fileExt}`;
    const finalFilePath = path.join(uploadDir, uniqueFileName);
    
    try {
      await fs.promises.rename(file.filepath, finalFilePath);
    } catch (renameError) {
      console.error('Eroare la redenumirea fișierului:', renameError);
      try {
        // În caz de eroare, încercăm să ștergem fișierul temporar
        await fs.promises.unlink(file.filepath);
      } catch (unlinkError) {
        console.error('Eroare la ștergerea fișierului temporar:', unlinkError);
      }
      return res.status(500).json({ message: 'Eroare la salvarea imaginii' });
    }

    // Construim URL-ul pentru acces public
    const fileUrl = `/uploads/${uniqueFileName}`;

    // Returnăm URL-ul imaginii
    return res.status(201).json({
      url: fileUrl,
      message: 'Imagine încărcată cu succes',
    });
  } catch (error) {
    console.error('Eroare la procesarea încărcării:', error);
    return res.status(500).json({ message: 'Eroare internă server' });
  }
} 