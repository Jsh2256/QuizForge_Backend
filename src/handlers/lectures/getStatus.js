const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { SFNClient, DescribeExecutionCommand } = require('@aws-sdk/client-sfn')
const { formatResponse, formatError } = require('../../utils/response')
const { S3Client } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { GetObjectCommand } = require('@aws-sdk/client-s3')
const { LECTURE_STATUS } = require('../../utils/constants')

const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' })

const getLectureStatus = async (event) => {
    console.log('Current AWS Region:', process.env.AWS_REGION);
    console.log('State Machine ARN:', process.env.STATE_MACHINE_ARN);
    try {
        const { lectureId } = event.pathParameters
        const userId = event.requestContext.authorizer.userId

        // 강의 기본 정보 조회
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

        let response = { 
            ...lecture.Item,
            processing: processingInfo.Item || {}
        }

        // 오디오 파일이 있으면 URL 생성
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `lectures/${lectureId}/audio.mp3`
        })

        try {
            console.log('Attempting to access S3 bucket:', process.env.AWS_S3_BUCKET);
            console.log('File path:', `lectures/${lectureId}/audio.mp3`);
            
            const s3Client = new S3Client({ region: process.env.AWS_REGION })
            const signedUrl = await getSignedUrl(s3Client, command, { 
                expiresIn: 604800
            })
            console.log('Successfully generated signed URL:', signedUrl);
            response.signedUrl = signedUrl;
        } catch (err) {
            console.error('Error generating signed URL:', err);
        }

        // 최종 응답 로깅
        console.log('Final response:', response);

        // Step Functions 실행 상태 조회
        if (processingInfo.Item?.executionArn) {
            const executionArn = processingInfo.Item.executionArn
            const region = executionArn ? executionArn.split(':')[3] : process.env.AWS_REGION

            // 해당 리전의 Step Functions 클라이언트 생성
            const sfnClient = new SFNClient({ region })

            const command = new DescribeExecutionCommand({
                executionArn: processingInfo.Item.executionArn
            })
            const execution = await sfnClient.send(command)
            
            response.workflowStatus = {
                status: execution.status,
                startDate: execution.startDate,
                stopDate: execution.stopDate
            }
        }

        return formatResponse(200, response)
    } catch (error) {
        console.error('Status check error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getLectureStatus)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
