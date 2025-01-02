const { dynamodb } = require('../../services/aws')
const { analyzeText } = require('../../services/comprehendService')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
    try {
        const { lectureId } = event
        const timestamp = new Date().toISOString()

        const result = await dynamodb.get({
            TableName: 'lecture-processing',
            Key: { lectureId }
        })

        const transcriptText = result.Item.transcriptContent

        const analysisResult = {
            ...(await analyzeText(transcriptText)),
            analysisDate: timestamp
        }

        await dynamodb.update({
            TableName: 'lecture-processing',
            Key: { lectureId },
            UpdateExpression: `
                SET analysisResult = :analysis,
                    processingState = :state,
                    updatedAt = :updatedAt
            `,
            ExpressionAttributeValues: {
                ':analysis': analysisResult,
                ':state': LECTURE_STATUS.ANALYZE_COMPLETED,
                ':updatedAt': timestamp
            }
        })

        return {
            ...event,
            status: LECTURE_STATUS.ANALYZE_COMPLETED,
            analysisDetails: analysisResult
        }
    } catch (error) {
        console.error('Comprehend analysis error:', error)
        throw error
    }
}
