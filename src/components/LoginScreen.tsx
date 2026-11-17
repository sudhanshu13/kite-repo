import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import type { AuthUser } from '../../shared/types.ts';
import { KiteLogo } from './KiteLogo.tsx';

interface LoginScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAuthenticated: (user: AuthUser, token?: string) => void;
}

export function LoginScreen({
  theme,
  onToggleTheme,
  onAuthenticated,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState('KT8492');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('kitedemo');
  const [pin, setPin] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { userId, password, pin }
          : { userId, userName, password, pin };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || 'Authentication failed.');
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = (await res.json()) as {
        user?: AuthUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || 'Demo login failed.');
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-demo', { method: 'POST' });
      const data = (await res.json()) as {
        user?: AuthUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || 'Admin login failed.');
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F9F9F9] dark:bg-[#121212] text-[#444444] dark:text-[#E0E0E0] px-4 py-6">
      <div className="max-w-md w-full mx-auto flex justify-end">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722] dark:hover:text-[#FF5722] border border-[#E0E0E0] dark:border-[#282828] bg-white dark:bg-[#181818] rounded transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>

      <main className="max-w-[390px] w-full mx-auto my-auto bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <KiteLogo variant="app" className="w-12 h-12 mb-3" />
          <h1 className="text-[22px] font-normal text-[#444444] dark:text-[#E0E0E0] tracking-tight">
            {mode === 'login' ? 'Login to Kite' : 'Create Sandbox ID'}
          </h1>
          <p className="text-xs text-[#9B9B9B] dark:text-[#8C8C8C] mt-1">
            Technical analysis & simulated paper portfolio terminal
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 px-3 py-2.5 text-xs text-[#DF514C] dark:text-[#F87171] bg-[#DF514C]/10 border border-[#DF514C]/30 rounded"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="kite-user-id"
              className="block text-xs font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
            >
              Client ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="kite-user-id"
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value.toUpperCase())}
                placeholder="e.g. KT8492"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] font-mono-num"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="kite-user-name"
                className="block text-xs font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
              >
                Full Name
              </label>
              <input
                id="kite-user-name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="kite-password"
              className="block text-xs font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="kite-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="kite-pin"
              className="block text-xs font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
            >
              6-Digit Security PIN (2FA)
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="kite-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] font-mono-num tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#FF5722] hover:bg-[#E64A19] disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors cursor-pointer"
          >
            {loading
              ? 'Authenticating...'
              : mode === 'login'
                ? 'Login'
                : 'Create Sandbox Account'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-[#EEEEEE] dark:border-[#282828] space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleDemoLogin}
              className="py-2 px-2.5 border border-[#4184F3] text-[#4184F3] hover:bg-[#4184F3]/10 text-[11px] font-semibold rounded transition-colors cursor-pointer"
            >
              Trader Demo (KT8492)
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleAdminDemoLogin}
              className="py-2 px-2.5 border border-[#E0E0E0] dark:border-[#333333] text-[#444444] dark:text-[#E0E0E0] hover:border-[#FF5722] hover:text-[#FF5722] text-[11px] font-semibold rounded transition-colors cursor-pointer"
            >
              Admin Login (AD0001)
            </button>
          </div>

          <div className="text-center text-xs text-[#9B9B9B] dark:text-[#8C8C8C]">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setUserId('');
                  setPassword('');
                  setPin('');
                  setError(null);
                }}
                className="hover:text-[#FF5722] transition-colors cursor-pointer"
              >
                New to Kite Sandbox? Create a Client ID
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setUserId('KT8492');
                  setPassword('kitedemo');
                  setPin('123456');
                  setError(null);
                }}
                className="hover:text-[#FF5722] transition-colors cursor-pointer"
              >
                Already have a Client ID? Sign in
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-lg mx-auto text-center text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] leading-relaxed">
        Paper trading &amp; technical analysis environment. Orders and portfolio P&amp;L are
        simulated with virtual margin — no real funds are debited or traded.
      </footer>
    </div>
  );
}
