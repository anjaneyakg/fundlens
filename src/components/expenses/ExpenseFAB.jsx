import { useState } from 'react'
import ExpenseEntryPanel from './ExpenseEntryPanel'

const fabCSS = `
  .expense-fab {
    position: fixed;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    right: 24px;
    z-index: 700;
    width: 56px; height: 56px; border-radius: 50%;
    background: #1A3C6E;
    border: none; cursor: pointer;
    box-shadow: 0 4px 20px rgba(26,60,110,0.4);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.18s, box-shadow 0.18s, background 0.15s;
    color: #ffffff; font-size: 26px; font-weight: 300; line-height: 1;
    user-select: none;
  }
  .expense-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(26,60,110,0.5);
    background: #15306b;
  }
  .expense-fab:active { transform: scale(0.94); }
  .expense-fab.panel-open {
    transform: rotate(45deg);
    background: #374151;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }

  @media (max-width: 480px) {
    .expense-fab { right: 16px; }
  }
`

export default function ExpenseFAB() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <style>{fabCSS}</style>
      <button
        className={`expense-fab${panelOpen ? ' panel-open' : ''}`}
        onClick={() => setPanelOpen(true)}
        aria-label="Log expense"
        title="Log expense"
      >
        +
      </button>
      <ExpenseEntryPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
