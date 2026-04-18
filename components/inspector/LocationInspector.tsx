import React from 'react';
import { LocationDefinition } from '../../types';
import { LocationCard } from '../LocationCard';

interface LocationInspectorProps {
    location: LocationDefinition;
}

export const LocationInspector: React.FC<LocationInspectorProps> = ({ location }) => {
    return (
        <div className="relative z-40 animate-pop drop-shadow-2xl max-w-[20rem]">
            <LocationCard location={location} size="lg" />
        </div>
    );
};