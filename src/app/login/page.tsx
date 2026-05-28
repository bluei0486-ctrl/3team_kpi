'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.success) {
      router.push('/'); // 로그인 성공 시 메인 대시보드로 이동
      router.refresh();
    } else {
      setError(result.message || '로그인 실패');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', width: '48px', height: '48px', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', margin: '0 auto 16px' }}>
            3
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>3팀 영업 실적 플랫폼</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '8px' }}>관리자 계정으로 로그인해 주세요.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>아이디</label>
            <input type="text" name="username" required style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="아이디를 입력하세요" />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>비밀번호</label>
            <input type="password" name="password" required style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="비밀번호를 입력하세요" />
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: '0.85rem', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={isLoading} style={{ marginTop: '12px', backgroundColor: '#1e3a8a', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'wait' : 'pointer', transition: 'background-color 0.2s' }}>
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
