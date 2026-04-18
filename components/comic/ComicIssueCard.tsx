import { Show } from 'solid-js';

interface ComicIssueCardProps {
    issueNumber: number;
    title: string;
    isLocked?: boolean;
}

export const ComicIssueCard = (props: ComicIssueCardProps) => {
    return (
        <div class={`group relative aspect-[2/3] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-xl cursor-pointer transition-transform active:scale-95 ${props.isLocked ? 'grayscale opacity-60' : ''}`}>
            {/* Label */}
            <div class="absolute top-2 left-2 z-20">
                <div class={`px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider rounded shadow-md ${props.isLocked ? 'bg-slate-700 text-slate-400' : 'bg-black/80 text-yellow-500'}`}>
                    Issue #{props.issueNumber}
                </div>
            </div>
            
            {/* Image Placeholder */}
            <div class="absolute inset-0 bg-slate-800">
                <img 
                    src={`https://picsum.photos/300/450?random=${props.issueNumber + 100}`} 
                    class="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                    alt=""
                    referrerPolicy="no-referrer"
                />
            </div>

            {/* Gradient Overlay */}
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            
            {/* Lock Icon */}
            <Show when={props.isLocked}>
                <div class="absolute inset-0 flex items-center justify-center z-10">
                    <div class="w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-slate-600 flex items-center justify-center">
                         <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                </div>
            </Show>

            {/* Bottom Info */}
            <div class="absolute bottom-0 w-full p-3 z-20">
                <div class="text-xs font-bold text-slate-400 mb-0.5">Chapter {props.issueNumber}</div>
                <div class={`text-sm font-black leading-tight transition-colors ${props.isLocked ? 'text-slate-500' : 'text-white group-hover:text-yellow-400'}`}>
                    {props.title}
                </div>
            </div>
        </div>
    );
};
