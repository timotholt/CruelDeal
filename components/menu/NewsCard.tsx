
import React from 'react';

interface NewsCardProps {
    type: string;
    title: string;
    subtitle: string;
    imageColor: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({ type, title, subtitle, imageColor }) => (
    <div className="w-full bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden mb-4 shrink-0 shadow-lg group cursor-pointer hover:border-indigo-500 transition-colors">
        <div className={`h-24 w-full ${imageColor} relative`}>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[0.55rem] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                {type}
            </div>
        </div>
        <div className="p-3">
            <h3 className="font-bold text-white leading-tight mb-1 group-hover:text-indigo-300 transition-colors">{title}</h3>
            <p className="text-xs text-slate-400 line-clamp-2">{subtitle}</p>
        </div>
    </div>
);
