import { NextResponse, type NextRequest } from 'next/server';

/** Páginas que qualquer pessoa pode abrir, sem estar logada. */
const PUBLIC = [/^\/login$/, /^\/convite\//, /^\/termos$/];

/**
 * Checagem rápida antes de abrir cada página: sem o cookie de sessão,
 * vai para o login. A conferência de verdade (cookie válido) é feita
 * pela API em cada pedido de dados.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has('col_session');
  const isPublic = PUBLIC.some(p => p.test(pathname));

  if (!hasSession && !isPublic) return NextResponse.redirect(new URL('/login', request.url));
  if (hasSession && pathname === '/login' && !request.nextUrl.searchParams.has('erro')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Não passa pela checagem: a API (/api), arquivos do Next e arquivos com extensão (ícones, imagens).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
