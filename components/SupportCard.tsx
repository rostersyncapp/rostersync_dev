import React, { useState } from 'react';
import { MessageCircle, Send, Loader2, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../services/supabase.ts';

interface SupportCardProps {
    darkMode?: boolean;
    onClose?: () => void;
}

const SupportCard: React.FC<SupportCardProps> = ({ darkMode, onClose }) => {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');

        try {
            const { error } = await supabase.functions.invoke('resend-email', {
                body: {
                    table: 'support_tickets',
                    record: {
                        id: crypto.randomUUID(), // Unique ID for the ticket
                        name: form.name,
                        email: form.email,
                        user_email: form.email, // Edge function checks both
                        message: form.message,
                        created_at: new Date().toISOString()
                    }
                },
            });

            if (error) throw error;
            setStatus('success');
            setForm({ name: '', email: '', message: '' });
        } catch (err) {
            console.error('Support error:', err);
            setStatus('error');
        }
    };

    return (
        <div className="w-full h-full min-h-[420px] shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col relative group">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full transition-all text-white/70 hover:text-white"
                >
                    <X size={20} />
                </button>
            )}

            {/* Top - Brand & Info */}
            <div className="bg-[#5B5FFF] p-8 text-white flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
                        <MessageCircle size={32} className="text-white" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            We're here to help.
                        </h2>
                        <p className="text-blue-100 text-base font-medium leading-relaxed max-w-2xl">
                            Running into issues? Drop us a line and we'll get back to you ASAP.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-6 flex items-center gap-3 text-sm font-bold opacity-80">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>Typical reply time: &lt; 2 hours</span>
                </div>
            </div>

            {/* Bottom - Form */}
            <div className="bg-white dark:bg-gray-900 p-6 md:p-8 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Send a Message</h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Name</label>
                            <input
                                type="text"
                                required
                                placeholder="Your full name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                type="email"
                                required
                                placeholder="your@email.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Message</label>
                        <textarea
                            required
                            rows={3}
                            placeholder="What can we help you with?"
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all resize-none placeholder:text-gray-400"
                        />
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {status === 'success' ? (
                            <div className="flex-1 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                                <CheckCircle2 size={18} />
                                <span>Message sent successfully! 我們會儘快回覆。</span>
                            </div>
                        ) : (
                            <button
                                type="submit"
                                disabled={status === 'sending'}
                                className="w-full md:w-auto md:px-12 py-3 rounded-xl bg-[#5B5FFF] hover:bg-[#4B4FEF] text-white font-bold shadow-lg shadow-[#5B5FFF]/20 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                            >
                                {status === 'sending' ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <>
                                        <Send size={18} /> Send Message
                                    </>
                                )}
                            </button>
                        )}

                        {status === 'error' && (
                            <p className="text-xs text-red-500 font-medium">Something went wrong. Please try again.</p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SupportCard;
