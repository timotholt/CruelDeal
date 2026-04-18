import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: React.ReactNode;
}

/**
 * PORTAL COMPONENT
 * Renders children into document.body to escape parent DOM nesting.
 * Essential for perfectly centered global overlays and pop-ups.
 */
export const Portal: React.FC<PortalProps> = ({ children }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => {
            clearTimeout(timer);
            setMounted(false);
        };
    }, []);

    return mounted ? createPortal(children, document.body) : null;
};
