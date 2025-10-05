// public/js/application.js
// Basic application JavaScript
console.log('GOV.UK Chat Interface loaded');

// Import and expose ChatWindow class globally
import { ChatWindow } from './components/chat-window.js';

// Make ChatWindow available globally for template usage
window.ChatWindow = ChatWindow;

// Initialize GOV.UK Frontend components
if (typeof window.GOVUKFrontend !== 'undefined') {
    window.GOVUKFrontend.initAll();
}
