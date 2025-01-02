const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { LECTURE_STATUS } = require('../../utils/constants')
const { getSignedUrl } = require('../../services/lectureService')

const getUserLectures = async (event) => {
    try {
        const userId = event.requestContext.authorizer.userId

        // 강의 목록 조회
        const result = await dynamodb.query({
            TableName: 'lectures',
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        })

        // 각 강의 상세 정보 조회
        const lecturesWithDetails = await Promise.all(result.Items.map(async (lecture) => {
            const enrichedLecture = { ...lecture }

            // 처리 상태 정보 조회
            const processingInfo = await dynamodb.get({
                TableName: 'lecture-processing',
                Key: { lectureId: lecture.lectureId }
            })

            // 완료된 강의의 경우 오디오 URL 생성
            if (lecture.lectureState === LECTURE_STATUS.COMPLETED && lecture.audioUrl) {
                enrichedLecture.signedUrl = await getSignedUrl(
                    process.env.AWS_S3_BUCKET,
                    `lectures/${lecture.lectureId}/audio.mp3`
                )
            }

            // 문제 수 조회
            const questionsCount = await dynamodb.query({
                TableName: 'questions',
                IndexName: 'LectureIdIndex',
                KeyConditionExpression: 'lectureId = :lectureId',
                Select: 'COUNT',
                ExpressionAttributeValues: {
                    ':lectureId': lecture.lectureId
                }
            })

            return {
                ...enrichedLecture,
                processing: processingInfo.Item || {},
                questionsCount: questionsCount.Count
            }
        }))

        return formatResponse(200, lecturesWithDetails)
    } catch (error) {
        console.error('Get user lectures error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getUserLectures)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
