
import { CardDefinition, CardInstance, LocationDefinition, LocationInstance, Lane, PlayerID, Zone } from '../types';
import { generateInstanceId } from '../utils/id';

export const createCardInstance = (def: CardDefinition, owner: PlayerID, createdInZone: Zone): CardInstance => {
  return {
    instanceId: generateInstanceId(),
    definitionId: def.id,
    owner,
    zone: createdInZone,
    laneIndex: null,
    slotIndex: null,
    faceUp: createdInZone === 'BOARD' ? false : true, // Default hidden on board unless specified
    turnPlayed: null,
    playOrder: null,
    
    // Stat Hierarchy Initialization
    baseCost: def.baseCost,
    currentCost: def.baseCost,
    totalCost: def.baseCost,
    costModifiers: [{ source: 'Base', value: def.baseCost, type: 'BASE' }],
    
    basePower: def.basePower,
    currentPower: def.basePower,
    totalPower: def.basePower,
    powerModifiers: [{ source: 'Base', value: def.basePower, type: 'BASE' }],

    baseText: def.baseText,
    currentText: def.baseText,
    abilityEnabled: true,
    hasResolvedOnReveal: false,
    startedInDeck: createdInZone === 'DECK',
    created: createdInZone !== 'DECK',
    createdInZone,
    def, // Link reference
  };
};

export const createLocationInstance = (def: LocationDefinition): LocationInstance => {
  return {
    id: generateInstanceId(),
    def,
    revealed: true, // Default true for now
  };
};

export const createEmptyLane = (locDef: LocationDefinition): Lane => {
  return {
    location: createLocationInstance(locDef),
    p1Slots: [null, null, null, null],
    p2Slots: [null, null, null, null],
  };
};
