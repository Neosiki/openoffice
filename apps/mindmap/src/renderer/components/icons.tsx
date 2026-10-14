/**
 * The editor's own icons: plain line drawings on a 20-unit grid, stroke 1.5,
 * no fill, in the current text colour. Drawn for this app; none of them is
 * taken from another product.
 */
import type { ReactNode } from 'react'

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconSave = () => (
  <Icon>
    <path d="M4 3h9l3 3v11H4z" />
    <path d="M7 3v4h6V3M7 17v-5h6v5" />
  </Icon>
)

export const IconUndo = () => (
  <Icon>
    <path d="M7 5 3.5 8.5 7 12" />
    <path d="M3.5 8.5H12a4.5 4.5 0 0 1 0 9H8" />
  </Icon>
)

export const IconRedo = () => (
  <Icon>
    <path d="m13 5 3.5 3.5L13 12" />
    <path d="M16.5 8.5H8a4.5 4.5 0 0 0 0 9h4" />
  </Icon>
)

/** a topic with a branch going down to a new one */
export const IconChild = () => (
  <Icon>
    <rect x="2" y="3" width="8" height="5" rx="2" />
    <path d="M6 8v4a2 2 0 0 0 2 2h2" />
    <rect x="10" y="11.5" width="8" height="5" rx="2" />
  </Icon>
)

/** two topics side by side on one branch, the second one new */
export const IconSibling = () => (
  <Icon>
    <rect x="2" y="3" width="9" height="5" rx="2" />
    <rect x="2" y="12" width="9" height="5" rx="2" />
    <path d="M15.5 12.5v4M13.5 14.5h4" />
  </Icon>
)

export const IconRelationship = () => (
  <Icon>
    <path d="M3.5 14.5c2-9 11-9 13 0" />
    <path d="m13.8 12 2.7 2.5-3.3 1" />
  </Icon>
)

export const IconSummary = () => (
  <Icon>
    <path d="M5 3c3 0 3 3 3 4s0 3 3 3c-3 0-3 2-3 3s0 4-3 4" />
    <rect x="13" y="8" width="5" height="4" rx="1.5" />
  </Icon>
)

export const IconNote = () => (
  <Icon>
    <path d="M5 3h10v14H5z" />
    <path d="M8 7h4M8 10h4M8 13h2" />
  </Icon>
)

export const IconLabel = () => (
  <Icon>
    <path d="M3 4h7l7 6-7 6H3z" />
    <circle cx="7" cy="10" r="1.2" />
  </Icon>
)

export const IconLink = () => (
  <Icon>
    <path d="M8.5 11.5a3 3 0 0 0 4.2 0l3-3a3 3 0 0 0-4.2-4.2l-1 1" />
    <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-3 3a3 3 0 0 0 4.2 4.2l1-1" />
  </Icon>
)

export const IconLayout = () => (
  <Icon>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M12.4 10H16M4 10h3.6M4 5h3M4 15h3M13 5h3M13 15h3" />
  </Icon>
)

export const IconFoldAll = () => (
  <Icon>
    <path d="M4 4h12M4 16h12" />
    <path d="m7 7 3 2.5L13 7M7 13l3-2.5 3 2.5" />
  </Icon>
)

export const IconUnfoldAll = () => (
  <Icon>
    <path d="M4 10h12" />
    <path d="M7 6.5 10 4l3 2.5M7 13.5 10 16l3-2.5" />
  </Icon>
)

export const IconZoomIn = () => (
  <Icon>
    <circle cx="9" cy="9" r="5.5" />
    <path d="m13.2 13.2 3.8 3.8M9 6.5v5M6.5 9h5" />
  </Icon>
)

export const IconZoomOut = () => (
  <Icon>
    <circle cx="9" cy="9" r="5.5" />
    <path d="m13.2 13.2 3.8 3.8M6.5 9h5" />
  </Icon>
)

export const IconFit = () => (
  <Icon>
    <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    <rect x="7" y="7" width="6" height="6" rx="1" />
  </Icon>
)

export const IconPlus = () => (
  <Icon size={14}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
)

export const IconClose = () => (
  <Icon size={12}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Icon>
)
