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
        <div className="w-full max-w-4xl mx-auto shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row relative group">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full transition-all text-white/70 hover:text-white md:text-gray-400 md:hover:text-gray-900 md:hover:bg-gray-100 dark:md:text-gray-500 dark:md:hover:text-white dark:md:hover:bg-gray-800"
                >
                    <X size={20} />
                </button>
            )}

            {/* Left Side - Brand & Info */}
            <div className="md:w-1/2 bg-[#5B5FFF] p-12 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm">
                        <MessageCircle size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                        We're here to help.
                    </h2>
                    <p className="text-blue-100 text-lg font-medium leading-relaxed">
                        Running into issues? Have a feature request? Drop us a line and we'll get back to you ASAP.
                    </p>
                </div>

                <div className="relative z-10 mt-12">
                    <div className="flex items-center gap-3 text-sm font-bold opacity-80">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span>Typical reply time: &lt; 2 hours</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="md:w-1/2 bg-white dark:bg-gray-900 p-8 md:p-12 flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Send a Message</h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Name</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all placeholder:text-gray-400"
                            placeholder="Jane Doe"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email</label>
                        <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all placeholder:text-gray-400"
                            placeholder="jane@company.com"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Message</label>
                        <textarea
                            required
                            rows={4}
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all resize-none placeholder:text-gray-400"
                            placeholder="How can we help you?"
                        />
                    </div>

                    {status === 'success' ? (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 size={18} />
                            <span>Message sent successfully!</span>
                        </div>
                    ) : (
                        <button
                            type="submit"
                            disabled={status === 'sending'}
                            className="w-full py-4 rounded-xl bg-[#5B5FFF] hover:bg-[#4B4FEF] text-white font-bold shadow-lg shadow-[#5B5FFF]/20 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
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
                        <p className="text-center text-xs text-red-500 font-medium">Something went wrong. Please try again.</p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default SupportCard;
