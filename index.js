import socket from 'socket.io'
import Twitter from 'node-tweet-stream'

const io = socket(5000)
const twitter = new Twitter({
  consumer_key: 'L5v3iHLnQAvRRpOIkXogNCEhR',
  consumer_secret: 'ImtlapoqFRmfLKQ2k5ePr5O22n7RaDqgR2JLMBLMrN49qdGCfi',
  token: '538417416-zs95vSNiQw8FYc2Ozrdowxq3IWreAE2Ib6IXaxpC',
  token_secret: 'ds36WlxdDp5HGIMQFMCwj24lwiU55FeBoxgiZcpc8bFqF'
})

let subjects = {}

function register(subject) {
  subjects[subject] = subjects[subject] || {
    channel: io.of(`/${subject}`),
    tweets: []
  }
}

function relevant(tweet, subject) {
  if (!(tweet && subject))
    return false

  const pattern = new RegExp(subject, 'i')
  const { text, quoted_status, retweeted_status } = tweet
  const { urls, user_mentions } = tweet.entities
  const testArray = (arr, ...props) =>
    arr.some(e => props.some(prop => pattern.test(e[prop])))

  return pattern.test(tweet.text) ||
    testArray(urls, 'display_url', 'expanded_url') ||
    testArray(user_mentions, 'name', 'screen_name') ||
    relevant(quoted_status, subject) ||
    relevant(retweeted_status, subject)
}

function enqueue(tweet) {
  Object.keys(subjects).forEach(key => {
    if (relevant(tweet, key))
      subjects[key].tweets.unshift(tweet)
  })
}

function untrack(subject) {
  twitter.untrack(subject)
  delete subjects[subject]
}

function untrackAll() {
  Object.keys(subjects).forEach(key => {
    untrack(key)
  })
}

setInterval(() => {
  Object.keys(subjects).forEach(key => {
    console.log('checking for tweets related to ' + key)
    const subject = subjects[key]
    if (subject.tweets.length > 0) {
      console.log(`found ${subject.tweets.length} tweets, publishing`)
      subject.channel.emit('tweets', subject.tweets)
      subject.tweets = []
    }
  })
}, 3000)

twitter.on('tweet', enqueue)
twitter.on('error', (err) => console.log('Error:', err))

io.on('connection', (socket) => {
  io.emit('connected', { at: new Date() })

  socket.on('track', (subject) => {
    register(subject)
    twitter.track(subject)
  })

  socket.on('untrack', untrack)

  socket.on('disconnect', () => {
    console.log('disconnected')
    untrackAll()
  })
})
