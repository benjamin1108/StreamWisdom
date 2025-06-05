import StreamWisdom from './stream-wisdom.js';
// import ReadingAssistant from './modules/reading-assistant.js';

document.addEventListener('DOMContentLoaded', () => {
    new StreamWisdom();
    // new ReadingAssistant();
    console.log("StreamWisdom initialized.");
    
    // Listen for article loaded event (dispatched by StreamWisdom)
    document.addEventListener('articleLoaded', () => {
        // Show the reading assistant toggle button after a short delay
        setTimeout(() => {
            if (window.readingAssistant) {
            window.readingAssistant.showToggleButton();
            }
        }, 1000);
    }); 
}); 