import { useState } from 'react'
import ExpenseEntryPanel from './ExpenseEntryPanel'

const fabStyle = `
  .expense-fab {
    position: fixed; bottom: 28px; right: 24px; z-index: 700;
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--color-primary, #1D9E75);
    border: none; cursor: pointer;
    box-shadow: 0 4px 20px rgba(29,158,117,0.4);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
    color: #fff; font-size: 26px; line-height: 1;
    user-select: none;
  }
  .expense-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(29,158,117,0.5);
  }
  .expense-fab:active { transform: scale(0.95); }
  .expense-fab.panel-open { transform: rotate(45deg); }

  @media (max-width: 480px) {
    .expense-fab { bottom: 20px; right: 16px; }
  }
`

export default function ExpenseFAB() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <style>{fabStyle}</style>
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
