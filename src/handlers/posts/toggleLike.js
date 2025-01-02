const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const toggleLike = async (event) => {
    try {
        const { postId } = event.pathParameters
        const userId = event.requestContext.authorizer.userId
        const timestamp = new Date().toISOString()
        const likeId = `${userId}#${postId}`

        // 게시글 존재 확인
        const post = await dynamodb.get({
            TableName: 'posts',
            Key: { postId }
        })

        if (!post.Item) {
            return formatError(404, 'Post not found')
        }

        // 좋아요 상태 확인
        const like = await dynamodb.get({
            TableName: 'likes',
            Key: { likeId }
        })

        if (!like.Item) {
            // 좋아요 추가
            await Promise.all([
                // likes 테이블에 추가
                dynamodb.put({
                    TableName: 'likes',
                    Item: {
                        likeId,
                        userId,
                        postId,
                        createdAt: timestamp
                    }
                }),
                // posts 테이블 좋아요 수 증가
                dynamodb.update({
                    TableName: 'posts',
                    Key: { postId },
                    UpdateExpression: 'SET likeCount = if_not_exists(likeCount, :zero) + :inc, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':zero': 0,
                        ':inc': 1,
                        ':updatedAt': timestamp
                    }
                })
            ])

            return formatResponse(200, { 
                message: 'Like added successfully',
                liked: true
            })
        } else {
            // 좋아요 제거
            await Promise.all([
                // likes 테이블에서 제거
                dynamodb.delete({
                    TableName: 'likes',
                    Key: { likeId }
                }),
                // posts 테이블 좋아요 수 감소
                dynamodb.update({
                    TableName: 'posts',
                    Key: { postId },
                    UpdateExpression: 'SET likeCount = likeCount - :dec, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':dec': 1,
                        ':updatedAt': timestamp
                    }
                })
            ])

            return formatResponse(200, { 
                message: 'Like removed successfully',
                liked: false
            })
        }
    } catch (error) {
        console.error('Toggle like error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(toggleLike)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
