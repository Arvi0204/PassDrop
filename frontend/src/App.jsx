import './App.css'
import Navbar from './components/Navbar'
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom"
import { ThemeProvider } from './context/ThemeContext'
import PasswordState from './context/PasswordState'
import FormState from './context/FormState'
import Login from './components/Login'
import Signup from './components/Signup'
import Manager from './components/Manager'
import { Toaster } from 'react-hot-toast';
import Home from './components/Home'
import UserDetails from './components/UserDetails'
import ExtensionInstructions from './components/ExtensionInstructions'


function App() {

  return (
    <ThemeProvider>
      <PasswordState>
        <FormState>
          <Router>
            <Toaster
              position={window.innerWidth < 768 ? "top-center" : "top-right"}
              reverseOrder={true}
              gutter={8}
              toastOptions={{
                // Define default options
                className: '',
                duration: 5000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },

                // Default options for specific types
                success: {
                  duration: 3000,
                  theme: {
                    primary: 'green',
                    secondary: 'black',
                  },
                },
              }}
            />
            {/* Container with flexbox layout */}
            <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
              <Navbar />
              <div className="flex-grow flex flex-col"> {/* This will take remaining space */}
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
        </FormState>
      </PasswordState>
    </ThemeProvider>
  )
}

export default App
