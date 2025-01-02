const { getTranscriptionJobStatus } = require('../../services/transcribeService')
const { dynamodb } = require('../../services/aws')
const { LECTURE_STATUS } = require('../../utils/constants')

exports.handler = async (event) => {
   try {
       const { lectureId, transcriptionJobName } = event
       const timestamp = new Date().toISOString()

       // Transcribe 작업 상태 확인
       const { status: transcribeStatus, outputUrl } = await getTranscriptionJobStatus(transcriptionJobName)

       if (transcribeStatus.toLowerCase() === 'completed') {
           // Transcribe 결과를 바로 DynamoDB에 저장
           const response = await fetch(outputUrl)
           const transcriptData = await response.json()
           
           await dynamodb.update({
               TableName: 'lecture-processing',
               Key: { lectureId },
               UpdateExpression: 'SET transcriptContent = :content',
               ExpressionAttributeValues: {
                   ':content': transcriptData.results.transcripts[0].transcript
               }
           })
       }

       // AWS Transcribe 상태를 애플리케이션 상태로 매핑
       let mappedStatus
       switch (transcribeStatus.toUpperCase()) {
           case 'COMPLETED':
               mappedStatus = LECTURE_STATUS.TRANSCRIBE_COMPLETED
               break
           case 'FAILED':
               mappedStatus = LECTURE_STATUS.TRANSCRIBE_FAILED
               break
           case 'IN_PROGRESS':
               mappedStatus = LECTURE_STATUS.TRANSCRIBING
               break
           default:
               mappedStatus = LECTURE_STATUS.TRANSCRIBING
       }

       return {
           ...event,
           lectureId,
           status: mappedStatus,
           outputUrl,
           updatedAt: timestamp
       }
   } catch (error) {
       console.error('Check transcription error:', error)
       // 에러 발생 시 transcribe_failed 상태 반환
       return {
           ...event,
           status: LECTURE_STATUS.TRANSCRIBE_FAILED,
           error: error.message,
           updatedAt: new Date().toISOString()
       }
   }
}
