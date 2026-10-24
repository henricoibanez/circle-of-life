import { Suspense } from 'react';
import { LoginScreen } from './login-screen';

export const metadata = { title: 'Entrar · Circle of Life' };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
