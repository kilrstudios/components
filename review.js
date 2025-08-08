// Review component to handle kilr-review elements
document.addEventListener('DOMContentLoaded', () => {
    // Find all review cards
    const reviewCards = document.querySelectorAll('[kilr-review="card"]');

    reviewCards.forEach(card => {
        const userElement = card.querySelector('[kilr-review="user"]');
        const iconTextElement = card.querySelector('[kilr-review="icon-text"]');

        if (userElement && iconTextElement) {
            // Get the user name and create initials
            const userName = userElement.textContent.trim();
            const initials = userName
                .split(/\s+/) // Split by any whitespace
                .map(word => word.charAt(0).toUpperCase()) // Get first letter of each word
                .join(''); // Join the letters together

            // Update the icon text with the initials
            iconTextElement.textContent = initials;
        }
    });
});
