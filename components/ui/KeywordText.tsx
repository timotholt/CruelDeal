import { Show } from 'solid-js';

interface KeywordTextProps {
    text: string;
    class?: string;
}

export const KeywordText = (props: KeywordTextProps) => {
    const parts = () => props.text?.split(':') || [];
    const keywords = ['On Reveal', 'On Going', 'On Destroy', 'On Move', 'On Discard'];
    
    // Check if the first part matches a keyword
    const hasKeyword = () => parts().length > 1 && keywords.some(k => parts()[0].trim().includes(k));

    return (
        <Show when={props.text}>
            <Show 
                when={hasKeyword()} 
                fallback={
                    <span class={`font-bold text-white/90 shadow-black drop-shadow-sm ${props.class || ''}`}>
                        {props.text}
                    </span>
                }
            >
                <span class={props.class}>
                   <span class="text-yellow-400 font-black uppercase tracking-wider mr-1">{parts()[0]}:</span>
                   <span class="font-medium text-white/90 shadow-black drop-shadow-sm">{parts().slice(1).join(':')}</span>
                </span>
            </Show>
        </Show>
    );
};
