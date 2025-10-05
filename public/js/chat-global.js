// public/js/chat-global.js
// Load ChatWindow class and make it available globally

import { ChatWindow } from './components/chat-window.js';

// Make ChatWindow available globally for template usage
window.ChatWindow = ChatWindow;

console.log('ChatWindow class loaded and available globally');
