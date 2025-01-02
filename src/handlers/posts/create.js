const middy = require('@middy/core')
const jsonBodyParser = require('@middy/http-json-body-parser')
const cors = require('@middy/http-cors')
const { v4: uuidv4 } = require('uuid')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { POST_STATUS, QUESTION_STATUS } = require('../../utils/constants')

const createPost = async (event) => {
    try {
        const { title, content, questions, lectureId } = event.body
        const userId = event.requestContext.authorizer.userId
        const postId = uuidv4()
        const timestamp = new Date().toISOString()

        // 기본 게시글 정보
        const post = {
            postId,
            userId,
            username: event.requestContext.authorizer.username,
            title,
            content,
            questions,
            lectureId,
            publishState: POST_STATUS.ACTIVE,
            createdAt: timestamp,
            updatedAt: timestamp,
            viewCount: 0,
            likeCount: 0,
            commentCount: 0
        }

        // posts 테이블에 게시글 저장
        await dynamodb.put({
            TableName: 'posts',
            Item: post
        })

        // questions가 있다면 각 question의 공개 상태 업데이트
        if (questions && questions.length > 0) {
            const questionUpdates = questions.map(questionId => 
                dynamodb.update({
                    TableName: 'questions',
                    Key: { questionId },
                    UpdateExpression: 'SET publishState = :state, postId = :postId, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':state': QUESTION_STATUS.PUBLISHED,
                        ':postId': postId,
                        ':updatedAt': timestamp
                    }
                })
            )

            await Promise.all(questionUpdates)
        }

        return formatResponse(201, post)
    } catch (error) {
        console.error('Create post error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(createPost)
    .use(jsonBodyParser())
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
