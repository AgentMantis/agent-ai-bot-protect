(function() {
    // Bot detection score and threshold
    let botScore = 0;
    const BOT_THRESHOLD = 60; // Score above which we consider the visitor a bot
    let detectionComplete = false;
    let interactionEvents = 0;
    let mouseMovements = 0;
    
    // Get the initial data we captured
    const initialData = window._agentAIBotProtectInitialData || {
        userAgent: navigator.userAgent,
        timestamp: new Date().getTime(),
        referrer: document.referrer
    };

    // Function to send data to our endpoint
    async function sendAnalyticsData(data) {
        try {
            const response = await fetch('/wp-json/agent-ai-bot-protect/v1/log-visit', {
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
                    platform: navigator.platform,
                    isBot: detectionComplete ? (botScore >= BOT_THRESHOLD) : null,
                    botScore: botScore,
                    botDetectionData: getBotDetectionData()
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }

        } catch (error) {
            console.error('Agent AI Bot Protect Analytics Error:', error);
        }
    }

    // Function to get all bot detection data
    function getBotDetectionData() {
        return {
            userAgentChecks: userAgentChecks(),
            featureDetection: featureDetectionResults,
            behaviorMetrics: {
                mouseMovements,
                interactionEvents,
                timeOnPage: new Date().getTime() - initialData.timestamp,
                scrollPercentage: getScrollPercentage()
            },
            fingerprinting: fingerprintData,
            honeypotInteractions: honeypotInteractions
        };
    }

    // 1. User Agent Analysis
    function userAgentChecks() {
        const ua = navigator.userAgent.toLowerCase();
        const checks = {
            containsBot: /bot|crawler|spider|scraper|fetch|headless/i.test(ua),
            isKnownBot: /googlebot|bingbot|yandexbot|slurp|duckduckbot|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator/i.test(ua),
            hasInconsistentBrowserData: checkBrowserInconsistencies()
        };
        
        // Add to bot score based on user agent checks
        if (checks.containsBot) botScore += 30;
        if (checks.isKnownBot) botScore += 50;
        if (checks.hasInconsistentBrowserData) botScore += 25;
        
        return checks;
    }

    function checkBrowserInconsistencies() {
        // Check for inconsistencies between userAgent and browser features
        const ua = navigator.userAgent.toLowerCase();
        
        // Chrome check
        if (ua.includes('chrome') && !window.chrome) return true;
        
        // Firefox check
        if (ua.includes('firefox') && !('InstallTrigger' in window)) return true;
        
        // Safari check
        if (ua.includes('safari') && !ua.includes('chrome') && !('pushNotification' in window.safari)) return true;
        
        return false;
    }

    // 2. Feature Detection
    const featureDetectionResults = {
        hasWebGL: hasWebGL(),
        hasNotifications: 'Notification' in window,
        hasWebRTC: hasWebRTC(),
        hasCanvas: hasCanvas(),
        hasTouch: 'ontouchstart' in window,
        hasSessionStorage: hasSessionStorage(),
        hasLocalStorage: hasLocalStorage(),
        hasPlugins: hasPlugins()
    };

    function hasWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    function hasWebRTC() {
        return !!(window.RTCPeerConnection || window.mozRTCPeerConnection || 
                window.webkitRTCPeerConnection);
    }

    function hasCanvas() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        } catch (e) {
            return false;
        }
    }

    function hasSessionStorage() {
        try {
            return !!window.sessionStorage;
        } catch (e) {
            return false;
        }
    }

    function hasLocalStorage() {
        try {
            return !!window.localStorage;
        } catch (e) {
            return false;
        }
    }

    function hasPlugins() {
        return navigator.plugins && navigator.plugins.length > 0;
    }

    // Analyze feature detection results
    function analyzeFeatureDetection() {
        let missingFeatures = 0;
        
        // Count missing features that most real browsers would have
        if (!featureDetectionResults.hasWebGL) missingFeatures++;
        if (!featureDetectionResults.hasCanvas) missingFeatures++;
        if (!featureDetectionResults.hasSessionStorage) missingFeatures++;
        if (!featureDetectionResults.hasLocalStorage) missingFeatures++;
        
        // Desktop browsers typically have plugins
        if (!featureDetectionResults.hasPlugins && !featureDetectionResults.hasTouch) missingFeatures++;
        
        // Add to bot score based on missing features
        if (missingFeatures >= 3) botScore += 40;
        else if (missingFeatures >= 1) botScore += 20;
    }

    // 3. Browser Fingerprinting
    let fingerprintData = {};
    
    function generateFingerprint() {
        // Canvas fingerprinting
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;
            
            // Text with different styles and colors
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("agentAIBotProtect", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Fingerprint", 4, 17);
            
            // Get the data URL and hash it
            const dataURL = canvas.toDataURL();
            fingerprintData.canvasHash = simpleHash(dataURL);
            
            // Check if canvas is blank or has default values (common in headless browsers)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let isBlank = true;
            for (let i = 0; i < imageData.length; i += 4) {
                if (imageData[i] !== 0 || imageData[i+1] !== 0 || 
                    imageData[i+2] !== 0 || imageData[i+3] !== 0) {
                    isBlank = false;
                    break;
                }
            }
            
            if (isBlank) botScore += 30;
        } catch (e) {
            fingerprintData.canvasError = true;
            botScore += 15; // Error could indicate a headless browser
        }
        
        // WebGL fingerprinting
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    fingerprintData.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    fingerprintData.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    
                    // Check for headless browser signatures
                    const renderer = fingerprintData.webglRenderer.toLowerCase();
                    if (renderer.includes('swiftshader') || 
                        renderer.includes('llvmpipe') || 
                        renderer.includes('virtualbox') ||
                        renderer.includes('vmware')) {
                        botScore += 25;
                    }
                }
            }
        } catch (e) {
            fingerprintData.webglError = true;
        }
        
        // Font fingerprinting
        fingerprintData.fonts = detectFonts();
        if (fingerprintData.fonts.length < 3) botScore += 15;
    }
    
    function detectFonts() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const fontList = [
            'Arial', 'Courier New', 'Georgia', 'Times New Roman', 
            'Verdana', 'Helvetica', 'Calibri', 'Tahoma'
        ];
        const detectedFonts = [];
        
        const h = document.createElement('span');
        h.style.fontSize = '72px';
        h.style.visibility = 'hidden';
        h.innerHTML = 'mmmmmmmmmmlli';
        document.body.appendChild(h);
        
        const baseFontWidths = {};
        baseFonts.forEach(baseFont => {
            h.style.fontFamily = baseFont;
            baseFontWidths[baseFont] = h.offsetWidth;
        });
        
        for (let font of fontList) {
            let detected = false;
            for (let baseFont of baseFonts) {
                h.style.fontFamily = `'${font}', ${baseFont}`;
                if (h.offsetWidth !== baseFontWidths[baseFont]) {
                    detected = true;
                    break;
                }
            }
            if (detected) detectedFonts.push(font);
        }
        
        document.body.removeChild(h);
        return detectedFonts;
    }
    
    function simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    // 4. Behavior Analysis
    function setupBehaviorTracking() {
        // Track mouse movements
        document.addEventListener('mousemove', throttle(function(e) {
            mouseMovements++;
            // Check for linear or pattern-based movements
            trackMousePattern(e);
        }, 100));
        
        // Track user interactions
        const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart', 'touchmove'];
        interactionEvents.forEach(event => {
            document.addEventListener(event, function() {
                interactionEvents++;
            });
        });
        
        // Check scroll behavior
        window.addEventListener('scroll', throttle(function() {
            checkScrollBehavior();
        }, 200));
        
        // Set a timer to evaluate behavior after a delay
        setTimeout(evaluateBehavior, 10000);
    }
    
    let mousePositions = [];
    function trackMousePattern(e) {
        mousePositions.push({x: e.clientX, y: e.clientY, time: Date.now()});
        
        // Keep only the last 20 positions
        if (mousePositions.length > 20) {
            mousePositions.shift();
        }
        
        // If we have enough positions, check for patterns
        if (mousePositions.length >= 10) {
            checkMousePatterns();
        }
    }
    
    function checkMousePatterns() {
        // Check for perfectly straight lines (common in bots)
        let straightLineSegments = 0;
        
        for (let i = 2; i < mousePositions.length; i++) {
            const p1 = mousePositions[i-2];
            const p2 = mousePositions[i-1];
            const p3 = mousePositions[i];
            
            // Calculate if three points are in a straight line
            const slope1 = p1.x === p2.x ? Infinity : (p2.y - p1.y) / (p2.x - p1.x);
            const slope2 = p2.x === p3.x ? Infinity : (p3.y - p2.y) / (p3.x - p2.x);
            
            if (slope1 === slope2 || 
                (slope1 === Infinity && slope2 === Infinity)) {
                straightLineSegments++;
            }
        }
        
        // If more than 60% of movements are in straight lines, likely a bot
        if (straightLineSegments > 5) {
            botScore += 20;
        }
        
        // Check for unnaturally consistent timing between movements
        const timeDiffs = [];
        for (let i = 1; i < mousePositions.length; i++) {
            timeDiffs.push(mousePositions[i].time - mousePositions[i-1].time);
        }
        
        // Calculate standard deviation of time differences
        const avg = timeDiffs.reduce((sum, val) => sum + val, 0) / timeDiffs.length;
        const variance = timeDiffs.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / timeDiffs.length;
        const stdDev = Math.sqrt(variance);
        
        // If timing is too consistent (low standard deviation), likely a bot
        if (stdDev < 5 && timeDiffs.length > 5) {
            botScore += 15;
        }
    }
    
    let lastScrollTop = 0;
    let scrollDirectionChanges = 0;
    
    function checkScrollBehavior() {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        
        // Check if scroll direction changed
        if ((st > lastScrollTop && lastScrollTop > 0) || 
            (st < lastScrollTop && st > 0)) {
            scrollDirectionChanges++;
        }
        
        lastScrollTop = st;
    }
    
    function getScrollPercentage() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        return scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    }
    
    function evaluateBehavior() {
        // Evaluate mouse movements
        if (mouseMovements < 5) {
            botScore += 20; // Very few mouse movements
        }
        
        // Evaluate interaction events
        if (interactionEvents < 3) {
            botScore += 15; // Very few interactions
        }
        
        // Evaluate scroll behavior
        if (scrollDirectionChanges < 1 && getScrollPercentage() > 30) {
            botScore += 10; // Scrolled but never changed direction
        }
        
        // Final bot detection
        finalizeBotDetection();
    }

    // 5. Honeypot Techniques
    let honeypotInteractions = 0;
    
    function setupHoneypots() {
        // Create hidden link that only bots would interact with
        const honeypotLink = document.createElement('a');
        honeypotLink.href = '/totally-not-a-trap';
        honeypotLink.style.opacity = '0';
        honeypotLink.style.position = 'absolute';
        honeypotLink.style.pointerEvents = 'none';
        honeypotLink.textContent = 'Click here for special offer';
        document.body.appendChild(honeypotLink);
        
        // Track if it's clicked or hovered
        honeypotLink.addEventListener('mouseover', incrementHoneypot);
        honeypotLink.addEventListener('click', incrementHoneypot);
        
        // Create hidden form field
        const form = document.querySelector('form');
        if (form) {
            const honeypotField = document.createElement('input');
            honeypotField.type = 'text';
            honeypotField.name = 'website'; // Common honeypot field name
            honeypotField.style.display = 'none';
            honeypotField.autocomplete = 'off';
            
            form.appendChild(honeypotField);
            
            // Check if the field gets filled
            form.addEventListener('submit', function() {
                if (honeypotField.value) {
                    honeypotInteractions++;
                    botScore += 50; // Strong indicator of a bot
                }
            });
        }
    }
    
    function incrementHoneypot() {
        honeypotInteractions++;
        botScore += 50; // Strong indicator of a bot
    }

    // Utility functions
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Initialize all detection methods
    function initBotDetection() {
        // Run initial checks
        userAgentChecks();
        analyzeFeatureDetection();
        
        // Set up behavior tracking
        setupBehaviorTracking();
        
        // Set up honeypots
        setupHoneypots();
        
        // Generate fingerprint
        if (document.body) {
            generateFingerprint();
        } else {
            window.addEventListener('DOMContentLoaded', generateFingerprint);
        }
        
        // Final check after some time to allow for behavior analysis
        setTimeout(finalizeBotDetection, 15000);
    }
    
    function finalizeBotDetection() {
        if (detectionComplete) return;
        
        detectionComplete = true;
        
        // Send the final bot detection data
        sendAnalyticsData({
            ...initialData,
            eventType: 'botDetectionComplete',
            isBot: botScore >= BOT_THRESHOLD,
            botScore: botScore,
            botDetectionData: getBotDetectionData()
        });
        
        // Optionally, take action if it's a bot
        if (botScore >= BOT_THRESHOLD) {
            console.log('Bot detected with score:', botScore);
            // You could redirect, show a captcha, or take other actions here
        }
    }

    // Send the initial analytics data
    sendAnalyticsData(initialData);

    // Initialize bot detection
    initBotDetection();

    // Optionally, set up event listeners for additional tracking
    window.addEventListener('unload', () => {
        // Track time spent on page
        const timeSpent = new Date().getTime() - initialData.timestamp;
        sendAnalyticsData({
            ...initialData,
            eventType: 'pageExit',
            timeSpent,
            isBot: detectionComplete ? (botScore >= BOT_THRESHOLD) : null,
            botScore: botScore
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