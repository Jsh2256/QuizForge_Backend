const { bedrock } = require('./aws')
const generatePrompt = (transcript, analysis) => {
    return `
다음 강의 내용을 바탕으로 학습자의 이해도를 평가하기 위한 문제를 생성하세요.

[강의 내용]
${transcript}

[분석 결과]
주요 키워드: ${analysis.keyPhrases.join(', ')}
주요 개념: ${JSON.stringify(analysis.entities)}

요구사항:
1. 총 5개의 문제를 생성:
   - 객관식(multiple_choice) 3문제 (각 문제별로 4개의 보기 options)
   - 서술형(descriptive) 2문제
2. 각 문제의 JSON 형식 (객관식 예시):
   {
     "difficulty": "상" 또는 "중" 또는 "하",
     "type": "multiple_choice",
     "expectedTime": number, 
     "score": number, 
     "intent": "출제 의도",
     "evaluationPoint": "평가 포인트",
     "content": "문제 내용",
     "options": ["보기1", "보기2", "보기3", "보기4"],
     "correctAnswer": "정답 보기"
   }
   
   서술형(descriptive) 예시:
   {
     "difficulty": "상" 또는 "중" 또는 "하",
     "type": "descriptive",
     "expectedTime": number,
     "score": number,
     "intent": "출제 의도",
     "evaluationPoint": "평가 포인트",
     "content": "문제 내용",
     "answerGuideline": "모범 답안 가이드"
   }

3. 난이도 분포:
   - 상: 1문제
   - 중: 2문제
   - 하: 2문제

**중요**: 
- 최종 결과는 반드시 JSON 배열로, 정확히 5개의 문제 객체만 포함해야 합니다. 
- JSON 배열 이외의 어떠한 추가 텍스트, 설명, 문장, 주석도 출력하지 마십시오.
- 최종 출력 예시:
[
  { ... },
  { ... },
  { ... },
  { ... },
  { ... }
]

오직 위와 같은 형태로 결과를 반환하세요.
`
}


const generateQuestions = async (transcript, analysis) => {
    try {
        const prompt = generatePrompt(transcript, analysis)
        const response = await bedrock.invokeModel(prompt)
        
        // 응답이 문자열인 경우 JSON으로 파싱
        let questions
        try {
            questions = typeof response === 'string' ? JSON.parse(response) : response
        } catch (error) {
            console.error('Failed to parse Bedrock response:', error)
            throw new Error('Invalid response format from Bedrock')
        }

        // 응답 유효성 검사
        if (!Array.isArray(questions)) {
            throw new Error('Bedrock response is not an array of questions')
        }

        return questions
    } catch (error) {
        console.error('Question generation error:', error)
        throw error
    }
}

module.exports = {
    generateQuestions
}
