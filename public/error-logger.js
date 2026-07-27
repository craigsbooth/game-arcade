// ===== Client Error Logger =====
// Include this in any game page to capture errors to server log

(function() {
    const gameName = document.title || 'unknown';

    function sendError(error, stack) {
        try {
            fetch('/api/log-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game: gameName,
                    error: String(error),
                    stack: stack || '',
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                })
            }).catch(() => {}); // Silently fail if server unreachable
        } catch(e) {}
    }

    // Catch uncaught errors
    window.addEventListener('error', function(event) {
        sendError(
            event.message || 'Unknown error',
            event.error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`
        );
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        sendError(
            'Unhandled Promise: ' + (event.reason ? event.reason.message || event.reason : 'unknown'),
            event.reason ? event.reason.stack : ''
        );
    });

    // Expose for manual logging from game code
    window.logGameError = function(msg, extra) {
        sendError(msg, extra || new Error().stack);
    };

    console.log('[ErrorLogger] Active for:', gameName);
})();
