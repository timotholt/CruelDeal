import { SlantedButton } from './SlantedButton';

interface GenomeBadgeProps {
    level: number;
    class?: string;
    onClick?: () => void;
}

/**
 * GENOME BADGE (Collection Level)
 * Optimized for high-digit level numbers in a compact header.
 * Uses 'k' notation for levels >= 10,000 to reclaim space.
 * Now supports onClick for progression track navigation.
 */
export const GenomeBadge = (props: GenomeBadgeProps) => {
    const formattedLevel = () => props.level >= 10000 
        ? (props.level / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
        : props.level.toString();

    return (
        <SlantedButton 
            variant="primary" 
            size="xs"
            class={`!w-[16vw] max-w-[4.5rem] shadow-lg [&_div.z-20]:!px-0 ${props.class || ''}`}
            onClick={() => props.onClick?.()}
        >
            {formattedLevel()}
        </SlantedButton>
    );
};
