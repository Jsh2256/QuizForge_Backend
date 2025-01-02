const { comprehend } = require('./aws')

const splitTextIntoChunks = (text, maxBytes) => {
    const chunks = []
    let currentChunk = ''
    const sentences = text.split(/[.!?]+/)

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim()
        if (!trimmedSentence) continue

        if (Buffer.byteLength(currentChunk + trimmedSentence, 'utf8') <= maxBytes) {
            currentChunk += (currentChunk ? ' ' : '') + trimmedSentence
        } else {
            if (currentChunk) chunks.push(currentChunk)
            currentChunk = trimmedSentence
        }
    }

    if (currentChunk) chunks.push(currentChunk)
    return chunks
}

const analyzeText = async (text, languageCode = 'ko') => {
    try {
        const chunks = splitTextIntoChunks(text, 4800)
        let allKeyPhrases = []
        let allEntities = []
        let sentiments = []

        for (const chunk of chunks) {
            const [keyPhrasesResult, entitiesResult, sentimentResult] = await Promise.all([
                comprehend.detectKeyPhrases({
                    Text: chunk,
                    LanguageCode: languageCode
                }),
                comprehend.detectEntities({
                    Text: chunk,
                    LanguageCode: languageCode
                }),
                comprehend.detectSentiment({
                    Text: chunk,
                    LanguageCode: languageCode
                })
            ])

            allKeyPhrases.push(...keyPhrasesResult.KeyPhrases)
            allEntities.push(...entitiesResult.Entities)
            sentiments.push(sentimentResult)
        }

        return {
            keyPhrases: processKeyPhrases(allKeyPhrases),
            entities: processEntities(allEntities),
            sentiment: calculateAverageSentiment(sentiments)
        }
    } catch (error) {
        console.error('Comprehend analysis error:', error)
        throw error
    }
}

const processKeyPhrases = (keyPhrases) => {
    return Array.from(new Set(
        keyPhrases
            .sort((a, b) => b.Score - a.Score)
            .map(phrase => phrase.Text)
    )).slice(0, 50)
}

const processEntities = (entities) => {
    const groupedEntities = entities.reduce((acc, entity) => {
        if (!acc[entity.Type]) acc[entity.Type] = new Set()
        acc[entity.Type].add(entity.Text)
        return acc
    }, {})

    return Object.entries(groupedEntities).reduce((acc, [type, values]) => {
        acc[type] = Array.from(values)
        return acc
    }, {})
}

const calculateAverageSentiment = (sentiments) => {
    const sentimentScores = sentiments.reduce((acc, sentiment) => {
        Object.entries(sentiment.SentimentScore).forEach(([key, value]) => {
            if (!acc[key]) acc[key] = 0
            acc[key] += value
        })
        return acc
    }, {})

    Object.keys(sentimentScores).forEach(key => {
        sentimentScores[key] /= sentiments.length
    })

    return {
        predominant: getMostFrequentSentiment(sentiments.map(s => s.Sentiment)),
        scores: sentimentScores
    }
}

const getMostFrequentSentiment = (sentiments) => {
    const counts = sentiments.reduce((acc, sentiment) => {
        acc[sentiment] = (acc[sentiment] || 0) + 1
        return acc
    }, {})
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

module.exports = {
    analyzeText,
    splitTextIntoChunks,
    processKeyPhrases,
    processEntities
}
