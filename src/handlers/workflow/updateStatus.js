const middy = require('@middy/core')
const { dynamodb } = require('../../services/aws')
const { LECTURE_STATUS } = require('../../utils/constants')

const getLectureState = (status) => {
    switch (status) {
        case LECTURE_STATUS.TRANSCRIBE_FAILED:
        case LECTURE_STATUS.ANALYZE_FAILED:
        case LECTURE_STATUS.QUESTIONS_FAILED:
            return LECTURE_STATUS.FAILED
        case LECTURE_STATUS.QUESTIONS_COMPLETED:
            return LECTURE_STATUS.COMPLETED
        default:
            return LECTURE_STATUS.PROCESSING
    }
}

const updateStatus = async (event) => {
    try {
        const { lectureId, status, error } = event  // processingState -> status
        const timestamp = new Date().toISOString()
        
        // status가 없는 경우 에러 처리
        if (!status) {
            throw new Error('Status is required')
        }

        const lectureState = getLectureState(status)

        await Promise.all([
            // lectures 테이블 업데이트
            dynamodb.update({
                TableName: 'lectures',
                Key: { lectureId },
                UpdateExpression: 'SET lectureState = :lectureState, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':lectureState': lectureState,
                    ':updatedAt': timestamp
                }
            }),
            // lecture-processing 테이블 업데이트
            dynamodb.update({
                TableName: 'lecture-processing',
                Key: { lectureId },
                UpdateExpression: error
                    ? 'SET processingState = :processingState, errorMessage = :error, updatedAt = :updatedAt'
                    : 'SET processingState = :processingState, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':processingState': status,
                    ':updatedAt': timestamp,
                    ...(error && {
                        ':error': {
                            message: error,
                            timestamp
                        }
                    })
                }
            })
        ])

        return {
            ...event,
            lectureState,
            processingState: status,
            updatedAt: timestamp,
            ...(error && { errorMessage: error })
        }
    } catch (error) {
        console.error('Update status error:', error)
        throw error
    }
}
module.exports.handler = middy(updateStatus)

