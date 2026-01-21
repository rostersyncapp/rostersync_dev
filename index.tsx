
/**
 * POLYFILL: Must be at the absolute top to ensure process.env is available 
 * to all subsequent imports during their module evaluation phase.
 */
const _window = window as any;
if (typeof _window.process === 'undefined') {
  _window.process = { env: {} };
}
if (!_window.process.env) {
  _window.process.env = {};
}

// Ensure globalThis also has the shim for broader compatibility
(globalThis as any).process = _window.process;

// Robust environment variable detection and mapping to process.env.API_KEY
const detectAndShimApiKey = () => {
  try {
    // 1. Try Vite/ESM standard
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
      const key = metaEnv.API_KEY || metaEnv.VITE_API_KEY || metaEnv.NEXT_PUBLIC_API_KEY;
      if (key) _window.process.env.API_KEY = key;
    }
  } catch (e) { }

  // 2. Try common Vercel/Next.js client-side patterns if not already set
  if (!_window.process.env.API_KEY) {
    _window.process.env.API_KEY = _window.NEXT_PUBLIC_API_KEY || _window.VITE_API_KEY;
  }
};

detectAndShimApiKey();

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-8 font-sans">
          <div className="max-w-md w-full text-center">
            <div className="mb-6 text-red-500 flex justify-center">
              <AlertCircle size={64} />
            </div>
            <h1 className="text-2xl font-black mb-2 text-gray-900 dark:text-white tracking-tight">System Fault Detected</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium">
              A critical error occurred in the production pipeline. This is likely due to a missing configuration key or an environment mismatch.
            </p>
            {this.state.error && (
              <div className="bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl overflow-x-auto text-xs text-red-500 font-mono text-left border border-red-100 dark:border-red-900/30">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-3 bg-[#5B5FFF] text-white rounded-xl font-bold shadow-lg shadow-[#5B5FFF]/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Restart Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { ClerkProvider } from '@clerk/clerk-react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key (VITE_CLERK_PUBLISHABLE_KEY)");
}

// Global variable to store the root to prevent duplicate initialization during HMR
if (!(window as any)._reactRoot) {
  (window as any)._reactRoot = createRoot(rootElement);
}

const root = (window as any)._reactRoot;
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ClerkProvider>
  </React.StrictMode>
);
