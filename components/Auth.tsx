
import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { X, Ghost, Database } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase.ts';

interface AuthProps {
  initialView?: 'signin' | 'signup';
  onClose?: () => void;
  onGuestLogin?: () => void;
  darkMode?: boolean;
}

const Auth: React.FC<AuthProps> = ({ initialView = 'signin', onClose, onGuestLogin, darkMode = false }) => {
  const [view] = useState<'signin' | 'signup'>(initialView === 'signup' ? 'signup' : 'signin');

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

  return (
    <div className="relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer z-[60]"
        >
          <X size={20} />
        </button>
      )}

      <div className="flex flex-col items-center">
        {view === 'signin' ? (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SignIn
              routing="hash"
              appearance={{
                baseTheme: darkMode ? dark : undefined,
                elements: {
                  rootBox: "w-full",
                  card: "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl rounded-3xl",
                  headerTitle: "text-2xl font-black tracking-tight text-gray-900 dark:text-white",
                  headerSubtitle: "text-gray-500 dark:text-gray-400",
                  socialButtonsBlockButton: "rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
                  formButtonPrimary: "bg-[#5B5FFF] hover:bg-[#4a4edb] rounded-xl py-3 text-sm font-bold shadow-lg shadow-[#5B5FFF]/20",
                  footerActionLink: "text-[#5B5FFF] font-bold hover:underline"
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SignUp
              routing="hash"
              appearance={{
                baseTheme: darkMode ? dark : undefined,
                elements: {
                  rootBox: "w-full",
                  card: "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl rounded-3xl",
                  headerTitle: "text-2xl font-black tracking-tight text-gray-900 dark:text-white",
                  headerSubtitle: "text-gray-500 dark:text-gray-400",
                  socialButtonsBlockButton: "rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
                  formButtonPrimary: "bg-[#5B5FFF] hover:bg-[#4a4edb] rounded-xl py-3 text-sm font-bold shadow-lg shadow-[#5B5FFF]/20",
                  footerActionLink: "text-[#5B5FFF] font-bold hover:underline"
                }
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default Auth;
