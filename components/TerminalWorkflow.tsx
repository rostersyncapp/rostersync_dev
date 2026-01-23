import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, Terminal as TerminalIcon, Download } from 'lucide-react';

interface TerminalWorkflowProps {
  autoPlay?: boolean;
  loop?: boolean;
  onExportComplete?: (format: string) => void;
}

type Phase = 'raw' | 'processing' | 'json' | 'prompt' | 'exporting' | 'complete';

const MESSY_SAMPLES = [
  `MOHAMED SALAH 11 FWD
Virgil van DIJK 4 CB
Trent ALEXANDER-ARNOLD 66 RB
Alisson 1 GK
LUIS DIAZ 9 LW
Darwin Nunez 23 ST
Cody Gakpo | 18 | CF
Diogo Jota 20 FWD`,
  `Purdy Brock 13 QB
MCCAFFREY christian 22/rb
deebo #15  WR
Kittle George - 85 - TE
Bosa Nick 97de
trent williams 71 LT`,
  `Shohei Ohtani 17 DH / P
Mookie Betts 50 RF
Freddie Freeman 5 1B
Yoshinobu Yamamoto 18 P
Will Smith 16 C
teoscar hernandez 35 LF
TEAM LOS ANGELES DODGERS`
];

const CLEAN_JSON_SAMPLES = [
  `[
  { "name": "MOHAMED SALAH", "jersey": 11, "position": "F", "team": "LIVERPOOL FC" },
  { "name": "VIRGIL VAN DIJK", "jersey": 4, "position": "CB", "team": "LIVERPOOL FC" },
  { "name": "TRENT ALEXANDER-ARNOLD", "jersey": 66, "position": "RB", "team": "LIVERPOOL FC" },
  { "name": "ALISSON BECKER", "jersey": 1, "position": "GK", "team": "LIVERPOOL FC" },
  { "name": "LUIS DÍAZ", "jersey": 9, "position": "LW", "team": "LIVERPOOL FC" },
  { "name": "DARWIN NÚNEZ", "jersey": 23, "position": "ST", "team": "LIVERPOOL FC" }
]`,
  `[
  { "name": "BROCK PURDY", "jersey": 13, "position": "QB", "team": "SAN FRANCISCO 49ERS" },
  { "name": "CHRISTIAN MCCAFFREY", "jersey": 22, "position": "RB", "team": "SAN FRANCISCO 49ERS" },
  { "name": "DEEBO SAMUEL", "jersey": 15, "position": "WR", "team": "SAN FRANCISCO 49ERS" },
  { "name": "GEORGE KITTLE", "jersey": 85, "position": "TE", "team": "SAN FRANCISCO 49ERS" },
  { "name": "NICK BOSA", "jersey": 97, "position": "DE", "team": "SAN FRANCISCO 49ERS" },
  { "name": "TRENT WILLIAMS", "jersey": 71, "position": "LT", "team": "SAN FRANCISCO 49ERS" }
]`,
  `[
  { "name": "SHOHEI OHTANI", "jersey": 17, "position": "DH", "team": "LOS ANGELES DODGERS" },
  { "name": "MOOKIE BETTS", "jersey": 50, "position": "RF", "team": "LOS ANGELES DODGERS" },
  { "name": "FREDDIE FREEMAN", "jersey": 5, "position": "1B", "team": "LOS ANGELES DODGERS" },
  { "name": "YOSHINOBU YAMAMOTO", "jersey": 18, "position": "P", "team": "LOS ANGELES DODGERS" },
  { "name": "WILL SMITH", "jersey": 16, "position": "C", "team": "LOS ANGELES DODGERS" },
  { "name": "TEOSCAR HERNANDEZ", "jersey": 35, "position": "LF", "team": "LOS ANGELES DODGERS" }
]`
];

const EXPORT_FORMATS = [
  { id: 'ross', name: 'Ross Xpression', ext: 'XML', color: 'text-blue-500' },
  { id: 'vizrt', name: 'Vizrt DataCenter', ext: 'CSV', color: 'text-purple-500' },
  { id: 'chyron', name: 'Chyron Prime', ext: 'CSV', color: 'text-orange-500' },
  { id: 'premiere', name: 'Premiere Pro', ext: 'CSV', color: 'text-blue-400' },
  { id: 'iconik', name: 'Iconik', ext: 'JSON', color: 'text-amber-500' },
  { id: 'csv', name: 'Standard CSV', ext: 'CSV', color: 'text-green-500' },
  { id: 'catdv', name: 'CatDV', ext: 'CSV', color: 'text-red-500' }
];

const TerminalWorkflow: React.FC<TerminalWorkflowProps> = ({
  autoPlay = true,
  loop = true,
  onExportComplete
}) => {
  const [phase, setPhase] = useState<Phase>('raw');
  const [displayText, setDisplayText] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectionIndex, setSelectionIndex] = useState(0);

  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const animationFrame = useRef<number | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = useRef({
    sampleIndex: 0,
    cancelled: false,
    isAnimating: false
  });

  const clearAll = () => {
    timeouts.current.forEach(clearTimeout);
    intervals.current.forEach(clearInterval);
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    timeouts.current = [];
    intervals.current = [];
    animationFrame.current = null;
    typingTimeout.current = null;
  };

  const typeText = (text: string, speed: number, callback?: () => void) => {
    // Cancel any existing animation
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    let index = 0;
    state.current.isAnimating = true;
    setDisplayText('');
    
    const animateText = () => {
      if (state.current.cancelled || !state.current.isAnimating) {
        state.current.isAnimating = false;
        return;
      }
      
      if (index >= text.length) {
        state.current.isAnimating = false;
        if (callback) callback();
        return;
      }
      
      // Dynamic chunk size based on text length and speed
      const baseChunk = speed < 20 ? 4 : speed < 30 ? 3 : 2;
      const chunkSize = text.length > 300 ? baseChunk + 2 : baseChunk;
      const nextIndex = Math.min(index + chunkSize, text.length);
      
      setDisplayText(text.slice(0, nextIndex));
      index = nextIndex;
      
      // Use setTimeout for consistent timing
      typingTimeout.current = setTimeout(() => {
        animationFrame.current = requestAnimationFrame(animateText);
      }, speed);
    };
    
    animateText();
  };

  const runPhase = (p: Phase) => {
    if (state.current.cancelled) return;
    
    switch (p) {
      case 'raw': {
        setPhase('raw');
        setDisplayText('');
        state.current.isAnimating = false;
        const sample = MESSY_SAMPLES[state.current.sampleIndex];
        typeText(sample, 25, () => {
          if (state.current.cancelled) return;
          timeouts.current.push(setTimeout(() => runPhase('processing'), 600));
        });
        break;
      }
      case 'processing': {
        setPhase('processing');
        setDisplayText('');
        state.current.isAnimating = false;
        if (state.current.cancelled) return;
        timeouts.current.push(setTimeout(() => runPhase('json'), 2500));
        break;
      }
      case 'json': {
        setPhase('json');
        setDisplayText('');
        state.current.isAnimating = false;
        // Slightly slower for JSON to make it more readable
        typeText(CLEAN_JSON_SAMPLES[state.current.sampleIndex], 25, () => {
          if (state.current.cancelled) return;
          timeouts.current.push(setTimeout(() => runPhase('prompt'), 600));
        });
        break;
      }
      case 'prompt': {
        setPhase('prompt');
        setSelectedFormat(null);
        setSelectionIndex(0);
        state.current.isAnimating = false;
        
        const cursorTimer = setInterval(() => {
          setSelectionIndex(prev => {
            if (prev >= 6) {
              clearInterval(cursorTimer);
              const lastItem = EXPORT_FORMATS[6];
              if (lastItem) {
                handleFormatSelect(lastItem.id);
              }
              return prev;
            }
            return prev + 1;
          });
        }, 500);
        
        intervals.current.push(cursorTimer);
        break;
      }
      case 'exporting': {
        intervals.current.forEach(clearInterval);
        intervals.current = [];
        setPhase('exporting');
        state.current.isAnimating = false;
        if (state.current.cancelled) return;
        // Wait for progress bar animation to complete (4s)
        timeouts.current.push(setTimeout(() => {
          if (state.current.cancelled) return;
          onExportComplete?.(selectedFormat || 'unknown');
          runPhase('complete');
        }, 4000));
        break;
      }
      case 'complete': {
        setPhase('complete');
        if (state.current.cancelled) return;
        timeouts.current.push(setTimeout(() => {
          if (loop && !state.current.cancelled) {
            state.current.sampleIndex = (state.current.sampleIndex + 1) % MESSY_SAMPLES.length;
            setSampleIndex(state.current.sampleIndex);
            runPhase('raw');
          }
        }, 3000));
        break;
      }
    }
  };

  useEffect(() => {
    if (!autoPlay) return;

    state.current.cancelled = false;
    state.current.isAnimating = false;
    timeouts.current.push(setTimeout(() => runPhase('raw'), 500));

    return () => {
      state.current.cancelled = true;
      state.current.isAnimating = false;
      clearAll();
    };
  }, [autoPlay, loop]);

  const handleFormatSelect = (formatId: string) => {
    if (state.current.isAnimating) {
      state.current.isAnimating = false;
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    }
    setSelectedFormat(formatId);
    runPhase('exporting');
  };

  const renderContent = () => {
    const phaseLabel = {
      raw: 'PARSING RAW ROSTER',
      processing: 'AI NORMALIZATION',
      json: 'GENERATING JSON',
      prompt: 'SELECT EXPORT FORMAT',
      exporting: 'EXPORTING',
      complete: 'EXPORT COMPLETE'
    }[phase];

    switch (phase) {
      case 'raw':
        return (
          <div className="space-y-2">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="font-mono text-xs md:text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-100 max-h-64 overflow-y-auto">
              {displayText}
            </div>
          </div>
        );
      case 'processing':
        return (
          <div className="space-y-2">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-[#5B5FFF]" size={20} />
              <span className="font-mono text-sm text-gray-600 dark:text-gray-300">AI Parsing roster data...</span>
            </div>
          </div>
        );
      case 'json':
        return (
          <div className="space-y-2">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="font-mono text-xs md:text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              <span className="text-purple-600 dark:text-purple-400">{displayText}</span>
            </div>
          </div>
        );
      case 'prompt':
        return (
          <div className="space-y-3">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="font-mono text-sm text-gray-800 dark:text-gray-100">
              <span className="text-green-600 dark:text-green-400">user@rosterSync</span>:
              <span className="text-blue-600 dark:text-blue-400">~$</span>{' '}
              <span className="animate-pulse">select-export-format --format=</span>
            </div>
            <div className="pl-4 space-y-1">
              {EXPORT_FORMATS.map((format, index) => (
                <button
                  key={format.id}
                  onClick={() => handleFormatSelect(format.id)}
                  className={`block w-full text-left font-mono text-xs md:text-sm px-2 py-1 rounded transition-all duration-200
                    ${index === selectionIndex 
                      ? 'bg-[#5B5FFF]/15 text-[#5B5FFF] ring-1 ring-[#5B5FFF]/30' 
                      : selectedFormat === format.id 
                        ? 'bg-[#5B5FFF]/10 text-[#5B5FFF]' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <span className={`${index === selectionIndex ? 'text-[#5B5FFF]' : 'text-gray-400'} mr-1`}>
                    [{index === selectionIndex ? 'x' : ' '}]
                  </span>
                  <span className={format.color}>{format.name}</span>
                  <span className="text-gray-400 ml-1">({format.ext})</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'exporting':
        return (
          <div className="space-y-3">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="font-mono text-sm text-gray-800 dark:text-gray-100">
              <span className="text-green-600 dark:text-green-400">user@rosterSync</span>:
              <span className="text-blue-600 dark:text-blue-400">~$</span>{' '}
              export --format={selectedFormat || 'unknown'} --output=/broadcast/roster.xml
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className="bg-[#5B5FFF] h-full rounded-full animate-progress" />
            </div>
          </div>
        );
      case 'complete':
        return (
          <div className="space-y-3">
            <div className="text-xs text-[#5B5FFF] font-mono font-medium">[{phaseLabel}]</div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 size={20} />
              <span className="font-mono text-sm">Exported to {EXPORT_FORMATS.find(f => f.id === selectedFormat)?.name}</span>
            </div>
            <div className="font-mono text-xs text-gray-500">✓ 6 athletes processed successfully</div>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative bg-white dark:bg-[#0C0C0C] rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            <TerminalIcon size={14} />
            <span>rosterSync — bash</span>
          </div>
          <div className="w-14" />
        </div>

        <div className="p-4 md:p-6 h-[380px] overflow-y-auto">{renderContent()}</div>

        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 font-mono">
            <span>Phase: {phase}</span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">Sample: {sampleIndex + 1}/{MESSY_SAMPLES.length}</span>
          </div>
          {phase === 'prompt' && (
            <span className="flex items-center gap-1 text-xs text-[#5B5FFF]">
              <Download size={12} />Click to export
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-1 mt-4">
        {(['raw', 'processing', 'json', 'prompt', 'exporting', 'complete'] as Phase[]).map((p) => (
          <div
            key={p}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              phase === p ? 'w-8 bg-[#5B5FFF]' : 'w-2 bg-gray-300 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default TerminalWorkflow;