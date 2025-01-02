const { dynamodb } = require('../../services/aws')
const { generateQuestions } = require('../../services/bedrock')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
    try {
        const { lectureId, userId } = event
        const timestamp = new Date().toISOString()

        // lecture-processing에서 transcriptContent 가져오기
        const result = await dynamodb.get({
            TableName: 'lecture-processing',
            Key: { lectureId }
        })

        const transcriptText = result.Item.transcriptContent
        const analysisResult = result.Item.analysisResult

        // 문제 생성
        const questions = await generateQuestions(
            transcriptText,
            analysisResult
        )

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid questions generated')
        }

        // 각 문제를 DynamoDB에 저장하는 부분 수정
        const questionPromises = questions.map((question, index) => {
            const questionId = `${lectureId}-q${index + 1}`
            return dynamodb.put({
                TableName: 'questions',
                Item: {
                    questionId,
                    lectureId,
                    userId,
                    questionType: question.type,
                    difficulty: question.difficulty,
                    score: question.score,
                    content: question.content,
                    options: question.options,
                    answers: question.options || [],
                    correctAnswer: question.correctAnswer,
                    explanation: question.explanation,
                    intent: question.intent,
                    evaluationPoint: question.evaluationPoint,
                    expectedTime: question.expectedTime,
                    answerGuideline: question.answerGuideline,
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            })
        })

        // 모든 저장 작업 수행
        await Promise.all([
            // 문제 저장
            ...questionPromises,
            
            // 처리 상태 업데이트
            dynamodb.update({
                TableName: 'lecture-processing',
                Key: { lectureId },
                UpdateExpression: `
                    SET questions = :questions,
                        processingState = :state,
                        updatedAt = :updatedAt
                `,
                ExpressionAttributeValues: {
                    ':questions': questions,
                    ':state': LECTURE_STATUS.QUESTIONS_COMPLETED,
                    ':updatedAt': timestamp
                }
            })
        ])

        return {
            ...event,
            status: LECTURE_STATUS.QUESTIONS_COMPLETED,
            questions
        }
    } catch (error) {
        console.error('Bedrock error:', error)
        throw error
    }
}

