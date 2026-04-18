import { GameText } from '../ui/GameText';

interface BattleLogItemProps {
    result: 'VICTORY' | 'DEFEAT' | 'DRAW';
    opponent: string;
    mode: 'CONQUEST' | 'LADDER';
    date?: string;
    time?: string;
    score?: string; // e.g. "2-1-0" for Conquest
    cubes?: number; // e.g. +4 or -2 for Ladder
}

/**
 * Formats a 24h time string (HH:mm) into a 12h AM/PM format.
 */
const formatTimeAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h = hours % 12 || 12;
        return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch {
        return timeStr;
    }
};

export const BattleLogItem = (props: BattleLogItemProps) => {
    const isWin = () => props.result === 'VICTORY';
    const isLoss = () => props.result === 'DEFEAT';
    
    const shortResult = () => isWin() ? 'WIN' : (isLoss() ? 'LOSS' : 'TIE');
    const resultColor = () => isWin() ? 'text-emerald-400' : (isLoss() ? 'text-red-400' : 'text-slate-100');
    const isConquest = () => props.mode === 'CONQUEST';
    
    const cubeVal = () => props.cubes || 0;
    const cubeColor = () => cubeVal() > 0 ? 'text-emerald-400' : (cubeVal() < 0 ? 'text-red-400' : 'text-slate-500');
    const cubePrefix = () => cubeVal() > 0 ? '+' : '';

    const date = () => props.date ?? "24 MAY 25";
    const time = () => props.time ?? "14:20";

    return (
        <div class="relative group cursor-pointer active:scale-[0.98] transition-all rounded-xl bg-slate-900 border-2 border-indigo-400/25 shadow-[0_8px_20px_rgba(0,0,0,0.6)] h-[3.4rem] overflow-hidden">
            <div class="flex items-center justify-between py-0 px-5 bg-indigo-950/80 backdrop-blur-sm h-full w-full gap-2">
                
                {/* LEFT SIDE: Identity & Outcome */}
                <div class="flex flex-col justify-center h-full min-w-0 flex-1">
                    
                    {/* PLAYER NAME & RESULT ROW */}
                    <div class="flex items-center gap-1 h-5 overflow-hidden w-full">
                        <div class="shrink-0 flex items-center h-full">
                            <GameText 
                                text={shortResult()} 
                                baseFontSize={0.7} 
                                class={`font-black italic tracking-tighter ${resultColor()} !justify-start drop-shadow-md`}
                            />
                        </div>
                        
                        <span class="text-[0.55rem] font-black text-indigo-400/50 uppercase tracking-tighter italic mx-0.5 shrink-0">VS</span>
                        
                        <div class="flex-1 min-w-0 h-full">
                            <GameText 
                                text={props.opponent} 
                                baseFontSize={0.8} 
                                maxScale={1.0}
                                class="text-white font-black uppercase italic !justify-start drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
                            />
                        </div>
                    </div>

                    {/* METADATA SUB-ROW */}
                    <div class="flex items-center gap-2 mt-[0.02rem] opacity-70">
                         <span class="text-[0.45rem] font-black text-indigo-100 uppercase tracking-widest font-sans">
                            {date()}
                         </span>
                         <div class="w-0.5 h-0.5 rounded-full bg-indigo-500" />
                         <span class="text-[0.45rem] font-black text-indigo-100 uppercase tracking-widest font-sans tabular-nums">
                            {formatTimeAMPM(time())}
                         </span>
                    </div>
                </div>

                {/* RIGHT SIDE: Mode & Stats */}
                <div class="flex flex-col items-end justify-center shrink-0 h-[85%]">
                    <div class="text-[0.45rem] font-black text-indigo-200 uppercase tracking-[0.2em] leading-none mb-0.5 drop-shadow-sm">
                        {props.mode}
                    </div>
                    
                    {isConquest() ? (
                        <span class="text-[1.1rem] font-black text-white italic tracking-[0.1em] tabular-nums leading-tight drop-shadow-sm">
                            {props.score || '0-0-0'}
                        </span>
                    ) : (
                        <div class="flex items-center gap-0.5 leading-none">
                            <span class={`text-[1.3rem] font-black italic tabular-nums drop-shadow-sm ${cubeColor()}`}>
                                {cubePrefix()}{cubeVal()}
                            </span>
                            <span class="text-[0.45rem] font-black text-slate-300 uppercase tracking-tighter mt-1 drop-shadow-md">CUBES</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
