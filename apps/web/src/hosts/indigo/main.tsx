import { createRoot } from 'react-dom/client'
import { AirlineHostApp } from '../AirlineShell'

createRoot(document.getElementById('root')!).render(<AirlineHostApp carrier="indigo" />)

