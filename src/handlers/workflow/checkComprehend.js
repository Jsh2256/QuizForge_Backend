const { dynamodb } = require('../../services/aws')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
    try {
        const { lectureId } = event
        const result = await dynamodb.get({
            TableName: 'lecture-processing',
            Key: { lectureId }
        })

        const status = result.Item?.analysisResult ? 
            LECTURE_STATUS.ANALYZE_COMPLETED : 
            LECTURE_STATUS.ANALYZING

        return {
            ...event,
            status
        }
    } catch (error) {
        console.error('Check comprehend error:', error)
        throw error
    }
}
