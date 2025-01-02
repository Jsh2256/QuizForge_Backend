const LECTURE_STATUS = {
  // 초기 및 전체 상태
  PROCESSING: 'processing',    
  FAILED: 'failed',           
  COMPLETED: 'completed',     

  // Transcribe 관련 상태
  TRANSCRIBING: 'transcribing',          
  TRANSCRIBE_FAILED: 'transcribe_failed', 
  TRANSCRIBE_COMPLETED: 'transcribe_completed', 

  // Comprehend 관련 상태
  ANALYZING: 'analyzing',             
  ANALYZE_FAILED: 'analyze_failed',    
  ANALYZE_COMPLETED: 'analyze_completed', 

  // Bedrock 관련 상태
  GENERATING_QUESTIONS: 'generating_questions',     
  QUESTIONS_FAILED: 'questions_failed',            
  QUESTIONS_COMPLETED: 'questions_completed'       
}

const POST_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted'
}

const QUESTION_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published'
}

module.exports = {
  LECTURE_STATUS,
  POST_STATUS,
  QUESTION_STATUS
}
