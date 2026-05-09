import { createContext, useContext, useState } from 'react'

const AdvisorModeContext = createContext({ advisorMode: false, setAdvisorMode: () => {} })

export function useAdvisorMode() {
  return useContext(AdvisorModeContext)
}

export function AdvisorModeProvider({ children }) {
  const [advisorMode, setAdvisorMode] = useState(false)
  return (
    <AdvisorModeContext.Provider value={{ advisorMode, setAdvisorMode }}>
      {children}
    </AdvisorModeContext.Provider>
  )
}
