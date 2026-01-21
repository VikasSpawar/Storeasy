'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // New state for signup success
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        // LOGIN logic
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/'); 
      } else {
        // SIGNUP logic
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg('Confirmation email sent! Please check your inbox.');
        setIsLogin(true); // Switch back to login view
        setEmail('');     // Clear fields
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1e1e24]/80 backdrop-blur-xl border border-[#2a2a30] p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
      
      {/* Header Text */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          {isLogin ? 'Enter your details to access your files.' : 'Start your secure storage journey today.'}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wide">Email Address</label>
          <div className="relative group">
            <Mail className="absolute left-3 top-3 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#121216] border border-[#2a2a30] text-white text-sm rounded-lg py-2.5 pl-10 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-gray-600"
              required
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wide">Password</label>
          <div className="relative group">
            <Lock className="absolute left-3 top-3 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#121216] border border-[#2a2a30] text-white text-sm rounded-lg py-2.5 pl-10 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-gray-600"
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-in slide-in-from-top-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm animate-in slide-in-from-top-2">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : (
            <>
              {isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      {/* Toggle Footer */}
      <div className="mt-6 pt-6 border-t border-[#2a2a30] text-center">
        <p className="text-gray-500 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccessMsg('');
            }}
            className="ml-2 text-primary hover:text-white font-medium transition-colors hover:underline"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}