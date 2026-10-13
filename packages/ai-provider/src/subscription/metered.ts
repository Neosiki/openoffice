/**
 * "Use anyway" for a metered login.
 *
 * The user's choice is the boolean `AiSettings.meteredAccepted[provider]`. A
 * boolean alone cannot tell whether the login it was given for is still the
 * one in use, and the app must not store who is signed in. So next to the
 * setting the app remembers one short value per provider: the kind of login
 * the acceptance was given for (`metered:api_key/firstParty`,
 * `unknown:oauth_token/firstParty`, `metered:api-key`, …), as the CLI itself
 * names it. It contains no email, organisation, key or token.
 *
 * An acceptance counts only while the detected login has that same kind. It is
 * cleared when the kind changes (API key to Bedrock, metered to subscription),
 * when the CLI is signed out, and when the stored flag has no remembered kind
 * at all. Not detected, because it would take an account identifier: one API
 * key swapped for another of the same kind.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AI_SUBSCRIPTION_PROVIDERS } from '../providers'
import type { AiSubscriptionProviderId } from '../types'
import type { SubscriptionDetection } from './status'

/** Per provider: the kind of login the metered acceptance was given for */
export type MeteredAcceptanceRecord = Partial<Record<AiSubscriptionProviderId, string>>

export interface MeteredAcceptanceStore {
  read(): Promise<MeteredAcceptanceRecord>
  write(record: MeteredAcceptanceRecord): Promise<void>
}

/** File the acceptance record is kept in, inside the directory the app passes */
export const SUBSCRIPTION_METERED_FILE = 'subscription-metered.json'

const MAX_FINGERPRINT_LENGTH = 120

/**
 * The kind of a metered (or unknown) login, as remembered with an acceptance.
 * Null for anything that is not a metered login.
 */
export function meteredLoginFingerprint(detection: SubscriptionDetection): string | null {
  if (detection.state !== 'metered' || !detection.loginMethod) return null
  return `${detection.loginMethod}:${detection.loginKind ?? 'unknown'}`.slice(
    0,
    MAX_FINGERPRINT_LENGTH,
  )
}

/**
 * Whether a stored acceptance applies to the login just detected, and whether
 * the stored values must be cleared.
 */
export function reconcileMeteredAcceptance(
  detection: SubscriptionDetection,
  stored: { accepted: boolean; fingerprint?: string | undefined },
): { meteredAccepted: boolean; clear: boolean } {
  const hasStored = stored.accepted || !!stored.fingerprint
  // a check that could not tell says nothing about the login: keep what is stored
  if (detection.state === 'error' || detection.state === 'not-installed') {
    return { meteredAccepted: false, clear: false }
  }
  const current = meteredLoginFingerprint(detection)
  if (current && stored.accepted && stored.fingerprint === current) {
    return { meteredAccepted: true, clear: false }
  }
  // signed out, a subscription now, another kind of metered login, or half a record
  return { meteredAccepted: false, clear: hasStored }
}

/** The acceptance record as a small JSON file in `dir` (the app's userData directory) */
export function createMeteredAcceptanceFileStore(dir: string): MeteredAcceptanceStore {
  const file = join(dir, SUBSCRIPTION_METERED_FILE)
  return {
    async read() {
      let parsed: unknown
      try {
        parsed = JSON.parse(await readFile(file, 'utf8'))
      } catch {
        return {}
      }
      const record: MeteredAcceptanceRecord = {}
      if (!parsed || typeof parsed !== 'object') return record
      for (const provider of AI_SUBSCRIPTION_PROVIDERS) {
        const value = (parsed as Record<string, unknown>)[provider]
        if (typeof value === 'string' && value && value.length <= MAX_FINGERPRINT_LENGTH) {
          record[provider] = value
        }
      }
      return record
    },
    async write(record) {
      const clean: MeteredAcceptanceRecord = {}
      for (const provider of AI_SUBSCRIPTION_PROVIDERS) {
        const value = record[provider]
        if (value) clean[provider] = value
      }
      await mkdir(dir, { recursive: true })
      const temp = `${file}.tmp`
      await writeFile(temp, JSON.stringify(clean))
      await rename(temp, file)
    },
  }
}
