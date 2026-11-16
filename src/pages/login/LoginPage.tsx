/**
 * Login page in the app style: the indigo band with the logo across the top,
 * then a plain white page with the form. Sign in is the one amber action; the
 * demo accounts are secondary buttons that fill the form.
 */
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DemoAccount {
  label: string;
  username: string;
  password: string;
  hint: string;
}

/** Mirrors the fixed/derived accounts seeded in src/lib/auth.ts. */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', username: 'admin', password: 'admin123', hint: 'Full access' },
  { label: 'HR', username: 'hr', password: 'hr123', hint: 'Full access' },
  { label: 'Manager', username: 'ahmad.faizal', password: 'manager123', hint: 'Engineering dept only' },
  { label: 'Employee', username: 'siti5', password: 'password123', hint: 'Own records only' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from && location.state.from !== '/login'
      ? (location.state as { from: string }).from
      : '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = login(username, password);
    setSubmitting(false);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
  };

  const fill = (acc: DemoAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 bg-bar px-4 py-3 text-bar-foreground sm:px-6">
        <img
          src={`${import.meta.env.BASE_URL}brand/asm-logo.png`}
          alt=""
          className="size-12 shrink-0 rounded-lg"
        />
        <div className="min-w-0">
          <p className="text-[1.15rem] font-bold leading-tight">ASM Tech HRMS</p>
          <p className="text-bar-subtle">Malaysian HR and payroll</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-8 px-4 py-8 sm:py-12">
        <section aria-labelledby="login-title" className="space-y-5">
          <div className="space-y-1">
            <h1 id="login-title" className="text-[1.6rem] font-bold leading-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your workspace to continue.</p>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border-2 border-destructive bg-danger-soft px-3 py-3 font-bold text-destructive"
              >
                <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-base font-bold">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="e.g. admin"
                className={cn(error && 'border-destructive')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-bold">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={cn(error && 'border-destructive')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting} disabledReason={false}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </section>

        <section aria-labelledby="login-demo" className="space-y-3 border-t pt-6">
          <h2 id="login-demo" className="text-[1.2rem] font-bold">Demo accounts: press one to fill the form</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.username}>
                <button
                  type="button"
                  onClick={() => fill(acc)}
                  aria-pressed={username === acc.username}
                  className={cn(
                    'min-h-12 w-full rounded-md border-2 border-primary bg-card px-3 py-2 text-left hover:bg-accent',
                    username === acc.username && 'bg-accent',
                  )}
                >
                  <span className="block font-bold text-primary">{acc.label}</span>
                  <span className="block text-muted-foreground">
                    {acc.username} · {acc.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Every seeded employee can also sign in as{' '}
            <span className="font-bold text-foreground">email-prefix / password123</span>
          </p>
          <p className="text-muted-foreground">
            Demo build: accounts are kept in this browser, no data leaves it.
          </p>
        </section>
      </main>
    </div>
  );
}
