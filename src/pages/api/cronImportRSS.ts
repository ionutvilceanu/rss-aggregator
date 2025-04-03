import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificăm cheia API pentru securitate
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedApiKey = process.env.CRON_API_KEY || 'secure_cron_key';
  
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ 
      error: 'Acces neautorizat. Api key invalidă sau lipsă.'
    });
  }

  try {
    // Apelăm endpoint-ul de import, dar prin server-side (nu prin fetch client)
    // Acest lucru ne permite să reutilizăm logica existentă
    const importModule = await import('./importRSS');
    const importHandler = importModule.default;
    
    // Creăm un obiect req și res mimic pentru a apela handler-ul
    const mockReq = {
      method: 'POST',
      headers: {
        'x-api-key': apiKey
      },
      query: {}
    } as unknown as NextApiRequest;
    
    // Obiect pentru a captura răspunsul
    let responseData: any = null;
    let responseStatus = 200;
    
    const mockRes = {
      status: (status: number) => {
        responseStatus = status;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        return mockRes;
      }
    } as unknown as NextApiResponse;
    
    // Apelăm handler-ul de import
    await importHandler(mockReq, mockRes);
    
    // Returnăm răspunsul
    return res.status(responseStatus).json({
      ...responseData,
      cronTimestamp: new Date().toISOString(),
      message: `Cron executat cu succes: ${responseData?.message || 'Import terminat'}`
    });
  } catch (error) {
    console.error('Eroare în cronImportRSS:', error);
    return res.status(500).json({ 
      error: 'Eroare la procesarea cron-ului pentru importul RSS',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    });
  }
} 