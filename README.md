# Quiz Forge Backend

강의 음성을 분석하여 자동으로 학습 자료를 생성하는 서버리스 백엔드 애플리케이션입니다.

## 🌏 멀티리전 아키텍처

이 애플리케이션은 글로벌 서비스를 위해 다중 리전 배포를 지원합니다:

### 현재 지원 리전
- **Primary Region**: us-east-1 (북버지니아)
- **Secondary Region**: ap-northeast-2 (서울)

### 추가 리전 확장 가능
필요에 따라 다음 리전들로 확장할 수 있습니다:
- eu-west-1 (아일랜드) - 유럽 사용자
- ap-southeast-1 (싱가포르) - 동남아시아 사용자
- ap-northeast-1 (도쿄) - 일본 사용자

각 리전은 독립적으로 운영되며, 다음 구성요소를 포함합니다:
- API Gateway + Lambda
- DynamoDB Global Tables
- S3 Cross-Region Replication
- CloudFront Distribution

## 🚀 배포 방법

### 사전 준비

1. AWS CLI 설정
```bash
aws configure
```

2. 필요한 패키지 설치
```bash
npm install
```

### 리전별 배포

기본 리전 배포:
```bash
# 북버지니아(us-east-1) 리전 배포
sls deploy --region us-east-1 --stage prod

# 서울(ap-northeast-2) 리전 배포
sls deploy --region ap-northeast-2 --stage prod
```

새로운 리전 추가 배포:
```bash
# 유럽(아일랜드) 리전 추가
sls deploy --region eu-west-1 --stage prod

# 싱가포르 리전 추가
sls deploy --region ap-southeast-1 --stage prod

# 도쿄 리전 추가
sls deploy --region ap-northeast-1 --stage prod
```

### 도메인 설정﻿

각 리전별 Custom Domain 설정:
```bash
# 기존 리전
sls create_domain --region us-east-1 --stage prod
sls create_domain --region ap-northeast-2 --stage prod

# 새 리전 추가 시
sls create_domain --region [새로운-리전] --stage prod
```

## 🛠 인프라 구성
![quiz-forge](https://github.com/user-attachments/assets/c156bbc9-abe3-45d8-86a7-8cc4b6f2aafc)

### DynamoDB 글로벌 테이블

- users
- lectures
- lecture-processing
- questions
- posts
- comments
- likes

### S3 버킷 구성

기본 버킷:
- 북버지니아: `study-app-us-east-1-{stage}`
- 서울: `study-app-ap-northeast-2-{stage}`

새 리전 추가 시:
- `study-app-{region}-{stage}` 형식으로 자동 생성

### API 엔드포인트

Route 53 지연 시간 기반 라우팅을 사용하여 단일 도메인으로 모든 리전을 서비스할 수 있습니다:
```
api.yourdomain.com
```

이 설정을 통해:
- 사용자는 단일 API 엔드포인트만 기억하면 됩니다
- Route 53이 자동으로 사용자와 가장 가까운 리전으로 요청을 라우팅합니다
- 각 리전의 API Gateway는 동일한 도메인으로 서비스됩니다
- 리전이 추가되어도 사용자의 엔드포인트는 변경되지 않습니다

#### 라우팅 설정
```bash
# Route 53 레코드 생성 (각 리전별로 설정)
aws route53 change-resource-record-sets \
  --hosted-zone-id ${HOSTED_ZONE_ID} \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.yourdomain.com",
        "Type": "A",
        "SetIdentifier": "region-name",
        "Region": "region-name",
        "AliasTarget": {
          "HostedZoneId": "API_GATEWAY_ZONE_ID",
          "DNSName": "API_GATEWAY_DOMAIN",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

## 📦 주요 기능

- 강의 음성 파일 업로드 및 관리
- 음성-텍스트 변환 (AWS Transcribe)
- 텍스트 분석 및 키워드 추출 (AWS Comprehend)
- AI 기반 문제 자동 생성 (AWS Bedrock)
- 게시판 및 커뮤니티 기능
- JWT 기반 사용자 인증

## 🔧 로컬 개발

로컬 환경에서 실행:
```bash
sls offline
```

## 📁 프로젝트 구조

```
study-app-backend/
├── src/
│   ├── handlers/         # Lambda 핸들러
│   ├── middleware/       # 미들웨어
│   ├── services/        # 공통 서비스
│   └── utils/           # 유틸리티
├── statemachine/        # Step Functions 정의
└── serverless.yml       # 서버리스 설정
```

## ⚙️ 환경 변수 (SSM Parameter Store)

### 공통 파라미터
- `/study-app/{stage}/JWT_SECRET`
- `/study-app/{stage}/CORS_ORIGIN`

### 리전별 파라미터
- `/study-app/{stage}/S3_BUCKET_US`
- `/study-app/{stage}/S3_BUCKET_AP`
- `/study-app/{stage}/CERTIFICATE_ARN_US`
- `/study-app/{stage}/CERTIFICATE_ARN_AP`
- `/study-app/{stage}/API_DOMAIN`
- `/study-app/{stage}/HOSTED_ZONE_ID`

## 🔍 모니터링

각 리전별 모니터링:
- CloudWatch Logs
- CloudWatch Metrics
- X-Ray Tracing

## 🚨 장애 복구

리전 장애 시 장애 조치 절차:
1. Route 53 장애 조치 라우팅 정책 활성화
2. 정상 리전으로 트래픽 전환
3. DynamoDB 글로벌 테이블 자동 복제 확인
4. S3 크로스 리전 복제 상태 확인

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
```

이 README는 멀티리전 배포와 관련된 상세한 정보를 포함하고 있습니다. 특히:
- 리전별 배포 방법
- 글로벌 테이블 구성
- 리전별 S3 버킷 설정
- 커스텀 도메인 설정
- 장애 복구 절차
등을 자세히 설명하고 있습니다.
