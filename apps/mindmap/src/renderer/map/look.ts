/**
 * How a map is drawn: the theme object handed to the drawing library.
 *
 * The colours of a map are document content. They come from the engine's
 * theme data and do not follow the app's light or dark setting; nothing here
 * reads a chrome token. What does follow the app (the selection outline, the
 * context menu, the edit box) is styled in `styles.css` instead.
 *
 * This is the plain version: ground, text, the central topic and one colour
 * per main branch. The full looks (topic shapes, branch lines, the dark and
 * tinted grounds, the theme panel) replace `lookOfSheet` and `libraryTheme`.
 */
import type { Theme } from 'mind-elixir'
import {
  DEFAULT_THEME_ID,
  recogniseSheetTheme,
  themeLook,
  type ThemeLook,
  type XmindSheet,
} from '@genoffice/xmind-engine'

/** The look a sheet is drawn with: its own theme when this app wrote it, the default look otherwise. */
export function lookOfSheet(sheet: XmindSheet): ThemeLook {
  return themeLook(recogniseSheetTheme(sheet) ?? DEFAULT_THEME_ID)
}

/** A look as the library's theme: its variables and the palette of the main branches. */
export function libraryTheme(look: ThemeLook): Theme {
  const { spacing } = look
  return {
    name: look.id,
    type: look.variant === 'dark' ? 'dark' : 'light',
    palette: look.branches.map((branch) => branch.color),
    cssVar: {
      '--node-gap-x': `${spacing.subGapX}px`,
      '--node-gap-y': `${spacing.subGapY}px`,
      '--main-gap-x': `${spacing.mainGapX}px`,
      '--main-gap-y': `${spacing.mainGapY}px`,
      '--bgcolor': look.ground,
      '--color': look.text,
      '--main-color': look.strongText,
      '--main-bgcolor': look.ground,
      '--main-bgcolor-transparent': look.ground,
      '--root-color': look.central.text,
      '--root-bgcolor': look.central.fill ?? look.ground,
      '--root-border-color': look.central.border ?? 'transparent',
      '--root-radius': '14px',
      '--main-radius': '10px',
      '--topic-padding': '4px 8px',
      '--map-padding': '60px 90px',
      // the menu and the tips are app chrome; `styles.css` gives them their colours
      '--panel-color': look.text,
      '--panel-bgcolor': look.ground,
      '--panel-border-color': look.text,
      '--selected': look.strongText,
      '--accent-color': look.branches[0]?.color ?? look.strongText,
    },
  }
}
