import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  /** Horizontal edge of the anchor the menu is pinned to. */
  align?: 'start' | 'end'
  /** 'bottom' opens below the anchor (default); 'top' opens above it —
   *  use 'top' for anchors near the bottom of the window, like the player
   *  bar, where a downward menu would render off-screen. */
  placement?: 'bottom' | 'top'
  className?: string
  children: ReactNode
}

/**
 * Renders its content into a portal on `document.body`, positioned with
 * `position: fixed` from the anchor's live bounding rect, instead of as a
 * normal absolutely-positioned child of the trigger.
 *
 * Nesting the menu inside the trigger's own DOM subtree (the original
 * approach) meant any scrollable ancestor clipped it — most visibly the
 * home-feed shelves, which need `overflow-x: auto` for the horizontal
 * card carousel. Per the CSS overflow spec, setting overflow-x to
 * anything but `visible` forces the paired overflow-y to resolve to
 * `auto` too, so the menu's popover — which extends well below the
 * 172px card art — got silently cut off at the shelf row's bottom edge.
 * A portal escapes that ancestor entirely, so clipping (and the
 * transform-based hover lift on `.home-card` creating its own containing
 * block for fixed descendants) no longer applies.
 */
export default function Popover({ open, onClose, anchorRef, align = 'end', placement = 'bottom', className, children }: Props): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = (): void => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({
        top: placement === 'top' ? rect.top : rect.bottom,
        left: align === 'end' ? rect.right : rect.left
      })
    }
    update()
    // Anchors can move without the popover itself re-rendering — scrolling
    // a song list or resizing the window while a menu is open, for example.
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, align, placement])

  // Anchor-relative positioning alone can place the menu partly or entirely
  // off-screen — a wide menu anchored to a trigger near the window's right
  // edge, for instance. This measures the *actually rendered* box (now
  // that its content exists) and nudges pos back inside the viewport.
  // Runs again whenever pos changes, including from its own correction;
  // it converges in at most two passes since a corrected position measures
  // as non-overflowing and bails out (returns the same object, no further
  // state update). useLayoutEffect so the correction lands before paint —
  // nothing visibly jumps.
  useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const margin = 8
    setPos((prev) => {
      if (!prev) return prev
      let { left, top } = prev
      const overflowRight = rect.right - (window.innerWidth - margin)
      if (overflowRight > 0) left -= overflowRight
      const overflowLeft = margin - rect.left
      if (overflowLeft > 0) left += overflowLeft
      const overflowBottom = rect.bottom - (window.innerHeight - margin)
      if (overflowBottom > 0) top -= overflowBottom
      const overflowTop = margin - rect.top
      if (overflowTop > 0) top += overflowTop
      if (left === prev.left && top === prev.top) return prev
      return { left, top }
    })
  }, [open, pos])

  // A portal means the menu is no longer a DOM descendant of the trigger,
  // so the app's usual "close on blur, unless focus moved into the menu"
  // pattern (checking DOM containment) can't see it anymore — clicking
  // into the menu would blur the trigger and close the menu before the
  // click registers. Click-outside detection against both elements'
  // refs works regardless of where the portal renders in the tree.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, anchorRef, onClose])

  if (!open || !pos) return null

  // The menu classes this renders with (.card-menu, .playlist-menu) still
  // carry their old stylesheet `top`/`right` offsets, written for when the
  // menu was a normal absolutely-positioned child of the trigger. Left
  // alone, those combine with the inline `left` below into a `left` +
  // `right` pair, which — with an auto width — stretches the menu box to
  // span between the two instead of sizing to its content. All four inset
  // properties are set explicitly here so nothing from the stylesheet
  // survives the switch to fixed positioning.
  const style: CSSProperties = {
    position: 'fixed',
    left: pos.left,
    right: 'auto',
    top: placement === 'top' ? 'auto' : pos.top + 4,
    bottom: placement === 'top' ? window.innerHeight - pos.top + 4 : 'auto',
    ...(align === 'end' ? { transform: 'translateX(-100%)' } : {})
  }

  return createPortal(
    <div ref={menuRef} className={className} style={style}>
      {children}
    </div>,
    document.body
  )
}
