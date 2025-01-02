const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { LECTURE_STATUS } = require('../../utils/constants')

const sfnClient = new SFNClient({})

const startWorkflow = async (event) => {
    try {
        const { lectureId } = event.pathParameters
        const userId = event.requestContext.authorizer.userId
        const timestamp = new Date().toISOString()

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

        const command = new StartExecutionCommand({
            stateMachineArn: process.env.STATE_MACHINE_ARN,
            input: JSON.stringify({
                lectureId,
                userId,
                status: LECTURE_STATUS.PROCESSING
            }),
            name: `lecture-${lectureId}-${Date.now()}`
        })

        const execution = await sfnClient.send(command)

        await Promise.all([
            dynamodb.update({
                TableName: 'lectures',
                Key: { lectureId },
                UpdateExpression: 'SET lectureState = :state, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':state': LECTURE_STATUS.PROCESSING,
                    ':updatedAt': timestamp
                }
            }),
            dynamodb.update({
                TableName: 'lecture-processing',
                Key: { lectureId },
                UpdateExpression: 'SET processingState = :state, executionArn = :executionArn, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':state': LECTURE_STATUS.PROCESSING,
                    ':executionArn': execution.executionArn,
                    ':updatedAt': timestamp
                }
            })
        ])

        return formatResponse(200, {
            message: 'Processing started',
            status: LECTURE_STATUS.PROCESSING,
            executionArn: execution.executionArn
        })
    } catch (error) {
        console.error('Workflow start error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(startWorkflow)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
