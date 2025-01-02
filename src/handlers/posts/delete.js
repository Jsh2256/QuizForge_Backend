const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { POST_STATUS } = require('../../utils/constants')

const deletePost = async (event) => {
   try {
       const { postId } = event.pathParameters
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

       // 소프트 삭제 처리
       await Promise.all([
           // 게시글 상태 업데이트
           dynamodb.update({
               TableName: 'posts',
               Key: { postId },
               UpdateExpression: 'SET publishState = :state, updatedAt = :updatedAt',
               ExpressionAttributeValues: {
                   ':state': POST_STATUS.DELETED,
                   ':updatedAt': timestamp
               }
           }),

           // 연관된 질문들 상태 업데이트 (있는 경우)
           post.Item.questions && post.Item.questions.length > 0 ?
           Promise.all(post.Item.questions.map(questionId =>
               dynamodb.update({
                   TableName: 'questions',
                   Key: { questionId },
                   UpdateExpression: 'SET publishState = :state, updatedAt = :updatedAt',
                   ExpressionAttributeValues: {
                       ':state': 'private',
                       ':updatedAt': timestamp
                   }
               })
           )) : Promise.resolve(),

           // 댓글들 상태 업데이트
           dynamodb.query({
               TableName: 'comments',
               IndexName: 'PostIdIndex',
               KeyConditionExpression: 'postId = :postId',
               ExpressionAttributeValues: {
                   ':postId': postId
               }
           }).then(result => 
               Promise.all(result.Items.map(comment =>
                   dynamodb.update({
                       TableName: 'comments',
                       Key: { commentId: comment.commentId },
                       UpdateExpression: 'SET commentState = :state, updatedAt = :updatedAt',
                       ExpressionAttributeValues: {
                           ':state': 'deleted',
                           ':updatedAt': timestamp
                       }
                   })
               ))
           ),

           // 좋아요 레코드들 삭제
           dynamodb.query({
               TableName: 'likes',
               IndexName: 'PostIdIndex',
               KeyConditionExpression: 'postId = :postId',
               ExpressionAttributeValues: {
                   ':postId': postId
               }
           }).then(result => 
               Promise.all(result.Items.map(like =>
                   dynamodb.delete({
                       TableName: 'likes',
                       Key: { likeId: like.likeId }
                   })
               ))
           )
       ])

       return formatResponse(200, { 
           message: 'Post and related data deleted successfully',
           postId
       })
   } catch (error) {
       console.error('Delete post error:', error)
       return formatError(500, error.message)
   }
}

module.exports.handler = middy(deletePost)
   .use(cors({
    origin: process.env.CORS_ORIGIN,
       credentials: true
   }))
