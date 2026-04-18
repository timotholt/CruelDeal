/**
 * UUID v7 Generator
 * Implements the RFC 9562 standard for time-ordered UUIDs.
 * 
 * Benefits:
 * 1. Sequential: Dramatically improves DB performance by reducing B-tree fragmentation.
 * 2. Professional: Maintains the 36-character "long ID" look users expect.
 * 3. Accurate: Naturally sorts by generation time.
 */
export const generateInstanceId = () => {
    // 48-bit timestamp (milliseconds since epoch)
    const timestamp = Date.now();
    
    // UUID v7 structure: 
    // 48 bits: timestamp
    // 4 bits: version (0111 = 7)
    // 12 bits: sequence/entropy
    // 2 bits: variant (10 = RFC)
    // 62 bits: randomness

    const tsHex = timestamp.toString(16).padStart(12, '0');
    
    // Generate 16 bytes of random data
    const randomValues = new Uint8Array(16);
    self.crypto.getRandomValues(randomValues);

    // Set version to 7 (bits 48-51)
    randomValues[6] = (randomValues[6] & 0x0f) | 0x70;
    // Set variant to RFC (bits 64-65)
    randomValues[8] = (randomValues[8] & 0x3f) | 0x80;

    const hex = Array.from(randomValues)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Construct: timestamp(12)-rand(4)-7(1)-rand(3)-var(1)-rand(11)
    // Format: 8-4-4-4-12
    return [
        tsHex.slice(0, 8),
        tsHex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
};