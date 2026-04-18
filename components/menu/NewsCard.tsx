interface NewsCardProps {
    type: string;
    title: string;
    subtitle: string;
    imageColor: string;
}

export const NewsCard = (props: NewsCardProps) => (
    <div class="w-full bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden mb-4 shrink-0 shadow-lg group cursor-pointer hover:border-indigo-500 transition-colors">
        <div class={`h-24 w-full ${props.imageColor} relative`}>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
            <div class="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[0.55rem] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                {props.type}
            </div>
        </div>
        <div class="p-3">
            <h3 class="font-bold text-white leading-tight mb-1 group-hover:text-indigo-300 transition-colors">{props.title}</h3>
            <p class="text-xs text-slate-400 line-clamp-2">{props.subtitle}</p>
        </div>
    </div>
);
