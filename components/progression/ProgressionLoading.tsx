import React from 'react';
import { t } from '../../services/localization';

export const ProgressionLoading: React.FC = () => (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
        <span className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">{t('LOAD_SYNCING_SECTOR')}</span>
    </div>
);