// public/js/application.js
// Basic application JavaScript
console.log('GOV.UK Chat Interface loaded');

// Initialize GOV.UK Frontend components
if (typeof window.GOVUKFrontend !== 'undefined') {
    window.GOVUKFrontend.initAll();
}
