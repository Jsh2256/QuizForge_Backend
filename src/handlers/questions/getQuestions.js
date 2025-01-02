const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { LECTURE_STATUS } = require('../../utils/constants')

const getLectureQuestions = async (event) => {
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

        // 문제 목록 조회
        const questionsResult = await dynamodb.query({
            TableName: 'questions',
            IndexName: 'LectureIdIndex',
            KeyConditionExpression: 'lectureId = :lectureId',
            ExpressionAttributeValues: {
                ':lectureId': lectureId
            }
        })

        if (!questionsResult.Items || questionsResult.Items.length === 0) {
            if (processingInfo.Item?.processingState === LECTURE_STATUS.QUESTIONS_FAILED) {
                return formatError(400, 'Question generation failed')
            }
            if (processingInfo.Item?.processingState === LECTURE_STATUS.GENERATING_QUESTIONS) {
                return formatResponse(200, {
                    lectureId,
                    status: LECTURE_STATUS.GENERATING_QUESTIONS,
                    message: 'Questions are being generated'
                })
            }
            return formatError(400, 'Questions not generated yet')
        }

        // 문제 목록 가공 및 통계 계산
        const questions = questionsResult.Items
        const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0)
        const totalTime = questions.reduce((sum, q) => sum + (q.expectedTime || 0), 0)
        const questionsByType = {
            multiple_choice: questions.filter(q => q.questionType === 'multiple_choice').length,
            descriptive: questions.filter(q => q.questionType === 'descriptive').length
        }

        return formatResponse(200, {
            lectureId,
            status: LECTURE_STATUS.QUESTIONS_COMPLETED,
            questions: questions.map(q => ({
                ...q,
                // 클라이언트 측에서 필요한 모든 필드를 명시적으로 포함
                questionId: q.questionId,
                content: q.content,
                questionType: q.questionType,
                difficulty: q.difficulty,
                score: q.score,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                intent: q.intent,
                evaluationPoint: q.evaluationPoint,
                expectedTime: q.expectedTime,
                answerGuideline: q.answerGuideline
            })),
            statistics: {
                totalQuestions: questions.length,
                totalScore,
                totalTime,
                questionsByType
            },
            processingState: processingInfo.Item?.processingState,
            updatedAt: processingInfo.Item?.updatedAt
        })
    } catch (error) {
        console.error('Get questions error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getLectureQuestions)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
