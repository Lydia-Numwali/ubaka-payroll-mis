/// <reference types="vite/client" />

type UbakaServiceStatus = {
  phase: string
  detail?: string
  ready: boolean
  error?: string
  fingerprintMock?: boolean
}

interface Window {
  ubaka?: {
    getServiceStatus: () => Promise<UbakaServiceStatus>
    onServiceStatus: (callback: (status: UbakaServiceStatus) => void) => () => void
  }
}
