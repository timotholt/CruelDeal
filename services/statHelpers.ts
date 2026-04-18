
import { CardInstance, StatModifier } from '../types';

export const addContinuousModifier = (card: CardInstance, modifier: StatModifier) => {
    card.powerModifiers.push(modifier);
    card.totalPower += modifier.value;
};

export const addContinuousCostModifier = (card: CardInstance, modifier: StatModifier) => {
    card.costModifiers.push(modifier);
    card.totalCost = Math.max(0, card.totalCost + modifier.value);
};

export const resetContinuousStats = (card: CardInstance) => {
    // 1. Filter out CONTINUOUS modifiers
    card.powerModifiers = card.powerModifiers.filter(m => m.type !== 'CONTINUOUS');
    card.costModifiers = card.costModifiers.filter(m => m.type !== 'CONTINUOUS');

    // 2. Re-sum to get Current (Base + Permanent)
    const currentPower = card.powerModifiers.reduce((sum, m) => sum + m.value, 0);
    const currentCost = card.costModifiers.reduce((sum, m) => sum + m.value, 0);

    card.currentPower = currentPower;
    card.currentCost = currentCost;

    // 3. Reset Total to Current (baseline before continuous are re-added)
    card.totalPower = currentPower;
    card.totalCost = currentCost;
};
