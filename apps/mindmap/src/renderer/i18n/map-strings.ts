import type { Lang } from '@genoffice/i18n'
import type { MapStrings } from '../map/controller'
import { translateIn } from './locale'

/**
 * The texts the map itself shows, in one language: the titles new topics and
 * summaries start with, and the drawing library's context menu. The library
 * ships its own menu texts for a handful of languages; all twelve entries are
 * passed from this app's dictionaries instead, so every one of the 21
 * languages has them.
 */
export function mapStrings(lang: Lang): MapStrings {
  const text = (key: Parameters<typeof translateIn>[1]): string => translateIn(lang, key)
  return {
    newTopic: text('newTopic'),
    summary: text('tbSummary'),
    menu: {
      addChild: text('meAddChild'),
      addParent: text('meAddParent'),
      addSibling: text('meAddSibling'),
      removeNode: text('meRemoveNode'),
      focus: text('meFocus'),
      cancelFocus: text('meCancelFocus'),
      moveUp: text('meMoveUp'),
      moveDown: text('meMoveDown'),
      link: text('meLink'),
      linkBidirectional: text('meLinkBidirectional'),
      clickTips: text('meClickTips'),
      summary: text('meSummary'),
    },
    menuRelationship: text('tbRelationship'),
    menuLabel: text('tbLabel'),
    menuNote: text('tbNote'),
    menuLink: text('tbLink'),
  }
}
