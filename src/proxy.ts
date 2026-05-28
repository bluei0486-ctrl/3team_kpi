import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  // 사용자의 브라우저 쿠키 확인
  const authCookie = req.cookies.get('team_auth');
  const url = req.nextUrl;

  // 1. 이미 로그인 페이지에 있다면 무한 루프 방지를 위해 통과
  if (url.pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // 2. 쿠키에 로그인 인증 정보가 없으면 /login 페이지로 강제 이동
  if (authCookie?.value !== 'authenticated') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 3. 인증되었으면 원래 가려던 페이지로 통과
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
