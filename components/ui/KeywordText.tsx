import React from 'react';

interface KeywordTextProps {
    text: string;
    className?: string;
}

export const KeywordText: React.FC<KeywordTextProps> = ({ text, className = '' }) => {
    if (!text) return null;

    // Basic parser for keywords
    // Looks for specific prefixes like "On Reveal:"
    
    const parts = text.split(':');
    const keywords = ['On Reveal', 'On Going', 'On Destroy', 'On Move', 'On Discard'];
    
    // Check if the first part matches a keyword
    const hasKeyword = parts.length > 1 && keywords.some(k => parts[0].trim().includes(k));

    if (hasKeyword) {
        return (
            <span className={className}>
               <span className="text-yellow-400 font-black uppercase tracking-wider mr-1">{parts[0]}:</span>
               <span className="font-medium text-white/90 shadow-black drop-shadow-sm">{parts.slice(1).join(':')}</span>
            </span>
        );
    }

    return (
        <span className={`font-bold text-white/90 shadow-black drop-shadow-sm ${className}`}>
            {text}
        </span>
    );
};