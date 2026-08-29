import { TrueForge } from '@truefoundry/trueforge-sdk';
import { env } from '@/lib/config/env';

/**
 * The TrueForge harness client. Server-side only — it holds the token and
 * talks to the harness directly.
 *
 * Local TrueForge runs with authentication off: when no OIDC issuer is
 * configured the server stamps every request as an admin user, so `token`
 * is undefined in development and that is correct, not an oversight.
 */
export const harness = new TrueForge({
  baseUrl: env.TRUEFORGE_BASE_URL,
  token: env.TRUEFORGE_API_KEY,
});
