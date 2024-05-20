document.getElementById('contest-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const contest = document.getElementById('contest').value;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p>Analyzing ${contest}...</p>`;

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contest })
        });

        if (response.ok) {
            const data = await response.json();
            displayResults(data);
        } else {
            resultsDiv.innerHTML = `<p>Error analyzing contest. Please try again.</p>`;
        }
    } catch (error) {
        resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
    }
});

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<h2>Results</h2>
                            <p>Sentiment: ${data.sentiment}</p>
                            <p>Topics: ${data.topics.join(', ')}</p>`;
}
