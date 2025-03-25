/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // Domenii internaționale
      'www.gazzetta.it',
      'e00-marca.uecdn.es',
      'www.mundodeportivo.com',
      'icsoft.go.ro',
      'assets.diariodeibiza.es',
      'www.eltiempo.com',
      'img.europapress.es',
      'images.daznservices.com',
      'cdn.vox-cdn.com',
      'media.tenor.com',
      'phantom-marca.unidadeditorial.es',
      'static.eldiario.es',
      
      // Domenii românești de știri sportive
      'www.prosport.ro',
      'prosport.ro',
      'www.gsp.ro',
      'gsp.ro',
      'media.gsp.ro',
      'static.gsp.ro',
      'www.digisport.ro',
      'digisport.ro',
      'media.digisport.ro',
      'www.sport.ro',
      'sport.ro',
      'static.sport.ro',
      
      // Domenii pentru servicii de imagini
      'i.imgur.com',
      'imgur.com',
      'cloudinary.com',
      'res.cloudinary.com',
      'upload.wikimedia.org',
      'images.unsplash.com',
      'unsplash.com',
      
      // Adăugați domeniul serverului vostru de hosting aici
      'vercel.app',
      'localhost',
      
      // Pentru a permite orice domeniu (ATENȚIE: folosiți doar în dezvoltare sau pentru testare)
      // '*',
    ],
    // Opțional: Permite URL-uri de imagini generate dinamic
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite orice subdomeniu
      },
    ],
  },
}

module.exports = nextConfig 