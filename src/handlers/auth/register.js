const middy = require('@middy/core')
const jsonBodyParser = require('@middy/http-json-body-parser')
const cors = require('@middy/http-cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { dynamodb } = require('../../services/aws')
const { formatResponse, formatError } = require('../../utils/response')

const register = async (event) => {
  try {
    const { username, email, password } = event.body
    const userId = uuidv4()
    const timestamp = new Date().toISOString()

    // 이메일 중복 체크
    const existingUser = await dynamodb.query({
      TableName: 'users',
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    })

    if (existingUser.Items.length > 0) {
      return formatError(400, 'Email already exists')
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10)

    // 사용자 생성
    await dynamodb.put({
      TableName: 'users',
      Item: {
        userId,
        username,
        email,
        password: hashedPassword,
        createdAt: timestamp,
        updatedAt: timestamp,
        userState: 'active',  // 기본 상태
        lastLoginAt: timestamp  // 최초 로그인 시간
      }
    })

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // 응답
    return formatResponse(201, {
      userId,
      username,
      email,
      token
    })
  } catch (error) {
    console.error('Register error:', error)
    return formatError(500, error.message)
  }
}

module.exports.handler = middy(register)
  .use(jsonBodyParser())
  .use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }))
