const middy = require('@middy/core');
const jsonBodyParser = require('@middy/http-json-body-parser');
const cors = require('@middy/http-cors');
const { v4: uuidv4 } = require('uuid');
const { s3, dynamodb } = require('../../services/aws');
const { formatResponse, formatError } = require('../../utils/response');
const { LECTURE_STATUS } = require('../../utils/constants');

const getPresignedUrl = async (bucketName, key) => {
    try {
        return await s3.getSignedPutUrl({
            Bucket: bucketName,
            Key: key,
            ContentType: 'audio/mpeg'
        }, 604800);
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        throw error;
    }
};

const uploadLecture = async (event) => {
    try {
        const { title, description } = event.body;
        const userId = event.requestContext.authorizer.userId;
        const lectureId = uuidv4();
        const timestamp = new Date().toISOString();
        
        const s3Key = `lectures/${lectureId}/audio.mp3`;
        const uploadUrl = await getPresignedUrl(
            process.env.AWS_S3_BUCKET,
            s3Key
        );

        // lectures 테이블에 기본 정보 저장
        const lectureRecord = {
            lectureId,
            userId,
            title: title || 'Untitled Lecture',
            description: description || '',
            audioUrl: uploadUrl,
            lectureState: LECTURE_STATUS.PROCESSING,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // lecture-processing 테이블에 처리 상태 정보 저장
        const processingRecord = {
            lectureId,
            processingState: LECTURE_STATUS.PROCESSING,
            processingAttempts: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            fileUploadExpiry: new Date(Date.now() + 3600 * 1000).toISOString()
        };

        // 두 테이블에 동시에 저장
        await Promise.all([
            dynamodb.put({
                TableName: 'lectures',
                Item: lectureRecord
            }),
            dynamodb.put({
                TableName: 'lecture-processing',
                Item: processingRecord
            })
        ]);

        return formatResponse(201, {
            message: 'Upload URL generated successfully',
            lectureId,
            uploadUrl,
            title: lectureRecord.title,
            description: lectureRecord.description,
            lectureState: LECTURE_STATUS.PROCESSING,
            expiresAt: processingRecord.fileUploadExpiry
        });
    } catch (error) {
        console.error('Upload initialization error:', error);
        return formatError(500, 'Failed to initialize upload: ' + error.message);
    }
};

module.exports.handler = middy(uploadLecture)
    .use(jsonBodyParser())
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }));
