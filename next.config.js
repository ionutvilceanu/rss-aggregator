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
      
      // Pentru deployment
      'vercel.app',
      'localhost',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Eliminăm header-ele problematice pentru deployment
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  // Optimizăm webpack pentru deployment
  webpack: (config, { isServer }) => {
    // Excludem dependențele problematice din bundle-ul client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
      };
    }

    // Excludem modulele native din bundle
    config.externals = config.externals || [];
    config.externals.push({
      'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
      'ffmpeg-static': 'commonjs ffmpeg-static',
    });

    return config;
  },
  // Configurări pentru deployment pe Vercel
  serverExternalPackages: [
    'ffmpeg-static',
    'fluent-ffmpeg',
    '@ffmpeg/ffmpeg',
    '@ffmpeg/core',
    'formidable'
  ],
}

module.exports = nextConfig 