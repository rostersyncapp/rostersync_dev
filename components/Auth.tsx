
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase.ts';
import { Loader2, Mail, Lock, ShieldCheck, UserPlus, LogIn, X, Ghost, Database, User, Building2, Key, ArrowLeft, HelpCircle, CheckCircle2 } from 'lucide-react';

interface AuthProps {
  initialView?: 'signin' | 'signup' | 'forgot_password' | 'update_password';
  onClose?: () => void;
  onGuestLogin?: () => void;
}

const Auth: React.FC<AuthProps> = ({ initialView = 'signin', onClose, onGuestLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // New Fields for Sign Up / Update
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'signin' | 'signup' | 'forgot_password' | 'update_password'>(initialView);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    setView(initialView);
    setMessage(null);
  }, [initialView]);

  // Reset fields when toggling view
  useEffect(() => {
    if (view === 'signup') {
      setFullName('');
      setConfirmPassword('');
      setOrganizationName('');
    }
    if (view !== 'update_password') {
      setMessage(null);
    }
  }, [view]);

  // 1. GUEST MODE VIEW (Backend not configured)
  if (!isSupabaseConfigured) {
    return (
      <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-300 relative text-center">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        )}

        <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700">
           <Ghost size={32} />
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight mb-3 text-gray-900 dark:text-white">Guest Demo Mode</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed px-4">
          This environment does not have a database configured. You can explore the full application interface and features in <strong>Guest Mode</strong>.
        </p>

        {onGuestLogin && (
          <button 
            onClick={onGuestLogin}
            className="w-full py-4 rounded-2xl primary-gradient text-white font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-[#5B5FFF]/20 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Ghost size={20} />
            Enter Guest Mode
          </button>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
           <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-800/50 py-2 rounded-lg">
             <Database size={12} />
             <span>Backend Disconnected</span>
           </div>
        </div>
      </div>
    );
  }

  // 2. STANDARD AUTH VIEW (Backend configured)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (view === 'signup') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              organization_name: organizationName
            }
          }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
      } else if (view === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (view === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Reset link sent! Please check your email inbox.' });
      } else if (view === 'update_password') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password updated successfully! Redirecting...' });
        setTimeout(() => {
            if (onClose) onClose();
        }, 1500);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Authentication failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer z-10"
        >
          <X size={20} />
        </button>
      )}

      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl primary-gradient mx-auto mb-4 flex items-center justify-center text-white shadow-lg shadow-[#5B5FFF]/20">
          {view === 'signup' && <UserPlus size={28} />}
          {view === 'signin' && <ShieldCheck size={28} />}
          {view === 'forgot_password' && <Key size={28} />}
          {view === 'update_password' && <Lock size={28} />}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {view === 'signup' && 'Create Workspace'}
          {view === 'signin' && 'Welcome Back'}
          {view === 'forgot_password' && 'Reset Password'}
          {view === 'update_password' && 'New Password'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium leading-tight">
          {view === 'signup' && 'Join RosterSync for cloud-ready metadata.'}
          {view === 'signin' && 'Log in to your production dashboard.'}
          {view === 'forgot_password' && 'Get back into your workspace.'}
          {view === 'update_password' && 'Choose a strong, secure password.'}
        </p>
      </div>

      <div className="space-y-4">
        <form onSubmit={handleAuth} className="space-y-4">
          {/* Sign Up Specific Fields */}
          {view === 'signup' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none font-medium transition-all text-gray-900 dark:text-white"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          {(view !== 'update_password') && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none font-medium transition-all text-gray-900 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {view === 'signup' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Organization</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none font-medium transition-all text-gray-900 dark:text-white"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            </div>
          )}

          {view !== 'forgot_password' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                  {view === 'update_password' ? 'New Password' : 'Password'}
                </label>
                {view === 'signin' && (
                  <button 
                    type="button"
                    onClick={() => setView('forgot_password')}
                    className="text-[10px] font-bold text-[#5B5FFF] hover:underline uppercase tracking-widest font-mono cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none font-medium transition-all text-gray-900 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {(view === 'signup' || view === 'update_password') && (
            <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none font-medium transition-all text-gray-900 dark:text-white"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {message && (
            <div className={`p-3 rounded-xl text-xs font-bold font-mono flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30'}`}>
              {message.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <X size={14} className="shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          )}

          <button 
            disabled={isLoading}
            className="w-full py-4 rounded-2xl primary-gradient text-white font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-[#5B5FFF]/20 transition-all disabled:opacity-50 cursor-pointer mt-2"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {view === 'signup' && <><UserPlus size={18}/> Create Account</>}
                {view === 'signin' && <><LogIn size={18}/> Log In</>}
                {view === 'forgot_password' && <><Mail size={18}/> Send Reset Link</>}
                {view === 'update_password' && <><CheckCircle2 size={18}/> Update Password</>}
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4 text-center">
        {view === 'forgot_password' || view === 'update_password' ? (
          <button 
            type="button"
            onClick={() => setView('signin')}
            className="flex items-center justify-center gap-2 mx-auto text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-[#5B5FFF] transition-colors uppercase tracking-widest font-mono cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Log In
          </button>
        ) : (
          <button 
            type="button"
            onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
            className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-[#5B5FFF] transition-colors uppercase tracking-widest font-mono cursor-pointer"
          >
            {view === 'signin' ? 'New to RosterSync? Create Workspace' : 'Already have an account? Log In'}
          </button>
        )}

        {view === 'forgot_password' && (
          <div className="pt-6 border-t border-gray-50 dark:border-gray-800">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 leading-relaxed px-4">
              For security, we don't confirm if an email exists. If you don't receive a link within 2 minutes:
            </p>
            <a 
              href="mailto:support@rostersync.io"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B5FFF] hover:underline"
            >
              <HelpCircle size={14} /> Contact Support
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
