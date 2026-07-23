import api from './api'

export interface IdentifyResult {
    workerId: number
    worker: {
        id: number
        worker_number: string
        full_name: string
        nid: string
        classification: string
        phone_number?: string
        hourly_rate: number | string
        is_active: boolean
    }
    confidence?: number
}

const fingerprintService = {
    /**
     * Triggers a 3-scan enrollment on the hardware scanner.
     * The user must place their finger 3 times.
     * Returns a Base64-encoded template string ready to submit to the backend.
     * Calls POST /api/fingerprint/capture/enroll
     */
    async captureForEnrollment(): Promise<{ templateId: string; template: string; quality: number }> {
        const response = await api.post('/fingerprint/capture/enroll')
        if (!response.data?.success) {
            throw new Error(response.data?.error || 'Enrollment capture failed')
        }
        return response.data.data as { templateId: string; template: string; quality: number }
    },

    /**
     * Triggers a scan on the hardware scanner and identifies the worker
     * against all stored fingerprint templates in the database.
     * Calls POST /api/fingerprint/identify
     */
    async identify(): Promise<IdentifyResult> {
        const response = await api.post('/fingerprint/identify')
        if (!response.data?.success) {
            throw new Error(response.data?.error || 'Fingerprint not recognized')
        }
        return response.data.data as IdentifyResult
    },

    /**
     * Get current scanner status
     */
    async getStatus(): Promise<{ connected: boolean; mode: string; model: string }> {
        const response = await api.get('/fingerprint/status')
        return response.data?.data || { connected: false, mode: 'UNKNOWN', model: 'Unknown' }
    }
}

export default fingerprintService
