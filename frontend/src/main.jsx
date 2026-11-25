import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* reducedMotion="user": honor the OS setting for every framer-motion animation */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
