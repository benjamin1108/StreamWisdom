export async function fetchRegularTransform(url, complexity) {
    try {
        const response = await fetch('/api/transform', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                complexity: complexity
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error('Regular Transform API error:', error);
        throw error; // Re-throw to be caught by the caller
    }
}

export async function fetchStreamTransform(url, complexity, onData, onError, onComplete) {
    try {
        const response = await fetch('/api/transform-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                complexity: complexity
            })
        });

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch (e) {
                // Ignore if response is not json
            }
            throw new Error(errorMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim() !== '') { // Process any remaining data in buffer
                        try {
                            const parsed = JSON.parse(buffer.trim());
                            onData(parsed);
                        } catch (e) {
                             console.warn('Stream ended with non-JSON data in buffer:', buffer.trim(), e);
                        }
                    }
                    console.log('Stream finished.');
                    if (onComplete) onComplete();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last partial line in buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') {
                            console.log('Received [DONE] signal in stream.');
                            // If [DONE] is a separate signal and not part of the last JSON,
                            // onComplete will be called when done is true.
                            // For now, assume 'done' from reader.read() is the primary completion signal.
                            continue; 
                        }
                        try {
                            const parsed = JSON.parse(dataStr);
                            onData(parsed);
                        } catch (error) {
                            console.error('Failed to parse stream data chunk:', error, dataStr);
                            // Decide if an individual parse error should call onError
                        }
                    } else {
                        console.warn("Received non-event stream line:", line);
                    }
                }
            } catch (readError) {
                console.error('Error reading from stream:', readError);
                if (onError) onError(readError.message || 'Stream read error');
                break; 
            }
        }
    } catch (fetchError) {
        console.error('Stream Transform API fetch error:', fetchError);
        if (onError) onError(fetchError.message || 'Network error during stream setup');
    }
} 