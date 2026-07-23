import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './views/Dashboard'
import WorkerList from './views/WorkerList'
import WorkerRegistration from './views/WorkerRegistration'
import WorkerDetails from './views/WorkerDetails'
import AttendanceRecording from './views/AttendanceRecording'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workers" element={<WorkerList />} />
          <Route path="/workers/:id" element={<WorkerDetails />} />
          <Route path="/register" element={<WorkerRegistration />} />
          <Route path="/attendance" element={<AttendanceRecording />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
