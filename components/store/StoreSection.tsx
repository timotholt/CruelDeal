import { JSX } from 'solid-js';

interface StoreSectionProps {
    id: string;
    title: string;
    colorClass?: string;
    children: JSX.Element;
}

export const StoreSection = (props: StoreSectionProps) => (
    <section id={props.id} class="relative scroll-mt-2">
        <div class="flex items-center gap-2 mb-4 px-1">
            <h2 class={`text-[0.65rem] font-black uppercase tracking-[0.2em] italic ${props.colorClass || 'text-slate-500'}`}>
                {props.title}
            </h2>
            <div class={`flex-1 h-px opacity-20 bg-current ${props.colorClass || 'text-slate-500'}`} />
        </div>
        {props.children}
    </section>
);
