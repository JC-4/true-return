'use client'

import { useCallback, useEffect, useRef } from 'react'
import LeadGenForm, { type LeadFormVariant } from '@/components/LeadGenForm'

/**
 * The second container for LeadGenForm. The form itself is unchanged and
 * unduplicated: same fields, same validation, same POST, same sessionStorage
 * handoff to /thank-you. Only the box around it differs.
 *
 * Native <dialog> + showModal() is doing the accessibility work here rather
 * than a hand-rolled equivalent: it puts the dialog in the top layer, makes
 * everything behind it inert (so focus is trapped without a key handler),
 * closes on Escape, and restores focus to the trigger on close. The two things
 * it does not do are scroll locking and deterministic initial focus, which are
 * handled below.
 */
export default function LeadFormDialog({
  open,
  onClose,
  projectName,
  isProjectPage = true,
  source,
  variant,
}: {
  open: boolean
  onClose: () => void
  projectName: string
  isProjectPage?: boolean
  /** Distinguishes this conversion from the inline form's, both on the lead
   *  record and in the conversion event fired on /thank-you. */
  source: string
  /** What the trigger promised, so the form can promise the same thing. Set by
   *  the button that opened the dialog, alongside `source`. */
  variant?: LeadFormVariant
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  /** The element that opened the dialog. <dialog> restores focus itself, but
   *  only when it closes while still connected; doing it explicitly also
   *  covers the case where React re-renders the trigger in between. */
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return

    if (open && !d.open) {
      openerRef.current = document.activeElement as HTMLElement | null
      d.showModal()
      // showModal focuses the first focusable child, which is the Name field.
      // On a phone that opens the keyboard over the dialog before the reader
      // has seen it, so focus lands on Close instead: still inside the dialog,
      // still the first thing a screen reader announces after the title.
      closeRef.current?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  // Escape fires `cancel`; let it through to the same close path as the button
  // so there is one way out rather than two behaviours to keep in step.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const handleCancel = (e: Event) => { e.preventDefault(); onClose() }
    d.addEventListener('cancel', handleCancel)
    return () => d.removeEventListener('cancel', handleCancel)
  }, [onClose])

  // showModal makes the background inert but does not stop it scrolling.
  //
  // The lock goes on <html>, not <body>: the documentElement is the scrolling
  // element here, and overflow:hidden on body alone does nothing — measured,
  // the page still scrolled behind the open dialog.
  //
  // Hiding the scrollbar widens the viewport, which would shove the page
  // sideways as the dialog opens, so the width it freed is added back as
  // padding. Overlay scrollbars report 0 and get no padding.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const scrollbar = window.innerWidth - root.clientWidth
    const prevOverflow = root.style.overflow
    const prevPadding = document.body.style.paddingRight

    root.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    return () => {
      root.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
    }
  }, [open])

  // Restore focus to whatever opened it.
  useEffect(() => {
    if (open) return
    const opener = openerRef.current
    if (opener && document.contains(opener)) opener.focus()
    openerRef.current = null
  }, [open])

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    // A click on the <dialog> itself is a click on the backdrop: the panel
    // inside covers the whole element otherwise.
    if (e.target === dialogRef.current) onClose()
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="lead-dialog"
      aria-labelledby="lead-dialog-title"
      onClick={handleBackdropClick}
    >
      <div className="lead-dialog-panel bg-brand-bg">
        {/* The dialog is named by the form's own "Interested in …?" heading
            rather than a second one of its own: two headings 40px apart in a
            box this size read as an editing artefact. The row survives because
            the close button still needs somewhere to sit, pushed right on its
            own. */}
        <div className="flex items-start justify-end gap-4 px-6 pt-6 pb-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[3px] text-brand-muted hover:text-brand-text transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6">
          <LeadGenForm
            projectName={projectName}
            isProjectPage={isProjectPage}
            source={source}
            variant={variant}
            headingId="lead-dialog-title"
          />
        </div>
      </div>
    </dialog>
  )
}
