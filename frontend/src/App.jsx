import Navbar from './components/Navbar'
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom"
import PasswordState from './context/PasswordState'
import Login from './components/Login'
import Signup from './components/Signup'
import Manager from './components/Manager'
import { Toaster } from 'react-hot-toast';
import Home from './components/Home'
import UserDetails from './components/UserDetails'
import ExtensionInstructions from './components/ExtensionInstructions'

function App() {
  return (
    <PasswordState>
      <Router>
        <Toaster
          position="bottom-right"
          gutter={10}
          toastOptions={{
            duration: 4000,
            className: '!bg-[#f5fafc]/95 !text-[#0c1820] !border !border-white/90 !shadow-xl !backdrop-blur-md !rounded-xl !text-xs sm:!text-sm !font-semibold !py-2.5 !px-3.5',
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#112838',
                secondary: '#ffffff',
              },
            },
            error: {
              duration: 4500,
              iconTheme: {
                primary: '#e11d48',
                secondary: '#ffffff',
              },
            },
          }}
        />
        {/* Transparent container letting fixed body gradients show through */}
        <div className="flex flex-col min-h-screen bg-transparent">
          <Navbar />
          <div className="flex-grow flex flex-col">
            <Routes>
              <Route exact path="/home" element={<Home />} />
              <Route exact path="/login" element={<Login />} />
              <Route exact path="/signup" element={<Signup />} />
              <Route exact path="/" element={<Manager />} />
              <Route exact path="/user" element={<UserDetails />} />
              <Route exact path="/extension" element={<ExtensionInstructions />} />
            </Routes>
          </div>
        </div>
      </Router>
    </PasswordState>
  )
}

export default App
