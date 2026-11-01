import 'antd/dist/reset.css'
import { createRoot } from 'react-dom/client'

import './app.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
