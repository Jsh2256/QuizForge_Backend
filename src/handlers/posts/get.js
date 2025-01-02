const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const getPost = async (event) => {
   try {
       const { postId } = event.pathParameters
       const userId = event.requestContext.authorizer?.userId
       const timestamp = new Date().toISOString()

       // 게시글 조회
       const result = await dynamodb.get({
           TableName: 'posts',
           Key: { postId }
       })

       if (!result.Item) {
           return formatError(404, 'Post not found')
       }

       // 문제 정보 조회
       let questionDetails = [];
       if (result.Item.questions && result.Item.questions.length > 0) {
           console.log('Fetching questions:', result.Item.questions);
           const questionsPromises = result.Item.questions.map(questionId =>
               dynamodb.get({
                   TableName: 'questions',
                   Key: { questionId }
               })
           );
           const questionsResults = await Promise.all(questionsPromises);
           questionDetails = questionsResults
               .map(result => result.Item)
               .filter(item => item);
           console.log('Fetched questions:', questionDetails);
       }

       // 조회수 증가
       await dynamodb.update({
           TableName: 'posts',
           Key: { postId },
           UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :start) + :inc, updatedAt = :updatedAt',
           ExpressionAttributeValues: {
               ':inc': 1,
               ':start': 0,
               ':updatedAt': timestamp
           }
       })

       // 댓글 조회
       const commentsResult = await dynamodb.query({
           TableName: 'comments',
           IndexName: 'PostIdIndex',
           KeyConditionExpression: 'postId = :postId',
           ExpressionAttributeValues: {
               ':postId': postId
           }
       })

       // 좋아요 여부 확인
       let isLiked = false
       if (userId) {
           const likeResult = await dynamodb.get({
               TableName: 'likes',
               Key: { likeId: `${userId}#${postId}` }
           })
           isLiked = !!likeResult.Item
       }

       // 게시글 정보 업데이트된 버전 조회
       const updatedResult = await dynamodb.get({
           TableName: 'posts',
           Key: { postId }
       })

       // 응답 데이터 구성
       const response = {
           ...updatedResult.Item,
           questions: questionDetails, // 문제 상세 정보로 교체
           isLiked,
           commentCount: commentsResult.Count,
           comments: commentsResult.Items
       }

       console.log('Final response:', response);
       return formatResponse(200, response)
   } catch (error) {
       console.error('Get post error:', error)
       return formatError(500, error.message)
   }
}

module.exports.handler = middy(getPost)
   .use(cors({
    origin: process.env.CORS_ORIGIN,
       credentials: true
   }))
