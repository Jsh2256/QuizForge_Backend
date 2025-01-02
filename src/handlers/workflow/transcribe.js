// src/handlers/workflow/transcribe.js
const { startTranscriptionJob } = require('../../services/transcribeService')
const { dynamodb } = require('../../services/aws')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
    try {
        const { lectureId, userId } = event
        const jobName = `lecture-${lectureId}-${Date.now()}`
        const timestamp = new Date().toISOString()

        await startTranscriptionJob({
            TranscriptionJobName: jobName,
            LanguageCode: 'ko-KR',
            MediaFormat: 'mp3',
            Media: {
                MediaFileUri: `s3://${process.env.AWS_S3_BUCKET}/lectures/${lectureId}/audio.mp3`
            },

            Settings: {
                ShowSpeakerLabels: true,
                MaxSpeakerLabels: 2
            }
        })

        await dynamodb.update({
            TableName: 'lecture-processing',
            Key: { lectureId },
            UpdateExpression: 'SET transcriptionJobName = :jobName, processingState = :state, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':jobName': jobName,
                ':state': LECTURE_STATUS.TRANSCRIBING,
                ':updatedAt': timestamp
            }
        })

        return {
            ...event,
            transcriptionJobName: jobName,
            status: LECTURE_STATUS.TRANSCRIBING  // Step Function에서 사용할 status 값
        }
    } catch (error) {
        console.error('Transcribe start error:', error)
        throw error
    }
}
