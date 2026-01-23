
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Profile, Roster } from '../types.ts';
import { 
  Video, 
  Sparkles, 
  Play, 
  Download, 
  Loader2, 
  AlertCircle, 
  MonitorPlay, 
  Gamepad2, 
  Cpu,
  RefreshCw,
  ExternalLink,
  Lock,
  Zap,
  CheckCircle2,
  X
} from 'lucide-react';

interface Props {
  profile: Profile;
  rosters: Roster[];
}

const MarketingStudio: React.FC<Props> = ({ profile, rosters }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const VEO_PRICING_DOCS = "https://ai.google.dev/gemini-api/docs/billing";

  const PRESETS = [
    {
      id: 'cinematic',
      label: 'Cinematic Trailer',
      icon: <MonitorPlay size={18} />,
      prompt: "A high-end, cinematic 3D motion graphics marketing video for 'RosterSync'. The video begins with messy, unformatted roster text in a dark digital void. A glowing indigo laser sweep transforms the text into elegant glass cards with athlete portraits and stats. Camera glides follow pulses of data light as they flow into professional broadcast monitors showing 'Ross XPression' and 'Vizrt' interfaces. Neon indigo palette, deep violet accents, sleek corporate aesthetic, 4k."
    },
    {
      id: 'technical',
      label: 'Technical Breakdown',
      icon: <Cpu size={18} />,
      prompt: "Macro close-up shot of code-like athlete metadata flowing through a futuristic digital engine. Bright indigo light beams illuminate nodes representing MAM and DAM systems as data is perfectly synchronized. Transparent glass cards slide into place with standard athlete jersey numbers and positions appearing with a digital chime visual. Sleek, fast-paced technical animation with shallow depth of field."
    },
    {
      id: 'social',
      label: 'Social Short',
      icon: <Zap size={18} />,
      prompt: "Fast-paced social media ad for a sports tech app. Kinetic typography flashing names of major hardware like 'Ross', 'Vizrt', and 'Chyron'. High-energy indigo pulses of data flying from a mobile dashboard into massive stadium Jumbotrons. Dynamic camera shakes, bright neon colors, and high contrast lighting."
    }
  ];

  const handleGenerate = async () => {
    if (!prompt) return;
    setError(null);
    setVideoUrl(null);
    setIsGenerating(true);
    setStatusMessage('Connecting to Veo Production Pipeline...');

    try {
      // 1. Check for API Key selection as per Veo requirements
      // Note: window.aistudio helper assumed present in runtime as per instructions
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setStatusMessage('Waiting for Billing Authorization...');
        await (window as any).aistudio.openSelectKey();
        // Proceeding assuming selection was successful (mitigating race condition)
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      setStatusMessage('Analyzing Production Prompt...');
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      // 2. Poll for completion
      let pollCount = 0;
      while (!operation.done) {
        pollCount++;
        if (pollCount > 1) setStatusMessage(`Rendering Video Frames... (${pollCount * 10}s)`);
        else setStatusMessage('Initiating 1080p Render Engine...');
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      if (operation.response?.generatedVideos?.[0]?.video?.uri) {
        setStatusMessage('Finalizing MP4 Post-Processing...');
        const downloadLink = operation.response.generatedVideos[0].video.uri;
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      } else {
        throw new Error("Video generation completed but no URI was returned.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setError("API Key verification failed. Please ensure you've selected a key from a paid GCP project.");
        await (window as any).aistudio.openSelectKey();
      } else {
        setError(err.message || "Failed to generate video. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5B5FFF]">Marketing Studio</span>
           </div>
           <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Trailer Generator</h1>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-xl">
           <Lock size={14} className="text-amber-600" />
           <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Requires Paid API Key</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 font-mono">1. Choose Style</h3>
            <div className="space-y-3">
              {PRESETS.map((preset) => (
                <button 
                  key={preset.id} 
                  onClick={() => setPrompt(preset.prompt)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all group ${prompt === preset.prompt ? 'border-[#5B5FFF] bg-[#5B5FFF]/5 ring-1 ring-[#5B5FFF]/20' : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${prompt === preset.prompt ? 'bg-[#5B5FFF] text-white shadow-lg shadow-[#5B5FFF]/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {preset.icon}
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${prompt === preset.prompt ? 'text-[#5B5FFF]' : 'text-gray-900 dark:text-white'}`}>{preset.label}</div>
                    <div className="text-[10px] text-gray-400 font-medium">Auto-populates prompt</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
             <div className="flex items-center gap-2 text-gray-400 mb-3">
               <AlertCircle size={16} />
               <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Production Note</span>
             </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
               Video generation utilizes the <strong>Veo 3.1</strong> production model. A paid Google Cloud Project key is required. 
               <a href={VEO_PRICING_DOCS} target="_blank" rel="noopener noreferrer" className="text-[#5B5FFF] hover:underline ml-1 inline-flex items-center gap-0.5">Learn about billing <ExternalLink size={10} /></a>
             </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center"><Video size={20} /></div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">Production Studio</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Status: {isGenerating ? 'Active' : 'Standby'}</p>
                </div>
              </div>
              {videoUrl && (
                <button 
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = videoUrl;
                    a.download = 'rostersync_demo.mp4';
                    a.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Download size={16} /> Download MP4
                </button>
              )}
            </div>

            <div className="flex-1 p-8 flex flex-col gap-6">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-gray-100 dark:border-gray-800 border-t-[#5B5FFF] animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-[#5B5FFF]">
                      <Sparkles size={40} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <h4 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{statusMessage}</h4>
                    <p className="text-sm text-gray-400 font-medium max-w-sm mx-auto">This process typically takes 2-4 minutes as our AI renders 1080p broadcast-quality video frames.</p>
                  </div>
                </div>
              ) : videoUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-in zoom-in duration-500">
                   <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl relative group">
                      <video 
                        src={videoUrl} 
                        controls 
                        autoPlay 
                        loop 
                        className="w-full h-full object-cover"
                      />
                   </div>
                   <button onClick={() => { setVideoUrl(null); }} className="text-gray-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                     <RefreshCw size={14} /> Reset Studio
                   </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest font-mono ml-1">2. Edit Video Prompt</label>
                    <textarea 
                      value={prompt} 
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter a descriptive prompt or choose a style preset..."
                      className="w-full h-40 p-6 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white text-base leading-relaxed font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 transition-all resize-none"
                    />
                  </div>

                  <div className="mt-auto pt-6 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {rosters.slice(0, 3).map((r, i) => (
                          <div key={r.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 bg-[#5B5FFF] text-white flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: r.teamMetadata?.primaryColor }}>{r.teamMetadata?.abbreviation?.charAt(0)}</div>
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Reference data loaded</span>
                    </div>

                    <button 
                      onClick={handleGenerate}
                      disabled={!prompt || isGenerating}
                      className="w-full md:w-auto px-10 py-5 rounded-2xl primary-gradient text-white font-bold text-base shadow-xl shadow-[#5B5FFF]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                    >
                      <Sparkles size={20} /> {isGenerating ? 'Rendering...' : 'Generate Demo'}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold font-mono flex items-center gap-3 animate-in shake duration-500">
                  <AlertCircle size={18} /> {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingStudio;
