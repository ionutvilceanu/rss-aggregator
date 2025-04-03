import { NextApiRequest, NextApiResponse } from 'next';
import { deleteCookie } from 'cookies-next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Acceptă doar metoda POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodă nepermisă' });
  }

  // Șterge cookie-ul
  deleteCookie('auth-token', { req, res, path: '/' });

  return res.status(200).json({ success: true, message: 'Delogare reușită' });
} 