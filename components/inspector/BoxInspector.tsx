interface BoxInspectorProps {
    boxType: 'MYSTERY' | 'MEGA';
    title: string;
    description: string;
}

export const BoxInspector = (props: BoxInspectorProps) => {
    return (
        <div class="flex flex-col items-center animate-pop max-w-[20rem]">
            <div class="relative mb-10 group">
                <div class={`absolute inset-0 blur-[60px] opacity-40 rounded-full ${props.boxType === 'MEGA' ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                <div class="w-40 h-40 relative preserve-3d transition-transform duration-1000 animate-[spin_12s_linear_infinite]">
                    <div class={`absolute inset-0 border-4 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md ${props.boxType === 'MEGA' ? 'bg-gradient-to-br from-amber-600 to-amber-900 border-amber-400 shadow-amber-500/30' : 'bg-gradient-to-br from-indigo-600 to-indigo-900 border-indigo-400 shadow-indigo-500/30'}`}>
                        <span class="text-5xl font-black text-white italic drop-shadow-lg">?</span>
                    </div>
                </div>
            </div>

            <div class="text-center px-4">
                <h2 class="text-4xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none drop-shadow-lg">
                    {props.title}
                </h2>
                <div class="w-full h-px bg-white/20 mb-5 mx-auto max-w-[12rem]" />
                <p class="text-indigo-100 font-bold text-[0.9rem] leading-relaxed px-2 italic drop-shadow-sm">
                    {props.description}
                </p>
            </div>
            <style>{`.preserve-3d { transform-style: preserve-3d; }`}</style>
        </div>
    );
};
