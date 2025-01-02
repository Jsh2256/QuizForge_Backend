// src/services/transcribeService.js
const { transcribe } = require('./aws')

const startTranscriptionJob = async (params) => {
    try {
        return await transcribe.startTranscriptionJob(params)
    } catch (error) {
        console.error('Transcription start error:', error)
        throw error
    }
}

const getTranscriptionJobStatus = async (jobName) => {
    try {
        const response = await transcribe.getTranscriptionJob({
            TranscriptionJobName: jobName
        })

        const job = response.TranscriptionJob
        return {
            status: job.TranscriptionJobStatus.toLowerCase(),
            outputUrl: job.Transcript?.TranscriptFileUri,
            completedAt: job.CompletionTime,
            failureReason: job.FailureReason
        }
    } catch (error) {
        console.error('Transcription status check error:', error)
        throw error
    }
}

module.exports = {
    startTranscriptionJob,
    getTranscriptionJobStatus
}
