import { useState, useEffect } from 'react'

const toastCSS = `
  @keyframes toast-in {
    from { transform: translateX(-50%) translateY(-120%); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
  }
  @keyframes toast-out {
    from { transform: translateX(-50%) translateY(0);     opacity: 1; }
    to   { transform: translateX(-50%) translateY(-120%); opacity: 0; }
  }
  .fl-toast {
    position: fixed; top: 16px; left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    max-width: 320px; width: calc(100% - 32px);
    padding: 12px 20px; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
    color: #ffffff; text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.22);
    pointer-events: none;
    animation: toast-in 0.25s cubic-bezier(0.22,1,0.36,1) forwards;
  }
  .fl-toast.fl-toast-exit {
    animation: toast-out 0.25s ease forwards;
  }
  .fl-toast.fl-toast-success { background: #1A3C6E; }
  .fl-toast.fl-toast-error   { background: #dc2626; }
`

export default function Toast({ message, type = 'success', duration = 2500, onDismiss }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const hideTimer = setTimeout(() => setExiting(true), duration)
    const doneTimer = setTimeout(() => onDismiss?.(), duration + 280)
    return () => { clearTimeout(hideTimer); clearTimeout(doneTimer) }
  }, [duration, onDismiss])

  return (
    <>
      <style>{toastCSS}</style>
      <div className={`fl-toast fl-toast-${type}${exiting ? ' fl-toast-exit' : ''}`}>
        {message}
      </div>
    </>
  )
}
