(function() {
    // Get the initial data we captured
    const initialData = window._botShieldInitialData || {
        userAgent: navigator.userAgent,
        timestamp: new Date().getTime(),
        referrer: document.referrer
    };

    // Function to send data to our endpoint
    async function sendAnalyticsData(data) {
        try {
            const response = await fetch('/wp-json/bot-shield/v1/log-visit', {
                method: 'POST',
                credentials: 'same-origin', // Include credentials
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    ...data,
                    path: window.location.pathname,
                    url: window.location.href,
                    // Add any additional data you want to capture
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language,
                    platform: navigator.platform
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }

        } catch (error) {
            console.error('Bot Shield Analytics Error:', error);
        }
    }

    // Send the analytics data
    sendAnalyticsData(initialData);

    // Optionally, set up event listeners for additional tracking
    window.addEventListener('unload', () => {
        // Track time spent on page
        const timeSpent = new Date().getTime() - initialData.timestamp;
        sendAnalyticsData({
            ...initialData,
            eventType: 'pageExit',
            timeSpent
        });
    });

    // Function to capture and log headers from fetch requests
    const originalFetch = window.fetch;
    window.fetch = function() {
        return originalFetch.apply(this, arguments)
            .then(response => {
                console.log('Request Headers:', response.headers);
                return response;
            });
    }

    // Function to capture and log headers from XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        
        xhr.open = function() {
            xhr.addEventListener('load', function() {
                console.log('XHR Headers:', this.getAllResponseHeaders());
            });
            return originalOpen.apply(this, arguments);
        };
        
        return xhr;
    };

    // Log initial page request headers
    console.log('Page Request Headers:', {
        'User-Agent': navigator.userAgent,
        'Accept-Language': navigator.language,
        'Referrer': document.referrer,
    });
})(); 