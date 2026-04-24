CYBERPUNK CCG — v0.2 DESIGN DOCS README
Created: 2026-04-23

This v0.2 bundle fixes the engine model.

============================================================
KEY CORRECTION
============================================================

Cards are persistent entities.

Destroy, discard, and banish are zone changes.

    Destroy = move to destroyed pile / death pile.
    Discard = move to discard pile.
    Banish = move to banish pile.

Cards are never deleted from the system.

============================================================
BANISH RULE
============================================================

Banished cards still exist in the engine, but design-wise the banish pile is
final.

Never design cards that:

    pull from banish,
    recover from banish,
    regenerate from banish,
    return from banish,
    move cards out of banish,
    or copy from banish as a recovery workaround.

Cards may count banished cards or trigger when cards are banished.

============================================================
FILES
============================================================

Cyberpunk_CCG_Persistent_Entity_Zone_Model_Errata_v0.2.txt
Cyberpunk_CCG_Domain_Bible_v0.2.txt
Cyberpunk_CCG_Tracked_Variables_Matrix_v0.2.txt
Cyberpunk_CCG_Launch_Archetype_Packages_v0.2.txt
Cyberpunk_CCG_First_105_Card_Draft_v0.2.txt
Cyberpunk_CCG_Compact_105_Card_List_v0.2.txt
Cyberpunk_CCG_First_105_Card_Draft_v0.2.tsv
Cyberpunk_CCG_Starter_Decks_v0.2.txt
Cyberpunk_CCG_Starter_Decks_v0.2.tsv
Cyberpunk_CCG_Balance_Pass_Notes_v0.2.txt

End README.
