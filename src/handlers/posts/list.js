const middy = require('@middy/core')
const cors = require('@middy/http-cors')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')
const { POST_STATUS } = require('../../utils/constants')

const getPosts = async (event) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = event.queryStringParameters || {}
        const pageSize = parseInt(limit)
        const offset = (parseInt(page) - 1) * pageSize

        // 활성 상태 게시글 수 조회
        const countResult = await dynamodb.scan({
            TableName: 'posts',
            FilterExpression: 'publishState = :state',
            ExpressionAttributeValues: {
                ':state': POST_STATUS.ACTIVE
            },
            Select: 'COUNT'
        })

        const totalPosts = countResult.Count

        // 게시글 목록 조회
        const result = await dynamodb.scan({
            TableName: 'posts',
            FilterExpression: 'publishState = :state',
            ExpressionAttributeValues: {
                ':state': POST_STATUS.ACTIVE
            }
        })

        // 정렬 및 페이징 처리
        const sortedPosts = result.Items.sort((a, b) => {
            if (order === 'desc') {
                return b[sortBy] > a[sortBy] ? 1 : -1
            }
            return a[sortBy] > b[sortBy] ? 1 : -1
        })

        const paginatedPosts = sortedPosts.slice(offset, offset + pageSize)

        return formatResponse(200, {
            posts: paginatedPosts,
            pagination: {
                total: totalPosts,
                page: parseInt(page),
                totalPages: Math.ceil(totalPosts / pageSize),
                limit: pageSize
            }
        })
    } catch (error) {
        console.error('Get posts error:', error)
        return formatError(500, error.message)
    }
}

module.exports.handler = middy(getPosts)
    .use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }))
