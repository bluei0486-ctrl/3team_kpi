'use server';

import { cookies } from 'next/headers';

export async function loginAction(formData: FormData) {
  const user = formData.get('username');
  const pwd = formData.get('password');

  // .env.local에 설정한 값과 일치하는지 확인
  if (
    user === process.env.BASIC_AUTH_USER &&
    pwd === process.env.BASIC_AUTH_PASSWORD
  ) {
    // 맞으면 브라우저에 쿠키 생성 (1주일간 유지)
    const cookieStore = await cookies();
    cookieStore.set('team_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });
    return { success: true };
  } else {
    return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
  }
}
