const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { LECTURE_STATUS } = require('../../utils/constants')

const getAnalysis = async (event) => {
    try {
        const { lectureId } = event.pathParameters
        const userId = event.requestContext.authorizer.userId

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

        // 분석 결과가 아직 없는 경우
        if (!processingInfo.Item?.analysisResult) {
            let status
            
            // 현재 처리 상태에 따른 상태 반환
            switch (processingInfo.Item?.processingState) {
                case LECTURE_STATUS.ANALYZING:
                    status = LECTURE_STATUS.ANALYZING
                    break
                case LECTURE_STATUS.ANALYZE_FAILED:
                    status = LECTURE_STATUS.ANALYZE_FAILED
                    break
                case LECTURE_STATUS.TRANSCRIBING:
                case LECTURE_STATUS.TRANSCRIBE_COMPLETED:
                    status = LECTURE_STATUS.PROCESSING
                    break
                default:
                    status = processingInfo.Item?.processingState || LECTURE_STATUS.PROCESSING
            }

            return formatResponse(200, {
                lectureId,
                status,
                message: 'Analysis is not completed yet',
                lastUpdated: processingInfo.Item?.updatedAt
            })
        }

        // 분석 결과가 있는 경우
        return formatResponse(200, {
            lectureId,
            status: LECTURE_STATUS.ANALYZE_COMPLETED,
            ...processingInfo.Item.analysisResult,
            updatedAt: processingInfo.Item.updatedAt
        })
    } catch (error) {
        console.error('Get analysis error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getAnalysis)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
