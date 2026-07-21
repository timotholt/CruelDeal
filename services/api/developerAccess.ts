export interface IdentityClaims {
  readonly email: string;
  readonly isDeveloper: boolean;
}

/**
 * Fake identity database for the current local backend.
 *
 * A real auth service should return the same claims after server-side account
 * lookup. The browser must never decide developer access from an arbitrary
 * email string supplied by the client.
 */
const MOCK_IDENTITY_DATABASE: Readonly<Record<string, IdentityClaims>> = Object.freeze({
  u1: Object.freeze({
    email: 'timotholt@gmail.com',
    isDeveloper: true,
  }),
});

const NON_DEVELOPER: IdentityClaims = Object.freeze({
  email: '',
  isDeveloper: false,
});

export function getIdentityClaims(userId: string): IdentityClaims {
  return MOCK_IDENTITY_DATABASE[userId] ?? NON_DEVELOPER;
}
