import { LocationDefinition } from '../../types';
import { LocationCard } from '../LocationCard';

interface LocationInspectorProps {
    location: LocationDefinition;
}

export const LocationInspector = (props: LocationInspectorProps) => {
    return (
        <div class="relative z-40 animate-pop drop-shadow-2xl max-w-[20rem]">
            <LocationCard location={props.location} size="lg" />
        </div>
    );
};
