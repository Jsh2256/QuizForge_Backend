const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { getLectureS3Objects, deleteS3Objects } = require('../../services/lectureService')

const deleteLecture = async (event) => {
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

        // S3 객체 삭제
        if (lecture.Item.audioUrl) {
            const s3Keys = getLectureS3Objects(lectureId)
            await deleteS3Objects(process.env.AWS_S3_BUCKET, s3Keys)
        }

        // 연관 데이터 삭제
        await Promise.all([
            // 강의 정보 삭제
            dynamodb.delete({
                TableName: 'lectures',
                Key: { lectureId }
            }),

            // 처리 정보 삭제
            dynamodb.delete({
                TableName: 'lecture-processing',
                Key: { lectureId }
            }),

            // 문제 삭제
            dynamodb.query({
                TableName: 'questions',
                IndexName: 'LectureIdIndex',
                KeyConditionExpression: 'lectureId = :lectureId',
                ExpressionAttributeValues: { ':lectureId': lectureId }
            }).then(result => 
                Promise.all(result.Items.map(question =>
                    dynamodb.delete({
                        TableName: 'questions',
                        Key: { questionId: question.questionId }
                    })
                ))
            ),

            // 게시글 및 연관 데이터 삭제
            dynamodb.query({
                TableName: 'posts',
                IndexName: 'LectureIdIndex',
                KeyConditionExpression: 'lectureId = :lectureId',
                ExpressionAttributeValues: { ':lectureId': lectureId }
            }).then(result => 
                Promise.all(result.Items.map(async post => {
                    const [comments, likes] = await Promise.all([
                        // 댓글 조회
                        dynamodb.query({
                            TableName: 'comments',
                            IndexName: 'PostIdIndex',
                            KeyConditionExpression: 'postId = :postId',
                            ExpressionAttributeValues: { ':postId': post.postId }
                        }),
                        // 좋아요 조회
                        dynamodb.query({
                            TableName: 'likes',
                            IndexName: 'PostIdIndex',
                            KeyConditionExpression: 'postId = :postId',
                            ExpressionAttributeValues: { ':postId': post.postId }
                        })
                    ])

                    // 댓글, 좋아요, 게시글 삭제
                    return Promise.all([
                        ...comments.Items.map(comment =>
                            dynamodb.delete({
                                TableName: 'comments',
                                Key: { commentId: comment.commentId }
                            })
                        ),
                        ...likes.Items.map(like =>
                            dynamodb.delete({
                                TableName: 'likes',
                                Key: { likeId: like.likeId }
                            })
                        ),
                        dynamodb.delete({
                            TableName: 'posts',
                            Key: { postId: post.postId }
                        })
                    ])
                }))
            )
        ])

        return formatResponse(200, {
            message: 'Lecture and all related data deleted successfully',
            lectureId
        })
    } catch (error) {
        console.error('Delete lecture error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(deleteLecture)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
