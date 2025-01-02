const middy = require('@middy/core')
const jsonBodyParser = require('@middy/http-json-body-parser')
const cors = require('@middy/http-cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const login = async (event) => {
  console.log('Current AWS Region:', process.env.AWS_REGION);
  try {
    const { email, password } = event.body
    
    const result = await dynamodb.query({
      TableName: 'users',  // prefix 제거
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    })

    // 사용자가 없는 경우
    if (result.Items.length === 0) {
      return formatError(401, 'Invalid credentials')
    }

    const user = result.Items[0]
    
    // 비밀번호 확인
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return formatError(401, 'Invalid credentials')
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // 로그인 시간 업데이트
    await dynamodb.update({
      TableName: 'users',
      Key: { userId: user.userId },
      UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
      ExpressionAttributeValues: {
        ':lastLoginAt': new Date().toISOString()
      }
    })

    return formatResponse(200, {
      userId: user.userId,
      username: user.username,
      email: user.email,
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    return formatError(500, error.message)
  }
}

module.exports.handler = middy(login)
  .use(jsonBodyParser())
  .use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }))
