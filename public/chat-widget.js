(function() {
    'use strict';

    // Get the script tag that loaded this widget
    const scriptTag = document.currentScript || document.querySelector('script[data-broker-id]');
    const brokerId = scriptTag ? scriptTag.getAttribute('data-broker-id') : null;
    const apiKey = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
    if (!brokerId || !apiKey) {
        console.error('[RunIt Widget] Error: data-broker-id and data-api-key attributes are required');
        return;
    }

    // Configuration
    const API_BASE_URL = scriptTag.src.split('/chat-widget.js')[0];
    const CONFIG_ENDPOINT = `${API_BASE_URL}/api/v1/widget/config/${brokerId}?apiKey=${apiKey}`;
    const CHAT_ENDPOINT = `${API_BASE_URL}/api/v1/widget/chat`;

    // Widget state
    let widgetConfig = null;
    let isOpen = false;
    let sessionId = generateSessionId();
    let messages = [];
    let notificationDismissed = false;

    // Generate a unique session ID
    function generateSessionId() {
        return 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Format message with markdown-like syntax
    function formatMessage(text) {
        if (!text) return '';

        // Escape HTML first
        const div = document.createElement('div');
        div.textContent = text;
        let formatted = div.innerHTML;

        // Convert **bold** to <strong>
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert numbered lists with actual numbers preserved
        formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, function(match, num, content) {
            return '<li value="' + num + '">' + content + '</li>';
        });

        // Wrap consecutive list items in <ol>
        formatted = formatted.replace(/(<li.*?<\/li>\n?)+/g, function(match) {
            return '<ol>' + match + '</ol>';
        });

        // Normalize line breaks: replace 2 or more newlines with exactly one <br>
        formatted = formatted.replace(/\n{2,}/g, '<br>');

        // Remove any remaining single newlines (they're not needed for line breaks in HTML)
        formatted = formatted.replace(/\n/g, '');

        return formatted;
    }

    // Format sources section
    function formatSources(sources) {
        if (!sources || sources.length === 0) return '';

        let sourcesHtml = '<div class="runit-sources">';
        sourcesHtml += '<div class="runit-sources-header">Sources:</div>';

        sources.forEach(source => {
            sourcesHtml += `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" class="runit-source-item">${escapeHtml(source.title || 'Source')}</a>`;
        });

        sourcesHtml += '</div>';
        return sourcesHtml;
    }

    // Load widget configuration
    async function loadConfig() {
        try {
            const response = await fetch(CONFIG_ENDPOINT);
            const data = await response.json();

            if (!data.success) {
                console.error('[RunIt Widget] Failed to load configuration:', data.error);
                return null;
            }

            return data.data;
        } catch (error) {
            console.error('[RunIt Widget] Error loading configuration:', error);
            return null;
        }
    }

    // Create widget HTML
    function createWidget(config) {
        const container = document.createElement('div');
        container.id = 'runit-chat-widget';
        container.setAttribute('data-broker-id', brokerId);

        // Position styles
        const positionClasses = {
            'bottom-right': 'bottom: 24px; right: 24px;',
            'bottom-left': 'bottom: 24px; left: 24px;',
            'top-right': 'top: 24px; right: 24px;',
            'top-left': 'top: 24px; left: 24px;'
        };

        const position = positionClasses[config.position] || positionClasses['bottom-right'];

        container.innerHTML = `
            <style>
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideInFromRight {
                    from {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes pulse {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.4);
                    }
                    50% {
                        box-shadow: 0 0 0 10px rgba(147, 51, 234, 0);
                    }
                }

                #runit-chat-widget {
                    position: fixed;
                    ${position}
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }

                #runit-chat-button {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: ${config.primaryColor};
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    padding: 0;
                }

                #runit-chat-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
                }

                #runit-chat-button.pulse {
                    animation: pulse 2s infinite;
                }

                #runit-chat-button svg {
                    width: 24px;
                    height: 24px;
                    fill: ${config.textColor};
                    transition: transform 0.3s ease;
                }

                #runit-chat-button.open svg {
                    transform: rotate(0deg);
                }

                .runit-icon {
                    position: absolute;
                    transition: all 0.3s ease;
                }

                .runit-icon-message {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                }

                .runit-icon-close {
                    opacity: 0;
                    transform: scale(0) rotate(90deg);
                }

                #runit-chat-button.open .runit-icon-message {
                    opacity: 0;
                    transform: scale(0) rotate(-90deg);
                }

                #runit-chat-button.open .runit-icon-close {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                }

                #runit-notification-bubble {
                    position: absolute;
                    bottom: 75px;
                    ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
                    background: white;
                    padding: 14px 16px;
                    border-radius: 16px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
                    width: 22rem;
                    animation: slideInFromRight 0.4s ease-out;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(0, 0, 0, 0.06);
                }

                #runit-notification-bubble:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
                }

                #runit-notification-bubble.hidden {
                    display: none;
                }

                .runit-notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .runit-notification-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryColor}ee 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    position: relative;
                    box-shadow: 0 2px 8px ${config.primaryColor}33;
                }

                .runit-notification-avatar::after {
                    content: '';
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 11px;
                    height: 11px;
                    background: #10b981;
                    border: 2.5px solid white;
                    border-radius: 50%;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                }

                .runit-notification-avatar svg {
                    width: 22px;
                    height: 22px;
                    fill: white;
                }

                .runit-notification-text {
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                }

                .runit-notification-text > div {
                    display: block;
                    width: 100%;
                }

                .runit-notification-text p {
                    margin: 0 0 4px 0;
                    font-size: 13px;
                    line-height: 1.5;
                    color: #374151;
                    display: block;
                    white-space: normal;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }

                .runit-notification-text p:last-child {
                    margin-bottom: 0;
                }

                .runit-notification-text strong {
                    color: #111827;
                    font-weight: 600;
                    font-size: 14px;
                    display: inline;
                    white-space: normal;
                }

                .runit-notification-close {
                    background: rgba(0, 0, 0, 0.05);
                    border: none;
                    cursor: pointer;
                    padding: 6px;
                    color: #6b7280;
                    transition: all 0.2s;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    flex-shrink: 0;
                }

                .runit-notification-close:hover {
                    background: rgba(0, 0, 0, 0.1);
                    color: #374151;
                }

                #runit-chat-window {
                    display: none;
                    position: absolute;
                    bottom: 75px;
                    ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
                    width: 380px;
                    height: 600px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideInUp 0.3s ease-out;
                }

                #runit-chat-window.open {
                    display: flex;
                }

                #runit-chat-window.fullscreen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    max-height: 100%;
                    border-radius: 0;
                    z-index: 1000000;
                }

                @media (max-width: 480px) {
                    #runit-chat-window {
                        width: calc(100vw - 32px);
                        height: calc(100vh - 100px);
                        max-height: 600px;
                    }
                }

                #runit-chat-header {
                    background: linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryColor}dd 100%);
                    color: ${config.textColor};
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .runit-header-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .runit-header-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                .runit-header-avatar::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    width: 12px;
                    height: 12px;
                    background: #10b981;
                    border: 2px solid ${config.primaryColor};
                    border-radius: 50%;
                    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
                }

                .runit-header-avatar svg {
                    width: 22px;
                    height: 22px;
                    fill: white;
                }

                .runit-header-text h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .runit-header-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    opacity: 0.95;
                    margin-top: 2px;
                }

                .runit-status-dot {
                    width: 6px;
                    height: 6px;
                    background: #10b981;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .runit-header-buttons {
                    display: flex;
                    gap: 8px;
                }

                #runit-chat-fullscreen,
                #runit-chat-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: ${config.textColor};
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                #runit-chat-fullscreen:hover,
                #runit-chat-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                #runit-chat-fullscreen svg,
                #runit-chat-close svg {
                    width: 20px;
                    height: 20px;
                }

                #runit-chat-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    background: #f9fafb;
                    scroll-behavior: smooth;
                }

                #runit-chat-messages::-webkit-scrollbar {
                    width: 6px;
                }

                #runit-chat-messages::-webkit-scrollbar-track {
                    background: transparent;
                }

                #runit-chat-messages::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 3px;
                }

                #runit-chat-messages::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                }

                .runit-message {
                    margin-bottom: 16px;
                    display: flex;
                    gap: 10px;
                    animation: slideInUp 0.3s ease-out;
                }

                .runit-message.bot {
                    flex-direction: row;
                }

                .runit-message.user {
                    flex-direction: row-reverse;
                }

                .runit-message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: ${config.primaryColor};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .runit-message-avatar svg {
                    width: 18px;
                    height: 18px;
                    fill: ${config.textColor};
                }

                .runit-message-content {
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.5;
                    hyphens: none;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .runit-message-content strong {
                    font-weight: 600;
                }

                .runit-message-content ol,
                .runit-message-content ul {
                    margin: 8px 0;
                    padding-left: 20px;
                    list-style-position: outside;
                }

                .runit-message-content ol {
                    list-style-type: none;
                    counter-reset: item;
                }

                .runit-message-content li {
                    margin: 4px 0;
                    display: list-item;
                }

                .runit-message-content ol li {
                    counter-increment: item;
                }

                .runit-message-content ol li::before {
                    content: attr(value) ". ";
                    font-weight: 600;
                }

                .runit-message.bot .runit-message-content {
                    background: white;
                    color: #1f2937;
                    border-bottom-left-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }

                .runit-message.user .runit-message-content {
                    background: ${config.primaryColor};
                    color: ${config.textColor};
                    border-bottom-right-radius: 4px;
                }

                .runit-ai-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #6b7280;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: #f3f4f6;
                    border-radius: 12px;
                }

                .runit-ai-badge::before {
                    content: '✨';
                    font-size: 10px;
                }

                .runit-sources {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #e5e7eb;
                }

                .runit-sources-header {
                    font-size: 11px;
                    font-weight: 600;
                    color: #6b7280;
                    margin-bottom: 4px;
                }

                .runit-source-item {
                    display: inline-block;
                    font-size: 11px;
                    color: ${config.primaryColor};
                    text-decoration: none;
                    margin-right: 12px;
                    margin-bottom: 4px;
                    transition: opacity 0.2s;
                }

                .runit-source-item:hover {
                    opacity: 0.7;
                    text-decoration: underline;
                }

                .runit-source-item::before {
                    content: '🔗 ';
                    font-size: 10px;
                }

                #runit-chat-input-container {
                    padding: 16px;
                    background: white;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 10px;
                }

                #runit-chat-input {
                    flex: 1;
                    border: 1px solid #e5e7eb;
                    border-radius: 24px;
                    padding: 12px 18px;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.2s;
                    font-family: inherit;
                    resize: none;
                }

                #runit-chat-input:focus {
                    border-color: ${config.primaryColor};
                    box-shadow: 0 0 0 3px ${config.primaryColor}22;
                }

                #runit-chat-send {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: ${config.primaryColor};
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                #runit-chat-send:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 4px 12px ${config.primaryColor}44;
                }

                #runit-chat-send:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                #runit-chat-send svg {
                    width: 18px;
                    height: 18px;
                    fill: ${config.textColor};
                }

                .runit-typing-indicator {
                    display: flex;
                    gap: 4px;
                    padding: 12px 16px;
                }

                .runit-typing-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: ${config.primaryColor}88;
                    animation: typing 1.4s infinite;
                }

                .runit-typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }

                .runit-typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }

                @keyframes typing {
                    0%, 60%, 100% {
                        opacity: 0.3;
                        transform: translateY(0);
                    }
                    30% {
                        opacity: 1;
                        transform: translateY(-4px);
                    }
                }

                .runit-powered-by {
                    text-align: center;
                    padding: 8px;
                    font-size: 11px;
                    color: #9ca3af;
                    background: #f9fafb;
                }

                .runit-powered-by a {
                    color: ${config.primaryColor};
                    text-decoration: none;
                }

                .runit-powered-by a:hover {
                    text-decoration: underline;
                }

                ${config.customCSS || ''}
            </style>

            <!-- Notification Bubble -->
            <div id="runit-notification-bubble" class="hidden">
                <div class="runit-notification-content">
                    <div class="runit-notification-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.29 0-2.5-.3-3.57-.85l-.25-.14-2.62.44.44-2.62-.14-.25A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
                            <circle cx="9" cy="12" r="1"/>
                            <circle cx="12" cy="12" r="1"/>
                            <circle cx="15" cy="12" r="1"/>
                        </svg>
                    </div>
                    <div class="runit-notification-text">
                        <div>
                            <p><strong>Hi there! 👋</strong></p>
                            <p>Have a question? I'm here to help you with instant AI-powered answers.</p>
                        </div>
                    </div>
                    <button class="runit-notification-close" onclick="this.parentElement.parentElement.classList.add('hidden'); return false;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="4" x2="4" y2="12"/>
                            <line x1="4" y1="4" x2="12" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Chat Window -->
            <div id="runit-chat-window">
                <div id="runit-chat-header">
                    <div class="runit-header-info">
                        <div class="runit-header-avatar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                            </svg>
                        </div>
                        <div class="runit-header-text">
                            <h3>${config.widgetTitle}</h3>
                            <div class="runit-header-status">
                                <span class="runit-status-dot"></span>
                                <span>Online • AI Assistant</span>
                            </div>
                        </div>
                    </div>
                    <div class="runit-header-buttons">
                        <button id="runit-chat-fullscreen" title="Toggle Fullscreen">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path class="fullscreen-expand" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                                <path class="fullscreen-compress" style="display:none;" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                            </svg>
                        </button>
                        <button id="runit-chat-close" title="Close Chat">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div id="runit-chat-messages"></div>
                ${config.branding?.showPoweredBy !== false ?
                    `<div class="runit-powered-by">
                        Powered by <a href="https://labs.runit.in" target="_blank">RunIt AI</a>
                    </div>` : ''}
                <div id="runit-chat-input-container">
                    <input type="text" id="runit-chat-input" placeholder="${config.placeholderText}" />
                    <button id="runit-chat-send">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Chat Button -->
            <button id="runit-chat-button" class="pulse">
                <svg class="runit-icon runit-icon-message" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    <circle cx="9" cy="10" r="1.5"/>
                    <circle cx="12" cy="10" r="1.5"/>
                    <circle cx="15" cy="10" r="1.5"/>
                </svg>
                <svg class="runit-icon runit-icon-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;

        document.body.appendChild(container);

        // Setup event listeners
        setupEventListeners(config);

        // Show greeting message if enabled
        if (config.settings.showGreeting) {
            setTimeout(() => {
                addMessage('bot', config.greetingMessage);
            }, config.settings.greetingDelay || 2000);
        }

        // Show notification bubble after delay
        if (!notificationDismissed) {
            setTimeout(() => {
                const notification = document.getElementById('runit-notification-bubble');
                if (notification && !isOpen) {
                    notification.classList.remove('hidden');
                }
            }, 3000);
        }
    }

    // Setup event listeners
    function setupEventListeners(config) {
        const button = document.getElementById('runit-chat-button');
        const closeBtn = document.getElementById('runit-chat-close');
        const fullscreenBtn = document.getElementById('runit-chat-fullscreen');
        const chatWindow = document.getElementById('runit-chat-window');
        const input = document.getElementById('runit-chat-input');
        const sendBtn = document.getElementById('runit-chat-send');
        const notification = document.getElementById('runit-notification-bubble');

        button.addEventListener('click', () => toggleChat());
        closeBtn.addEventListener('click', () => toggleChat());
        fullscreenBtn.addEventListener('click', () => toggleFullscreen());

        if (notification) {
            notification.addEventListener('click', (e) => {
                if (!e.target.closest('.runit-notification-close')) {
                    notification.classList.add('hidden');
                    toggleChat();
                }
            });
        }

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => sendMessage());
    }

    // Toggle chat window
    function toggleChat() {
        isOpen = !isOpen;
        const chatWindow = document.getElementById('runit-chat-window');
        const button = document.getElementById('runit-chat-button');
        const notification = document.getElementById('runit-notification-bubble');

        chatWindow.classList.toggle('open', isOpen);
        button.classList.toggle('open', isOpen);

        if (isOpen) {
            button.classList.remove('pulse');
            if (notification) {
                notification.classList.add('hidden');
                notificationDismissed = true;
            }
            document.getElementById('runit-chat-input').focus();
        }
    }

    // Toggle fullscreen mode
    function toggleFullscreen() {
        const chatWindow = document.getElementById('runit-chat-window');
        const fullscreenBtn = document.getElementById('runit-chat-fullscreen');
        const expandIcon = fullscreenBtn.querySelector('.fullscreen-expand');
        const compressIcon = fullscreenBtn.querySelector('.fullscreen-compress');

        chatWindow.classList.toggle('fullscreen');

        // Toggle icon visibility
        if (chatWindow.classList.contains('fullscreen')) {
            expandIcon.style.display = 'none';
            compressIcon.style.display = 'block';
        } else {
            expandIcon.style.display = 'block';
            compressIcon.style.display = 'none';
        }
    }

    // Add message to chat
    function addMessage(type, content, messageId = null) {
        const messagesContainer = document.getElementById('runit-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `runit-message ${type}`;
        if (messageId) {
            messageDiv.id = messageId;
        }

        const avatarSvg = type === 'bot'
            ? '<path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>'
            : '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>';

        const formattedContent = type === 'bot' ? formatMessage(content) : escapeHtml(content);

        messageDiv.innerHTML = `
            <div class="runit-message-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    ${avatarSvg}
                </svg>
            </div>
            <div>
                <div class="runit-message-content">${formattedContent}</div>
                ${type === 'bot' ? '<div class="runit-ai-badge">AI Assistant</div>' : ''}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (!messageId || type === 'user') {
            messages.push({ type, content, timestamp: new Date() });
        }

        return messageDiv;
    }

    // Update message content (for streaming)
    function updateMessage(messageId, content, sources = null) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.runit-message-content');
            if (contentDiv) {
                let html = formatMessage(content);
                if (sources && sources.length > 0) {
                    html += formatSources(sources);
                }
                contentDiv.innerHTML = html;
            }
            const messagesContainer = document.getElementById('runit-chat-messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Show typing indicator
    function showTypingIndicator() {
        const messagesContainer = document.getElementById('runit-chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'runit-message bot';
        typingDiv.id = 'runit-typing-indicator';
        typingDiv.innerHTML = `
            <div class="runit-message-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
            </div>
            <div class="runit-typing-indicator">
                <div class="runit-typing-dot"></div>
                <div class="runit-typing-dot"></div>
                <div class="runit-typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Hide typing indicator
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('runit-typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Send message
    async function sendMessage() {
        const input = document.getElementById('runit-chat-input');
        const sendBtn = document.getElementById('runit-chat-send');
        const query = input.value.trim();

        if (!query) return;

        // Add user message
        addMessage('user', query);
        input.value = '';
        sendBtn.disabled = true;

        // Show typing indicator
        if (widgetConfig.settings.showTypingIndicator) {
            showTypingIndicator();
        }

        // Create a unique message ID for the bot response
        const botMessageId = 'bot-msg-' + Date.now();
        let botMessageCreated = false;

        try {
            const response = await fetch(CHAT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey,
                    brokerId,
                    query,
                    sessionId
                })
            });

            hideTypingIndicator();

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // Read streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let answer = '';
            let sources = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'token') {
                                answer += data.content;

                                // Create message on first token or update existing
                                if (!botMessageCreated) {
                                    addMessage('bot', answer, botMessageId);
                                    botMessageCreated = true;
                                } else {
                                    updateMessage(botMessageId, answer);
                                }
                            } else if (data.type === 'done') {
                                answer = data.answer || answer;
                                sources = data.sources || [];

                                if (!botMessageCreated) {
                                    addMessage('bot', answer, botMessageId);
                                    botMessageCreated = true;
                                }

                                // Update with sources
                                updateMessage(botMessageId, answer, sources);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }

            // Add bot response if no streaming data received
            if (!botMessageCreated) {
                addMessage('bot', answer || 'I apologize, but I couldn\'t process your request. Please try asking in a different way.', botMessageId);
            }

            // Store the final message
            messages.push({ type: 'bot', content: answer, sources: sources, timestamp: new Date() });

        } catch (error) {
            hideTypingIndicator();
            console.error('[RunIt Widget] Error sending message:', error);
            addMessage('bot', 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.');
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize widget
    async function init() {
        const config = await loadConfig();
        if (!config) {
            console.error('[RunIt Widget] Failed to initialize widget');
            return;
        }

        if (!config.enabled) {
            console.log('[RunIt Widget] Widget is disabled');
            return;
        }

        widgetConfig = config;
        createWidget(config);

        console.log('[RunIt Widget] Initialized successfully');
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
