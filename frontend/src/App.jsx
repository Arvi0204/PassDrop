import Navbar from './components/Navbar'
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom"
import { ThemeProvider } from './context/ThemeContext'
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
    <ThemeProvider>
      <PasswordState>
        <Router>
          <Toaster
            position="bottom-right"
            gutter={10}
            toastOptions={{
              duration: 4000,
              className: '!bg-white dark:!bg-slate-800 !text-slate-800 dark:!text-slate-100 !border !border-slate-200/80 dark:!border-slate-700/80 !shadow-xl !shadow-slate-900/10 dark:!shadow-black/50 !rounded-xl !text-xs sm:!text-sm !font-medium !py-2.5 !px-3.5',
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                duration: 4500,
                iconTheme: {
                  primary: '#f43f5e',
                  secondary: '#ffffff',
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
      </PasswordState>
    </ThemeProvider>
  )
}

export default App
