/**
 * The built-in templates in display order. Adding a template is one import and
 * one array entry; the order here is the order the user sees.
 */
import type { SlideTemplate } from './contract'
import { coral } from './coral'

export const SLIDE_TEMPLATES: readonly SlideTemplate[] = [coral]
