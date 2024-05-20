require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const snoowrap = require('snoowrap');
const vader = require('vader-sentiment');
const lda = require('lda');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const reddit = new snoowrap({
    userAgent: process.env.REDDIT_USER_AGENT,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD
});

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/api/analyze', async (req, res) => {
    const { contest } = req.body;

    try {
        console.log(`Received request to analyze contest: ${contest}`);

        // Make OpenAI API call to infer subreddit
        const subreddit = await inferSubreddit(contest);
        console.log(`Inferred subreddit: ${subreddit}`);

        // Fetch data from Reddit API
        const redditData = await fetchRedditData(subreddit);
        console.log(`Fetched ${redditData.length} comments from subreddit: ${subreddit}`);

        if (redditData.length === 0) {
            console.log(`No comments found in subreddit: ${subreddit}. Trying a fallback subreddit.`);
            return res.status(404).json({ error: 'No comments found for the inferred subreddit.' });
        }

        // Perform sentiment analysis
        const sentiment = analyzeSentiment(redditData);
        console.log(`Sentiment analysis result: ${sentiment}`);

        // Perform topic modeling
        const topics = extractTopics(redditData);
        console.log(`Extracted topics: ${topics.join(', ')}`);

        res.json({ sentiment, topics });
    } catch (error) {
        console.error(`Error processing request: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

async function inferSubreddit(contest) {
    const prompt = `Given the contest "${contest}", provide only the most relevant subreddit name.`;
    const response = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
    });

    const inferredSubreddit = response.choices[0].message.content.trim();
    const subredditMatch = inferredSubreddit.match(/r\/(\w+)/);

    if (subredditMatch && subredditMatch[1]) {
        return subredditMatch[1];
    } else {
        throw new Error('Failed to infer a valid subreddit.');
    }
}

async function fetchRedditData(subreddit) {
    try {
        const posts = await reddit.getSubreddit(subreddit).getNew({ limit: 10 });
        const comments = [];

        for (const post of posts) {
            const submissionComments = await post.expandReplies({ depth: 1, limit: 10 });
            submissionComments.comments.forEach(comment => {
                comments.push(comment.body);
            });
            if (comments.length >= 10) break; // Stop if we have enough comments
        }

        return comments.slice(0, 10); // Ensure we return at most 10 comments
    } catch (error) {
        throw new Error(`Failed to fetch data from subreddit ${subreddit}: ${error.message}`);
    }
}

function analyzeSentiment(data) {
    const sentiments = data.map(comment => vader.SentimentIntensityAnalyzer.polarity_scores(comment));
    const avgSentiment = sentiments.reduce((acc, curr) => acc + curr.compound, 0) / sentiments.length;

    if (avgSentiment > 0.05) {
        return 'Positive';
    } else if (avgSentiment < -0.05) {
        return 'Negative';
    } else {
        return 'Neutral';
    }
}

function extractTopics(data) {
    try {
        // Ensure data is an array of strings (sentences)
        const sentences = data.map((comment, index) => {
            if (typeof comment !== 'string') {
                console.error(`Non-string comment at index ${index}:`, comment);
                throw new Error(`Non-string comment at index ${index}`);
            }
            return comment;
        });

        console.log('Sentences for LDA:', JSON.stringify(sentences, null, 2));

        const result = lda(sentences, 2, 5);  // 2 topics, 5 terms per topic
        const topics = result.map(topic => topic.map(term => term.term).join(', '));
        return topics;
    } catch (error) {
        console.error(`Error in extractTopics: ${error.message}`);
        throw error;
    }
}
