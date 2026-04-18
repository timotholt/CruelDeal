import { Show } from 'solid-js';
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
export const InboxItem = (props: InboxItemProps) => {
    return (
        <div class={`p-4 border rounded-xl relative transition-all duration-300 ${props.type === 'REWARD' ? 'bg-indigo-950/40 border-indigo-500/30' : 'bg-slate-900/60 border-white/5 opacity-80'}`}>
            
            {/* Unread Indicator */}
            <Show when={!props.isRead}>
                <div class="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
            </Show>
            
            {/* Tag */}
            <div class={`text-[0.55rem] font-black mb-1.5 uppercase tracking-[0.3em] ${props.type === 'REWARD' ? 'text-indigo-400' : 'text-slate-500'}`}>
                {props.type}
            </div>
            
            {/* Content */}
            <h3 class={`font-black italic tracking-tighter text-sm mb-1.5 uppercase leading-tight ${props.type === 'REWARD' ? 'text-white' : 'text-slate-300'}`}>
                {props.title}
            </h3>
            <p class={`text-[0.7rem] mb-4 leading-relaxed font-medium ${props.type === 'REWARD' ? 'text-indigo-100/70' : 'text-slate-500'}`}>
                {props.message}
            </p>
            
            {/* Action */}
            <Show when={props.type === 'REWARD' && props.rewardLabel}>
                <div class="w-full">
                    <SlantedButton variant="blue" fullWidth size="sm" onClick={() => props.onClaim?.()}>
                        {props.rewardLabel}
                    </SlantedButton>
                </div>
            </Show>
        </div>
    );
};
