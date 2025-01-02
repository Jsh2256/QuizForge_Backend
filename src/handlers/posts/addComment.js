const middy = require('@middy/core')
const jsonBodyParser = require('@middy/http-json-body-parser')
const cors = require('@middy/http-cors')
const { v4: uuidv4 } = require('uuid')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const addComment = async (event) => {
    try {
        const { postId } = event.pathParameters
        const { content } = event.body
        const userId = event.requestContext.authorizer.userId
        const timestamp = new Date().toISOString()
        
        // 게시글 존재 여부 확인
        const post = await dynamodb.get({
            TableName: 'posts',
            Key: { postId }
        })

        if (!post.Item) {
            return formatError(404, 'Post not found')
        }

        // 새 댓글 생성
        const commentId = uuidv4()
        const comment = {
            commentId,
            postId,
            userId,
            content,
            createdAt: timestamp,
            updatedAt: timestamp
        }

        // comments 테이블에 댓글 저장
        await dynamodb.put({
            TableName: 'comments',
            Item: comment
        })

        // posts 테이블의 댓글 수 업데이트
        await dynamodb.update({
            TableName: 'posts',
            Key: { postId },
            UpdateExpression: 'SET commentCount = if_not_exists(commentCount, :zero) + :inc, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':zero': 0,
                ':inc': 1,
                ':updatedAt': timestamp
            }
        })

        return formatResponse(201, {
            ...comment,
            username: event.requestContext.authorizer.username // 응답에 사용자 이름 포함
        })
    } catch (error) {
        console.error('Add comment error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(addComment)
    .use(jsonBodyParser())
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
