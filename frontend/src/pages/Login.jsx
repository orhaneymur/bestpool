import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Waves, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@havuz.local');
  const [password, setPassword] = useState('Admin123!');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      nav('/');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-[100px]" />
        <div className="absolute -right-20 bottom-0 h-[380px] w-[380px] rounded-full bg-indigo-500/20 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.12),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8"
      >
        <div className="px-1 text-white lg:px-4">
          <div className="mb-5 flex items-center gap-3 lg:mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-300/30 lg:h-12 lg:w-12">
              <Waves className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight lg:text-lg">
                Four Seasons Pool Management
              </div>
              <div className="text-sm text-slate-400">Contract Studio</div>
            </div>
          </div>
          <h1 className="max-w-md text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Produce commercial pool contracts in minutes.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base lg:mt-4">
            Manage facility details, season hours, staffing, and payment calendars — with a live PDF preview.
          </p>
          <div className="mt-5 hidden items-center gap-2 text-sm text-slate-400 lg:mt-8 lg:flex">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            Role-based access · JWT security
          </div>
        </div>

        <Card className="border-white/10 bg-white/95 shadow-paper backdrop-blur">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription>Authenticate to continue to proposals and customers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {err && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {err}
                </div>
              )}

              <Button type="submit" variant="accent" className="w-full gap-2" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
