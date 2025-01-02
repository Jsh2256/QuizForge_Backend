const middy = require('@middy/core')
const jsonBodyParser = require('@middy/http-json-body-parser')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const updatePost = async (event) => {
    try {
        const { postId } = event.pathParameters
        const { title, content, questions } = event.body
        const userId = event.requestContext.authorizer.userId
        const timestamp = new Date().toISOString()

        // 게시글 존재 및 권한 확인
        const post = await dynamodb.get({
            TableName: 'posts',
            Key: { postId }
        })

        if (!post.Item) {
            return formatError(404, 'Post not found')
        }

        if (post.Item.userId !== userId) {
            return formatError(403, 'Not authorized')
        }

        // 게시글 업데이트
        await dynamodb.update({
            TableName: 'posts',
            Key: { postId },
            UpdateExpression: 'SET title = :title, content = :content, questions = :questions, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':title': title,
                ':content': content,
                ':questions': questions || post.Item.questions,
                ':updatedAt': timestamp
            }
        })

        // 문제 정보 업데이트 (문제가 변경된 경우)
        if (questions && questions.length > 0) {
            await Promise.all(questions.map(questionId =>
                dynamodb.update({
                    TableName: 'questions',
                    Key: { questionId },
                    UpdateExpression: 'SET updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':updatedAt': timestamp
                    }
                })
            ))
        }

        return formatResponse(200, { 
            message: 'Post updated successfully',
            postId
        })
    } catch (error) {
        console.error('Update post error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(updatePost)
    .use(jsonBodyParser())
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
