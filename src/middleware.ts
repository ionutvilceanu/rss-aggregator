import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Verifică dacă ruta este pentru pagina de administrare
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Obține tokenul din cookie
    const token = request.cookies.get('auth-token')?.value;

    // Dacă nu există token, redirecționează la pagina de login
    if (!token || token !== 'admin-session-token') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Continuă cu cererea pentru toate celelalte rute
  return NextResponse.next();
}

// Configurează rutele pe care se aplică middleware
export const config = {
  matcher: ['/admin/:path*'],
}; 