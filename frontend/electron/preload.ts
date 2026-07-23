import { contextBridge, ipcRenderer } from 'electron'

// Expose backend API to renderer process
contextBridge.exposeInMainWorld('api', {
  // Worker operations
  worker: {
    register: (data: any) => ipcRenderer.invoke('worker:register', data),
    getAll: () => ipcRenderer.invoke('worker:getAll'),
    getById: (id: number) => ipcRenderer.invoke('worker:getById', id),
    update: (id: number, data: any) => ipcRenderer.invoke('worker:update', id, data),
    deactivate: (id: number) => ipcRenderer.invoke('worker:deactivate', id),
    search: (criteria: any) => ipcRenderer.invoke('worker:search', criteria),
  },
  
  // Attendance operations
  attendance: {
    recordEvent: (workerId: number, eventType: string) =>
      ipcRenderer.invoke('attendance:recordEvent', workerId, eventType),
    getEventsForDate: (workerId: number, date: string) =>
      ipcRenderer.invoke('attendance:getEventsForDate', workerId, date),
    calculateHours: (workerId: number, date: string) =>
      ipcRenderer.invoke('attendance:calculateHours', workerId, date),
    searchRecords: (criteria: any) => ipcRenderer.invoke('attendance:searchRecords', criteria),
    exportToCSV: (records: any[], filePath: string) =>
      ipcRenderer.invoke('attendance:exportToCSV', records, filePath),
  },
  
  // Fingerprint scanner operations
  fingerprint: {
    initialize: () => ipcRenderer.invoke('fingerprint:initialize'),
    capture: () => ipcRenderer.invoke('fingerprint:capture'),
    verify: () => ipcRenderer.invoke('fingerprint:verify'),
    getStatus: () => ipcRenderer.invoke('fingerprint:status'),
  },
  
  // Anomaly operations
  anomaly: {
    detect: (date: string) => ipcRenderer.invoke('anomaly:detect', date),
    getUnresolved: () => ipcRenderer.invoke('anomaly:getUnresolved'),
    resolve: (anomalyId: number, resolution: any) =>
      ipcRenderer.invoke('anomaly:resolve', anomalyId, resolution),
    addManualEvent: (workerId: number, eventType: string, timestamp: string) =>
      ipcRenderer.invoke('anomaly:addManualEvent', workerId, eventType, timestamp),
  },
  
  // Report operations
  reports: {
    generateDailySummary: (date: string) => ipcRenderer.invoke('reports:dailySummary', date),
    generateAnalytics: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('reports:analytics', startDate, endDate),
    preview: (reportData: any) => ipcRenderer.invoke('reports:preview', reportData),
  },
  
  // Configuration operations
  config: {
    getSite: () => ipcRenderer.invoke('config:getSite'),
    updateSite: (config: any) => ipcRenderer.invoke('config:updateSite', config),
    getOwnerEmails: () => ipcRenderer.invoke('config:getOwnerEmails'),
    addOwnerEmail: (email: string) => ipcRenderer.invoke('config:addOwnerEmail', email),
    removeOwnerEmail: (email: string) => ipcRenderer.invoke('config:removeOwnerEmail', email),
  },
  
  // Backup operations
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    getHistory: () => ipcRenderer.invoke('backup:getHistory'),
  },
})
