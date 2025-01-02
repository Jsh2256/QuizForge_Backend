const { s3 } = require('./aws')

const getLectureS3Objects = (lectureId) => [
    `lectures/${lectureId}/audio.mp3`,
    `transcripts/${lectureId}/transcript.json`,
    `analysis/${lectureId}/analysis.json`,
    `questions/${lectureId}/questions.json`
]

const getSignedUrl = async (bucket, key, expiresIn = 3600) => {
    return await s3.getSignedUrl({
        Bucket: bucket,
        Key: key,
        Expires: expiresIn
    })
}

const deleteS3Objects = async (bucket, keys) => {
    await Promise.all(keys.map(Key => 
        s3.deleteObject({
            Bucket: bucket,
            Key
        }).catch(err => console.warn(`Failed to delete ${Key}:`, err))
    ))
}

module.exports = {
    getLectureS3Objects,
    getSignedUrl,
    deleteS3Objects
}
