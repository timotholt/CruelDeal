interface PlayerAvatarProps {
    name: string;
    label: string;
    hasPriority: boolean;
    color: 'indigo' | 'red';
    side: 'left' | 'right';
}

export const PlayerAvatar = (props: PlayerAvatarProps) => {
    
    // Priority Styles
    const ringClass = () => props.hasPriority 
        ? 'ring-[0.1rem] ring-yellow-400 shadow-[0_0_0.5rem_rgba(250,204,21,0.5)] scale-105' 
        : `border border-slate-700 scale-90 opacity-70`;

    const bgClass = () => props.color === 'indigo' ? 'bg-indigo-600' : 'bg-red-900';
    
    const labelColor = () => props.hasPriority 
        ? 'text-yellow-300 drop-shadow' 
        : (props.color === 'indigo' ? 'text-indigo-400' : 'text-red-500');

    // Inner Text
    const innerTextClass = () => props.color === 'indigo' ? 'text-white' : 'text-red-100';

    return (
        <div class={`flex flex-col items-center gap-0 w-12 transition-all duration-500`}>
            <div class={`
                w-6 h-6 rounded-full flex items-center justify-center overflow-hidden transition-all duration-500
                ${ringClass()} ${bgClass()}
            `}>
                <span class={`font-black text-[0.45rem] tracking-tighter ${innerTextClass()}`}>{props.label}</span>
            </div>
            <div class={`text-[0.45rem] font-black tracking-tight transition-colors duration-500 uppercase ${labelColor()}`}>
                {props.name}
            </div>
        </div>
    );
};