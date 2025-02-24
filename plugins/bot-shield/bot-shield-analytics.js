(function() {
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