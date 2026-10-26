import { presentationKeyOf, type PresentationKey, type PresentationKeyInput } from '@genoffice/ui'

/** Hancom's bare F5 selects table cells; modified F5 keys still start the show. */
export function hwpPresentationKeyOf(
  input: PresentationKeyInput,
  presenting: boolean,
): PresentationKey | null {
  const action = presentationKeyOf(input, presenting)
  return action === 'present' ? null : action
}
