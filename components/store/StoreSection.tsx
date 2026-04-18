
import React from 'react';

interface StoreSectionProps {
    id: string;
    title: string;
    colorClass?: string;
    children: React.ReactNode;
}

export const StoreSection: React.FC<StoreSectionProps> = ({ id, title, colorClass = 'text-slate-500', children }) => (
    <section id={id} className="relative scroll-mt-2">
        <div className="flex items-center gap-2 mb-4 px-1">
            <h2 className={`text-[0.65rem] font-black uppercase tracking-[0.2em] italic ${colorClass}`}>
                {title}
            </h2>
            <div className={`flex-1 h-px opacity-20 bg-current ${colorClass}`}></div>
        </div>
        {children}
    </section>
);
