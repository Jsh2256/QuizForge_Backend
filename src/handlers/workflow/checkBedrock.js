const { dynamodb } = require('../../services/aws')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
    try {
        const { lectureId } = event
        const timestamp = new Date().toISOString()

        // 처리 상태 조회
        const result = await dynamodb.get({
            TableName: 'lecture-processing',
            Key: { lectureId }
        })

        // 상태 결정
        let status
        if (!result.Item) {
            status = LECTURE_STATUS.GENERATING_QUESTIONS
        } else if (result.Item.questions) {
            status = LECTURE_STATUS.QUESTIONS_COMPLETED
        } else {
            status = LECTURE_STATUS.GENERATING_QUESTIONS
        }

        return {
            ...event,
            status,
            updatedAt: timestamp
        }
    } catch (error) {
        console.error('Check bedrock error:', error)
        // 에러 발생 시 실패 상태 반환
        return {
            ...event,
            status: LECTURE_STATUS.QUESTIONS_FAILED,
            error: error.message,
            updatedAt: new Date().toISOString()
        }
    }
}
