
import React from 'react';
import { SlantedButton } from './SlantedButton';

interface GenomeBadgeProps {
    level: number;
    className?: string;
    onClick?: () => void;
}

/**
 * GENOME BADGE (Collection Level)
 * Optimized for high-digit level numbers in a compact header.
 * Uses 'k' notation for levels >= 10,000 to reclaim space.
 * Now supports onClick for progression track navigation.
 */
export const GenomeBadge: React.FC<GenomeBadgeProps> = ({ level, className = '', onClick }) => {
    const formattedLevel = level >= 10000 
        ? (level / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
        : level.toString();

    return (
        <SlantedButton 
            variant="primary" 
            size="xs"
            className={`!w-[16vw] max-w-[4.5rem] shadow-lg [&_div.z-20]:!px-0 ${className}`}
            onClick={onClick}
        >
            {formattedLevel}
        </SlantedButton>
    );
};
