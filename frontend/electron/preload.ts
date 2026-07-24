import { contextBridge, ipcRenderer } from 'electron'

export type ServiceStatus = {
  phase: string
  detail?: string
  ready: boolean
  error?: string
  fingerprintMock?: boolean
}

contextBridge.exposeInMainWorld('ubaka', {
  getServiceStatus: (): Promise<ServiceStatus> => ipcRenderer.invoke('services:getStatus'),
  onServiceStatus: (callback: (status: ServiceStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ServiceStatus) => {
      callback(status)
    }
    ipcRenderer.on('services:status', handler)
    return () => ipcRenderer.removeListener('services:status', handler)
  },
})
