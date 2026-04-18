import React from 'react';
import { SlantedButton } from '../ui/SlantedButton';

interface InboxItemProps {
    type: 'REWARD' | 'SYSTEM';
    title: string;
    message: string;
    isRead: boolean;
    rewardLabel?: string;
    onClaim?: () => void;
}

/**
 * INBOX ITEM
 * Renders server-authored content directly. 
 * This component is "dumb" regarding localization, as the server 
 * is the source of truth for long-form messaging.
 */
const InboxItemComponent: React.FC<InboxItemProps> = ({ type, title, message, isRead, rewardLabel, onClaim }) => {
    return (
        <div className={`p-4 border rounded-xl relative transition-all duration-300 ${type === 'REWARD' ? 'bg-indigo-950/40 border-indigo-500/30' : 'bg-slate-900/60 border-white/5 opacity-80'}`}>
            
            {/* Unread Indicator */}
            {!isRead && <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>}
            
            {/* Tag */}
            <div className={`text-[0.55rem] font-black mb-1.5 uppercase tracking-[0.3em] ${type === 'REWARD' ? 'text-indigo-400' : 'text-slate-500'}`}>
                {type}
            </div>
            
            {/* Content */}
            <h3 className={`font-black italic tracking-tighter text-sm mb-1.5 uppercase leading-tight ${type === 'REWARD' ? 'text-white' : 'text-slate-300'}`}>
                {title}
            </h3>
            <p className={`text-[0.7rem] mb-4 leading-relaxed font-medium ${type === 'REWARD' ? 'text-indigo-100/70' : 'text-slate-500'}`}>
                {message}
            </p>
            
            {/* Action */}
            {type === 'REWARD' && rewardLabel && (
                <div className="w-full">
                    <SlantedButton variant="blue" fullWidth size="sm" onClick={onClaim}>
                        {rewardLabel}
                    </SlantedButton>
                </div>
            )}
        </div>
    );
};

export const InboxItem = React.memo(InboxItemComponent);
