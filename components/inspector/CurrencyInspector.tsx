import React from 'react';
import { CreditIcon, GoldIcon } from '../ui/CurrencyIcons';
import { t } from '../../services/localization';

interface CurrencyInspectorProps {
    type: 'gold' | 'credits';
    amount: number;
}

export const CurrencyInspector: React.FC<CurrencyInspectorProps> = ({ type, amount }) => {
    return (
        <div className="flex flex-col items-center animate-pop">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-[0_0_4rem_rgba(0,0,0,0.6)] mb-4 ${type === 'gold' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-blue-500/10 border-blue-500/40'}`}>
                {type === 'gold' ? <GoldIcon size="xl" animate /> : <CreditIcon size="xl" />}
            </div>
            
            <div className="text-center">
                <h2 className="text-4xl font-black text-white italic tracking-tighter mb-1 uppercase leading-none drop-shadow-xl">
                    {amount.toLocaleString()}
                </h2>
                <div className={`text-lg font-black uppercase tracking-[0.3em] mb-4 ${type === 'gold' ? 'text-amber-500' : 'text-blue-400'}`}>
                    {type}
                </div>
                <div className="w-full h-px bg-white/10 mb-3 mx-auto max-w-[10rem]" />
                <p className="text-slate-500 font-bold text-[0.6rem] uppercase tracking-[0.25em]">
                    {t('UI_AVAILABLE_BALANCE')}
                </p>
            </div>
        </div>
    );
};