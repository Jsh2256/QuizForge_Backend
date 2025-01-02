const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { LECTURE_STATUS } = require('../../utils/constants')

const getTranscriptionResult = async (event) => {
    try {
        const { lectureId } = event.pathParameters
        const userId = event.requestContext.authorizer.userId
        const timestamp = new Date().toISOString()

        // 강의 존재 및 권한 확인
        const lecture = await dynamodb.get({
            TableName: 'lectures',
            Key: { lectureId }
        })

        if (!lecture.Item) {
            return formatError(404, 'Lecture not found')
        }

        if (lecture.Item.userId !== userId) {
            return formatError(403, 'Not authorized')
        }

        // 처리 상태 정보 조회
        const processingInfo = await dynamodb.get({
            TableName: 'lecture-processing',
            Key: { lectureId }
        })

        if (!processingInfo.Item?.transcriptContent) {
            return formatError(400, 'Transcription result not found')
        }

        // 상태 체크 로직 수정
        const currentState = processingInfo.Item.processingState
        if (currentState === LECTURE_STATUS.TRANSCRIBING || 
            currentState === LECTURE_STATUS.TRANSCRIBE_FAILED) {
            return formatResponse(200, {
                status: currentState,
                message: 'Transcription is not completed yet',
                updatedAt: processingInfo.Item.updatedAt
            })
        }

        // 결과 반환 (transcribe가 완료되었거나 이후 단계인 경우)
        return formatResponse(200, {
            status: currentState,
            lectureId,
            transcript: processingInfo.Item.transcriptContent,
            jobName: processingInfo.Item.transcriptionJobName,
            updatedAt: processingInfo.Item.updatedAt
        })
    } catch (error) {
        console.error('Error getting transcription result:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getTranscriptionResult)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
