import Navbar from './components/Navbar'
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom"
import PasswordState from './context/PasswordState'
import { TideProvider } from './context/TideContext'
import Login from './components/Login'
import Signup from './components/Signup'
import Recover from './components/Recover'
import Manager from './components/Manager'
import WaterToaster from './components/common/WaterToaster'
import Home from './components/Home'
import UserDetails from './components/UserDetails'
import ExtensionInstructions from './components/ExtensionInstructions'
import Drop from './components/Drop'

function App() {
  return (
    <PasswordState>
      <TideProvider>
      <Router>
        <WaterToaster />
        {/* Transparent container letting fixed body gradients show through */}
        <div className="flex flex-col min-h-screen bg-transparent">
          <Navbar />
          <div className="flex-grow flex flex-col">
            <Routes>
              <Route exact path="/home" element={<Home />} />
              <Route exact path="/login" element={<Login />} />
              <Route exact path="/signup" element={<Signup />} />
              <Route exact path="/recover" element={<Recover />} />
              <Route exact path="/" element={<Manager />} />
              <Route exact path="/user" element={<UserDetails />} />
              <Route exact path="/extension" element={<ExtensionInstructions />} />
              <Route exact path="/drop/:id" element={<Drop />} />
            </Routes>
          </div>
        </div>
      </Router>
      </TideProvider>
    </PasswordState>
  )
}

export default App
