/**
 * A theme in the file's own terms, and telling one of ours when it comes back.
 *
 * The format keeps a sheet's theme as one property table per level (`map`,
 * `centralTopic`, `mainTopic`, `subTopic`), each wrapped as
 * `{ id, properties }`. The property names and the `org.xmind.*` class names
 * below are identifiers of the file format, read and written for
 * compatibility; every value written under them is this project's own.
 *
 * The app puts no mark of its own into the file. A theme is recognised by its
 * table alone: property for property the same as one this app writes, or
 * wrote in an earlier release. Anything else, such as a theme from another
 * program or one of ours that another program saved again with different
 * properties, is not recognised, and nothing here ever changes it.
 */

import { mixColors } from './theme-color'
import { THEME_IDS, type ThemeBranchShape, type ThemeId, type ThemeTopicShape } from './theme-data'
import { themeLook, type ThemeLook } from './theme-look'
import { isRecord, type XmindSheet } from './types'

/** The properties of one level, by the name the file uses for each. */
export type ThemeLevelProperties = Readonly<Record<string, string>>

/** A theme as the file holds it, without the ids: level name to properties. */
export type ThemeProperties = Readonly<Record<string, ThemeLevelProperties>>

/** One table and the theme it stands for. */
export interface ThemeTableEntry {
  themeId: ThemeId
  properties: ThemeProperties
}

const ROUNDED_SHAPE = 'org.xmind.topicShape.roundedRect'
const UNDERLINE_SHAPE = 'org.xmind.topicShape.underline'
const BRANCH_CLASS: Readonly<Record<ThemeBranchShape, string>> = {
  curve: 'org.xmind.branchConnection.curve',
  'rounded-elbow': 'org.xmind.branchConnection.roundedElbow',
}
/** the format's word for "take this from the branch the topic is on" */
const INHERITED = 'inherited'
/**
 * Share of the strongest text colour in a soft fill as the file gets it. The
 * format has no "a little of the branch colour", so a softly filled topic is
 * written with one quiet fill for all branches.
 */
const SOFT_FILL_IN_FILE = 0.08

/**
 * The file takes whole numbers. A half rounds down, so that a line drawn
 * thinner on screen is still the thinner one in the file.
 */
function whole(value: number): number {
  return Math.ceil(value - 0.5)
}

function points(value: number): string {
  return `${whole(value)}pt`
}

interface LevelColors {
  fill: string
  line: string
  border: string
}

function topicProperties(
  shape: ThemeTopicShape,
  colors: LevelColors,
  lineWidth: number,
  branch: ThemeBranchShape,
): ThemeLevelProperties {
  return {
    'fo:font-size': points(shape.fontSize),
    'fo:font-weight': String(whole(shape.fontWeight / 100) * 100),
    'svg:fill': colors.fill,
    'fill-pattern': shape.fill === 'none' ? 'none' : 'solid',
    'line-width': points(lineWidth),
    'line-color': colors.line,
    'border-line-color': colors.border,
    'border-line-width': points(shape.borderWidth),
    'shape-class': shape.border === 'underline' ? UNDERLINE_SHAPE : ROUNDED_SHAPE,
    'line-class': BRANCH_CLASS[branch],
  }
}

/**
 * The properties this app writes for a look.
 *
 * How the skeletons carry over: a pill and a capsule are a rounded rectangle
 * (the pill with a quiet fill, the capsule with an outline), a block is a
 * rounded rectangle filled with its branch colour, and the line skeleton is
 * the underline shape. Sizes, weights and line widths go in as whole numbers.
 * No font name is written, and no text colour: each program then uses its own
 * font and picks the text colour that reads on the fill.
 *
 * Every colour here comes from `mixColors` and `raiseColor` alone (see
 * `theme-color.ts`), so a table does not shift between releases by accident.
 */
export function themePropertiesOf(look: ThemeLook): ThemeProperties {
  const { shapes, ground, strongText } = look
  const softFill = mixColors(ground, strongText, SOFT_FILL_IN_FILE)
  const branchColors = (shape: ThemeTopicShape): LevelColors => ({
    fill: shape.fill === 'soft' ? softFill : INHERITED,
    line: INHERITED,
    border: INHERITED,
  })
  return {
    map: {
      'svg:fill': ground,
      'multi-line-colors': look.branches.map((branch) => branch.color).join(' '),
      'color-list': look.bandColors.join(' '),
      'line-tapered': 'none',
    },
    centralTopic: topicProperties(
      shapes.central,
      {
        fill: shapes.central.fill === 'none' ? ground : strongText,
        line: strongText,
        border: strongText,
      },
      look.lines.main.width,
      look.lines.main.shape,
    ),
    mainTopic: topicProperties(
      shapes.main,
      branchColors(shapes.main),
      look.lines.sub.width,
      look.lines.sub.shape,
    ),
    subTopic: topicProperties(
      shapes.sub,
      branchColors(shapes.sub),
      look.lines.sub.width,
      look.lines.sub.shape,
    ),
  }
}

/**
 * What a table is compared by: its levels and their properties in a fixed
 * order, as text. Null for anything that is not a table of properties. The
 * `id` of a level is the one part left out, because it is made anew on every
 * write; a level with any other key beside `properties` is not ours.
 */
function tableKey(theme: unknown): string | null {
  if (!isRecord(theme)) return null
  const levels: [string, [string, string][]][] = []
  for (const name of Object.keys(theme).sort()) {
    const level = theme[name]
    if (!isRecord(level) || !isRecord(level.properties)) return null
    if (Object.keys(level).some((key) => key !== 'id' && key !== 'properties')) return null
    const { properties } = level
    const pairs: [string, string][] = []
    for (const property of Object.keys(properties).sort()) {
      const value = properties[property]
      if (typeof value !== 'string') return null
      pairs.push([property, value])
    }
    levels.push([name, pairs])
  }
  return JSON.stringify(levels)
}

function propertiesKey(properties: ThemeProperties): string {
  const table = Object.fromEntries(
    Object.entries(properties).map(([name, level]) => [name, { properties: level }]),
  )
  return tableKey(table)!
}

function frozen(properties: ThemeProperties): ThemeProperties {
  for (const level of Object.values(properties)) Object.freeze(level)
  return Object.freeze(properties)
}

/**
 * The first of the two lists: the table written for each theme today. One
 * entry per theme, in the order of `THEME_IDS`, worked out from the theme
 * table.
 */
export const WRITTEN_THEME_TABLES: readonly ThemeTableEntry[] = THEME_IDS.map((themeId) => ({
  themeId,
  properties: frozen(themePropertiesOf(themeLook(themeId))),
}))

/**
 * The second list: tables an earlier release wrote for a theme whose values
 * have changed since. They are recognised and never written.
 *
 * A file saved by an older release must still open as the theme its user
 * picked. So before changing a value that has shipped (a band colour, a size,
 * a rule), copy the table each affected theme has in the last release into
 * this list, under the same theme id, and only then change the value. Such a
 * file is then drawn with the theme's present look, and keeps the old
 * properties until the user picks a theme again. `tests/theme-table.test.ts`
 * pins the tables written today and fails when one of them moves, as the
 * reminder to do this. Values that never shipped need no entry.
 *
 * Nothing has shipped yet, so the list is empty.
 */
export const SHIPPED_THEME_TABLES: readonly ThemeTableEntry[] = []

const written = new Map(WRITTEN_THEME_TABLES.map((entry) => [entry.themeId, entry.properties]))

/** The table written for a theme today. Frozen: copy it before putting it into a sheet. */
export function writtenThemeProperties(id: ThemeId): ThemeProperties {
  const properties = written.get(id)
  if (!properties) throw new Error(`xmind: there is no theme ${String(id)}`)
  return properties
}

/** Tells which theme a sheet's `theme` value is, or null when it is none this app wrote. */
export type ThemeRecogniser = (theme: unknown) => ThemeId | null

/**
 * A recogniser over the two lists. A table must be equal to a listed one in
 * every level and every property (their order does not matter, the level ids
 * are not compared).
 *
 * Throws when two different themes share a table: a file could then not be
 * told apart, whichever of the two wrote it. With the lists of this module
 * that would be a mistake in the theme table, and it surfaces as soon as the
 * module is loaded, in every test.
 */
export function createThemeRecogniser(
  writtenTables: readonly ThemeTableEntry[],
  shippedBefore: readonly ThemeTableEntry[] = [],
): ThemeRecogniser {
  const themes = new Map<string, ThemeId>()
  for (const { themeId, properties } of [...writtenTables, ...shippedBefore]) {
    const key = propertiesKey(properties)
    const known = themes.get(key)
    if (known !== undefined && known !== themeId) {
      throw new Error(`xmind: themes ${known} and ${themeId} have the same table`)
    }
    themes.set(key, themeId)
  }
  return (theme) => {
    const key = tableKey(theme)
    return key === null ? null : (themes.get(key) ?? null)
  }
}

/** Which of this app's themes a `theme` value is; null when it is not one of them. */
export const recogniseTheme: ThemeRecogniser = createThemeRecogniser(
  WRITTEN_THEME_TABLES,
  SHIPPED_THEME_TABLES,
)

/**
 * Which of this app's themes a sheet carries; null when its theme is absent
 * or not one this app wrote, in which case the editor draws the default look
 * and leaves the file's theme alone. Only reads: the sheet is never changed
 * and the document is not marked.
 */
export function recogniseSheetTheme(sheet: XmindSheet): ThemeId | null {
  return recogniseTheme(sheet.theme)
}
