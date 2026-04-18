import { Portal as SolidPortal } from 'solid-js/web';

interface PortalProps {
    children: any;
}

/**
 * PORTAL COMPONENT
 * Renders children into document.body to escape parent DOM nesting.
 * Essential for perfectly centered global overlays and pop-ups.
 */
export const Portal = (props: PortalProps) => {
    return (
        <SolidPortal mount={document.body}>
            {props.children}
        </SolidPortal>
    );
};
