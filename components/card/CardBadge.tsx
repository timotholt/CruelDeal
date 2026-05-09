
import { createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { CardGem, type HexBadgeGeometry, type HexBadgeVariant } from './CardGem';

interface CardBadgeProps {
    value: () => number | string;
    type: 'cost' | 'power';
    colorClass: () => string;
    anchor: () => HTMLElement | undefined;
    size?: number;
    variant?: HexBadgeVariant;
    geometry?: HexBadgeGeometry;
    hue?: number;
    saturation?: number;
    luminosity?: number;
    offsetX?: number;
    offsetY?: number;
}

export const CardBadge = (props: CardBadgeProps) => {
    const isCost = () => props.type === 'cost';
    const [rect, setRect] = createSignal<DOMRect | null>(null);

    const updateRect = () => {
        const anchor = props.anchor();
        if (!anchor) return;
        setRect(anchor.getBoundingClientRect());
    };

    onMount(() => {
        updateRect();

        const anchor = props.anchor();
        const observer = anchor ? new ResizeObserver(updateRect) : undefined;
        if (anchor) observer?.observe(anchor);

        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        onCleanup(() => {
            observer?.disconnect();
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        });
    });

    const badgeSize = () => {
        const cardRect = rect();
        if (props.size !== undefined) return props.size;
        if (!cardRect) return 0;
        return Math.round(Math.min(Math.max(cardRect.width * 0.28, 44), 152));
    };

    const placementScale = () => {
        const cardRect = rect();
        if (!cardRect) return 1;
        return Math.max(0.55, Math.min(cardRect.width / 350, 2.8));
    };

    const offsetX = () => (props.offsetX ?? -18) * placementScale();
    const offsetY = () => (props.offsetY ?? 21) * placementScale();

    const style = () => {
        const cardRect = rect();
        const size = badgeSize();
        if (!cardRect || size <= 0) {
            return { display: 'none' };
        }

        const top = cardRect.top + offsetY();
        const left = isCost()
            ? cardRect.left + offsetX()
            : cardRect.right - size - offsetX();

        return {
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${size}px`,
            height: `${size}px`,
            'z-index': 1200,
        };
    };
    
    const variant = () => props.variant ?? (isCost() ? 'frost' : 'ember');
    const hue = () => props.hue ?? (isCost() ? 208 : 20);
    const saturation = () => props.saturation ?? (isCost() ? 120 : 180);
    const luminosity = () => props.luminosity ?? (isCost() ? 100 : 110);

    return (
        <Portal mount={document.body}>
            <CardGem
                value={props.value()}
                foregroundColor="currentColor"
                size={badgeSize()}
                variant={variant()}
                geometry={props.geometry ?? 'narrow'}
                hue={hue()}
                saturation={saturation()}
                luminosity={luminosity()}
                class={props.colorClass()}
                style={style()}
                ariaLabel={`${props.type} ${props.value()}`}
            />
        </Portal>
    );
};
