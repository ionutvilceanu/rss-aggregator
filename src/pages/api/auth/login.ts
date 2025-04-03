import { NextApiRequest, NextApiResponse } from 'next';
import { setCookie } from 'cookies-next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Acceptă doar metoda POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodă nepermisă' });
  }

  const { username, password } = req.body;

  // Verificare simplă a credențialelor
  // În producție, ai folosi o bază de date și hash-uri pentru parole
  if (username === 'admin' && password === 'parola123') {
    // Creează un cookie simplu de sesiune
    const sessionToken = 'admin-session-token';
    
    // Setează cookie-ul
    setCookie('auth-token', sessionToken, { 
      req, 
      res, 
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      maxAge: 60 * 60 * 24 * 7, // 1 săptămână
      path: '/',
    });

    return res.status(200).json({ success: true });
  }

  // Credențiale invalide
  return res.status(401).json({ success: false, message: 'Credențiale invalide' });
} 