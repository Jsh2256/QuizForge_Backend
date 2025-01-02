const { 
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3')
const { 
    DynamoDBClient 
} = require('@aws-sdk/client-dynamodb')
const { 
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb')
const {
    TranscribeClient,
    StartTranscriptionJobCommand,
    GetTranscriptionJobCommand
} = require('@aws-sdk/client-transcribe')
const {
    ComprehendClient,
    DetectKeyPhrasesCommand,
    DetectEntitiesCommand,
    DetectSentimentCommand
} = require('@aws-sdk/client-comprehend')
const {
    BedrockRuntimeClient,
    InvokeModelCommand
} = require('@aws-sdk/client-bedrock-runtime')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

// AWS Clients
const createClients = (region = process.env.AWS_REGION) => {
    const s3Client = new S3Client({ region });  // 각 리전의 클라이언트 사용
    const dynamoClient = new DynamoDBClient({ region });
    const docClient = DynamoDBDocumentClient.from(dynamoClient)
    const transcribeClient = new TranscribeClient({ region });
    const comprehendClient = new ComprehendClient({ region })
    const bedrockClient = new BedrockRuntimeClient({ region })

    return {
        s3Client,
        dynamoClient,
        docClient,
        transcribeClient,
        comprehendClient,
        bedrockClient
    }
}

const clients = createClients()

// AWS Service Operations
const s3 = {
    getObject: (params) => clients.s3Client.send(new GetObjectCommand({
        ...params,
        Bucket: process.env.AWS_S3_BUCKET
    })),
    putObject: (params) => clients.s3Client.send(new PutObjectCommand({
        ...params,
        Bucket: process.env.AWS_S3_BUCKET
    })),
    headObject: (params) => clients.s3Client.send(new HeadObjectCommand({
        ...params,
        Bucket: process.env.AWS_S3_BUCKET
    })),
    deleteObject: (params) => clients.s3Client.send(new DeleteObjectCommand({
        ...params,
        Bucket: process.env.AWS_S3_BUCKET
    })),
    getSignedGetUrl: (params, expiresIn = 3600) => getSignedUrl(
        clients.s3Client,
        new GetObjectCommand({
            ...params,
            Bucket: process.env.AWS_S3_BUCKET
        }),
        { expiresIn }
    ),
    getSignedPutUrl: (params, expiresIn = 3600) => getSignedUrl(
        clients.s3Client,
        new PutObjectCommand({
            ...params,
            Bucket: process.env.AWS_S3_BUCKET
        }),
        { expiresIn }
    )
}

const dynamodb = {
    put: (params) => clients.docClient.send(new PutCommand(params)),
    get: (params) => clients.docClient.send(new GetCommand(params)),
    update: (params) => clients.docClient.send(new UpdateCommand(params)),
    delete: (params) => clients.docClient.send(new DeleteCommand(params)),
    query: (params) => clients.docClient.send(new QueryCommand(params)),
    scan: (params) => clients.docClient.send(new ScanCommand(params))
}

const transcribe = {
    startTranscriptionJob: (params) => clients.transcribeClient.send(new StartTranscriptionJobCommand(params)),
    getTranscriptionJob: (params) => clients.transcribeClient.send(new GetTranscriptionJobCommand(params))
}

const comprehend = {
    detectKeyPhrases: (params) => clients.comprehendClient.send(new DetectKeyPhrasesCommand(params)),
    detectEntities: (params) => clients.comprehendClient.send(new DetectEntitiesCommand(params)),
    detectSentiment: (params) => clients.comprehendClient.send(new DetectSentimentCommand(params))
}

const bedrock = {
    invokeModel: async (prompt) => {
        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.7,
                top_p: 0.9,
                top_k: 250,
                system: "당신은 교육 전문가입니다. 주어진 강의 내용과 분석을 바탕으로 학습자의 이해도를 평가할 수 있는 최적의 문제를 만들어주세요."
            })
        });
        const response = await clients.bedrockClient.send(command);
        const responseData = JSON.parse(new TextDecoder().decode(response.body));
        return responseData.content[0].text;
    }
}

module.exports = {
    s3,
    dynamodb,
    transcribe,
    comprehend,
    bedrock
}
