import React from 'react';

interface ComicIssueCardProps {
    issueNumber: number;
    title: string;
    isLocked?: boolean;
}

export const ComicIssueCard: React.FC<ComicIssueCardProps> = ({ issueNumber, title, isLocked }) => {
    return (
        <div className={`group relative aspect-[2/3] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-xl cursor-pointer transition-transform active:scale-95 ${isLocked ? 'grayscale opacity-60' : ''}`}>
            {/* Label */}
            <div className="absolute top-2 left-2 z-20">
                <div className={`px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider rounded shadow-md ${isLocked ? 'bg-slate-700 text-slate-400' : 'bg-black/80 text-yellow-500'}`}>
                    Issue #{issueNumber}
                </div>
            </div>
            
            {/* Image Placeholder */}
            <div className="absolute inset-0 bg-slate-800">
                <img 
                    src={`https://picsum.photos/300/450?random=${issueNumber + 100}`} 
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                    alt=""
                />
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            
            {/* Lock Icon */}
            {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-slate-600 flex items-center justify-center">
                         <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                </div>
            )}

            {/* Bottom Info */}
            <div className="absolute bottom-0 w-full p-3 z-20">
                <div className="text-xs font-bold text-slate-400 mb-0.5">Chapter {issueNumber}</div>
                <div className={`text-sm font-black leading-tight transition-colors ${isLocked ? 'text-slate-500' : 'text-white group-hover:text-yellow-400'}`}>
                    {title}
                </div>
            </div>
        </div>
    );
};