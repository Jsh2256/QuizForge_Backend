const jwt = require('jsonwebtoken');
const { dynamodb } = require('../services/aws');

const generatePolicy = (principalId, effect, resource) => ({
 principalId,
 policyDocument: {
   Version: '2012-10-17',
   Statement: [
     {
       Action: 'execute-api:Invoke',
       Effect: effect,
       Resource: `arn:aws:execute-api:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:*/*/*`
     },
   ],
 },
 context: {
   userId: principalId,
 },
});

const authorizer = async (event) => {
   try {
       console.log('Auth event:', JSON.stringify(event, null, 2));

       // Token 추출 (대소문자 구분 없이)
       const authHeader = Object.keys(event.headers)
         .find(key => key.toLowerCase() === 'authorization');
       const token = event.headers[authHeader]?.replace('Bearer ', '');

       if (!token) {
           console.error('Authorization token is missing');
           throw new Error('No authorization token');
       }

       // Token 검증
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       console.log('Decoded token:', decoded);

       // 사용자 존재 여부 확인
       const user = await dynamodb.get({
           TableName: 'users',
           Key: { userId: decoded.userId },
       });

       if (!user.Item) {
           console.error('User not found in database');
           throw new Error('User not found');
       }

       // 사용자 상태 확인
       if (user.Item.userState !== 'active') {
           console.error('User account is not active');
           throw new Error('User account is not active');
       }

       // 성공 시 Allow 정책 반환
       const policy = generatePolicy(decoded.userId, 'Allow', event.methodArn);
       console.log('Generated policy:', policy);
       return policy;

   } catch (error) {
       console.error('Authorization error:', error);
       throw new Error('Unauthorized');
   }
};

module.exports.handler = authorizer;
