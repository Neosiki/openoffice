/**
 * The preview picture written into the file on save.
 *
 * Nothing makes one yet: without a provider a save passes no picture and the
 * engine keeps the one the file already has. The export work registers a
 * provider here; saving needs no other change.
 */

/** A PNG of the map as it should look in a file browser, or null when none can be made. */
export type ThumbnailProvider = () => Promise<Uint8Array | null>

let provider: ThumbnailProvider | null = null

export function setThumbnailProvider(next: ThumbnailProvider | null): void {
  provider = next
}

/** The picture for this save. A provider that fails costs the picture, never the save. */
export async function thumbnailForSave(): Promise<Uint8Array | null> {
  if (!provider) return null
  try {
    return await provider()
  } catch (error) {
    console.warn('[mindmap] no preview picture for this save:', error)
    return null
  }
}
