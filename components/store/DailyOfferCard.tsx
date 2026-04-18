import React from 'react';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';

interface DailyOfferCardProps {
    title: string;
    description: string;
    price: string;
    discount?: string;
    backgroundImage?: string;
    onClick?: () => void;
}

export const DailyOfferCard: React.FC<DailyOfferCardProps> = ({ 
    title, 
    description, 
    price, 
    discount, 
    backgroundImage,
    onClick 
}) => {
    return (
        <div 
            onClick={onClick}
            className="w-full aspect-video rounded-md bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-700/50 relative overflow-hidden p-4 flex flex-col justify-end shadow-2xl group cursor-pointer active:scale-[0.98] transition-all"
        >
            {/* Background Image */}
            <div className="absolute inset-0 opacity-40 mix-blend-overlay transition-transform duration-700 group-hover:scale-105">
                <img src={backgroundImage || "https://picsum.photos/seed/bundle/600/400"} alt="" className="w-full h-full object-cover" />
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>

            {/* Premium Badge - Top Left */}
            <div className="absolute top-0 left-0 z-20">
                 <div className="bg-indigo-600/90 backdrop-blur-sm text-white text-[0.55rem] font-black px-2.5 py-1.5 rounded-br-md shadow-lg border-r border-b border-indigo-400 uppercase tracking-wider">
                     Premium Offer
                 </div>
            </div>

            {/* Discount Badge - Top Right */}
            {discount && (
                <div className="absolute top-0 right-0 z-20">
                     <div className="bg-red-600 text-white text-[0.6rem] font-black px-3 py-1.5 rounded-bl-md shadow-lg border-l border-b border-red-400 uppercase tracking-tighter">
                        {discount}
                     </div>
                </div>
            )}
            
            <div className="relative z-10 pointer-events-none">
                <h2 className="text-2xl font-black text-white leading-none mb-1 drop-shadow-md italic uppercase tracking-tighter">
                    {t(title)}
                </h2>
                <p className="text-indigo-100 text-[0.65rem] mb-3 w-full font-medium drop-shadow line-clamp-2">
                    {t(description)}
                </p>
                
                <div className="w-32">
                    <SlantedButton variant="primary" fullWidth size="sm">
                         {price}
                    </SlantedButton>
                </div>
            </div>
        </div>
    );
};