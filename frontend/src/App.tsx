import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { ToastProvider } from './components/Toast'
import Dashboard from './views/Dashboard'
import WorkerList from './views/WorkerList'
import WorkerRegistration from './views/WorkerRegistration'
import WorkerDetails from './views/WorkerDetails'
import AttendanceRecording from './views/AttendanceRecording'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workers" element={<WorkerList />} />
            <Route path="/workers/:id" element={<WorkerDetails />} />
            <Route path="/register" element={<WorkerRegistration />} />
            <Route path="/attendance" element={<AttendanceRecording />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
