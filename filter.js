/**
 * Kilr Filter Script
 * Version: 1.4.0
 * Last updated: 2024-03-19
 */

// Initialize all filter containers that aren't search containers
document.addEventListener('DOMContentLoaded', () => {
    const filterContainers = document.querySelectorAll('[kilr-filter="container"]:not([kilr-search="container"])');
    filterContainers.forEach(container => {
        initializeFilter(container);
    });
});

// Also initialize when products are loaded (for search integration)
document.addEventListener('kilrProductsLoaded', (event) => {
    // Get the container that matches the event detail
    if (event.detail?.containerSelector) {
        const container = document.querySelector(event.detail.containerSelector);
        if (container) {
            initializeFilter(container);
        }
    }
});

function initializeFilter(container) {
    // Get all required elements
    const filterInput = container.querySelector('[kilr-filter="input"]');
    const isSearchContainer = container.hasAttribute('kilr-search');
    const isButtonFilter = isSearchContainer ? container.getAttribute('data-filters') === 'true' : true; // Always enable button filtering for standalone
    const loadMoreBtn = container.querySelector('[kilr-filter="loadmore"]');
    const itemsList = container.querySelector('[kilr-filter="items-list"], [kilr-search="results-list"]');
    const totalElement = container.querySelector('[kilr-filter="total"]');
    const buttonLists = container.querySelectorAll('[kilr-filter="buttons"]');
    
    // Store active filters per button list
    const activeFiltersByList = new Map();
    
    if (!container || !itemsList) {
        console.error('Missing required elements');
        return;
    }

    // Get the show amount from the container
    const showAmount = parseInt(container.getAttribute('data-show')) || 6;
    let currentlyShown = showAmount;

    // Initialize button filters
    if (buttonLists) {
        buttonLists.forEach((buttonList, listIndex) => {
            const buttonType = buttonList.getAttribute('data-button-type') || 'checkbox';
            const buttons = buttonList.querySelectorAll('[kilr-filter="button"]');
            
            // Initialize the Map entry for this button list
            activeFiltersByList.set(buttonList, new Set());
            
            // Activate first button for radio types
            if (buttonType === 'radio' && buttons.length > 0) {
                const firstButton = buttons[0];
                const textElement = firstButton.querySelector('.w-text');
                const filterValue = textElement ? textElement.textContent.trim().toLowerCase() : '';
                activeFiltersByList.get(buttonList).add(filterValue);
                firstButton.classList.add('is-active');
            }

            buttons.forEach((button) => {
                button.addEventListener('click', () => {
                    const textElement = button.querySelector('.w-text');
                    const filterValue = textElement ? textElement.textContent.trim().toLowerCase() : '';
                    const activeFilters = activeFiltersByList.get(buttonList);
                    
                    if (buttonType === 'radio') {
                        // For radio, deselect all buttons in THIS list only
                        buttons.forEach(btn => {
                            btn.classList.remove('is-active');
                        });
                        activeFilters.clear();
                        // Select clicked button
                        button.classList.add('is-active');
                        activeFilters.add(filterValue);
                    } else {
                        // For checkbox, toggle this button
                        if (button.classList.contains('is-active')) {
                            button.classList.remove('is-active');
                            activeFilters.delete(filterValue);
                        } else {
                            button.classList.add('is-active');
                            activeFilters.add(filterValue);
                        }
                    }
                    
                    filterItems(filterInput ? filterInput.value.trim() : '');
                });
            });
        });
    }

    // Function to update total count
    const updateTotalCount = (count) => {
        if (totalElement) {
            totalElement.textContent = count.toString();
        }
    };

    // Function to check if an item matches search terms and get its score
    const getSearchScore = (item, searchTerm) => {
        if (!searchTerm) return { matches: true, score: 0 };

        const searchWords = searchTerm.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
            .split(/\s+/)
            .filter(word => word.length > 0);

        if (searchWords.length === 0) return { matches: true, score: 0 };

        const searchableElements = item.querySelectorAll('[data-filter-type="all"], [data-filter-type="input"]');
        let matchedWords = new Set();
        let exactMatches = 0;

        // Check each searchable element
        searchableElements.forEach(element => {
            if (element.style.display === 'none') return;

            // Get element content and clean it
            const content = element.textContent.toLowerCase()
                .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
                .split(/\s+/)
                .filter(word => word.length > 0);

            // Check each search word against the content
            searchWords.forEach(searchWord => {
                // Check for exact word match
                if (content.some(word => word === searchWord)) {
                    matchedWords.add(searchWord);
                    exactMatches++;
                }
                // Check for partial word match if no exact match
                else if (content.some(word => word.includes(searchWord) || searchWord.includes(word))) {
                    matchedWords.add(searchWord);
                }
            });
        });

        // Calculate score:
        // - Number of matched search words (primary factor)
        // - Exact matches bonus (secondary factor)
        const score = (matchedWords.size * 1000) + exactMatches;
        
        return {
            matches: matchedWords.size > 0,
            score: score,
            matchCount: matchedWords.size,
            totalSearchWords: searchWords.length,
            hasAllWords: matchedWords.size === searchWords.length
        };
    };

    // Function to check if an item matches button filters
    const matchesButtonFilters = (item) => {
        // If no active filters in any list, return true
        const hasAnyActiveFilters = Array.from(activeFiltersByList.values())
            .some(filters => filters.size > 0);
            
        if (!hasAnyActiveFilters) return true;

        const filterableElements = item.querySelectorAll('[data-filter-type="all"], [data-filter-type="button"]');
        
        // Check each button list separately
        return Array.from(activeFiltersByList.entries()).every(([buttonList, activeFilters]) => {
            // If this list has no active filters, it's a match
            if (activeFilters.size === 0) return true;
            
            // For this list's active filters, ANY must match (OR logic)
            return Array.from(activeFilters).some(filterValue => {
                return Array.from(filterableElements).some(element => {
                    let content = element.textContent.trim().toLowerCase();
                    
                    // Special handling for tags
                    if (element.hasAttribute('kilr-search') && 
                        element.getAttribute('kilr-search') === 'tags') {
                        // Get tags from data attribute
                        const tags = element.getAttribute('data-tags')?.split(',') || [];
                        return tags.some(tag => tag.toLowerCase() === filterValue);
                    }
                    
                    return content === filterValue;
                });
            });
        });
    };

    // Function to filter and sort items
    const filterItems = (searchTerm) => {
        // Get all filter items, excluding the template
        const filterItems = Array.from(itemsList.children).filter(item => 
            !item.hasAttribute('kilr-search="product-template"') && 
            !item.hasAttribute('kilr-search="view-all"')
        );
            
        // Create an array to hold items and their match status
        const itemsWithStatus = filterItems.map(item => {
            const searchScore = getSearchScore(item, searchTerm);
            const matchesFilters = matchesButtonFilters(item);
            
            return {
                element: item,
                searchScore,
                matchesFilters,
                shouldShow: searchTerm ? searchScore.matches : matchesFilters
            };
        });

        // Sort items:
        // 1. Items matching all search terms first
        // 2. Then by number of matched terms
        // 3. Then by exact match count
        // 4. Filter matches as tiebreaker
        itemsWithStatus.sort((a, b) => {
            if (searchTerm) {
                // First prioritize items matching all search terms
                if (a.searchScore.hasAllWords && !b.searchScore.hasAllWords) return -1;
                if (!a.searchScore.hasAllWords && b.searchScore.hasAllWords) return 1;
                
                // Then compare scores (includes both match count and exact matches)
                if (a.searchScore.score !== b.searchScore.score) {
                    return b.searchScore.score - a.searchScore.score;
                }
                
                // Use filter matches as tiebreaker
                if (a.matchesFilters && !b.matchesFilters) return -1;
                if (!a.matchesFilters && b.matchesFilters) return 1;
            }
            return 0;
        });

        let matchedItems = 0;
        let totalMatches = 0;

        // Apply visibility based on sorted order
        itemsWithStatus.forEach(item => {
            if (item.shouldShow) {
                totalMatches++;
                if (totalMatches <= currentlyShown) {
                    item.element.classList.remove('is-hidden');
                    item.element.classList.add('is-active');
                    matchedItems++;
                } else {
                    item.element.classList.add('is-hidden');
                    item.element.classList.remove('is-active');
                }
            } else {
                item.element.classList.add('is-hidden');
                item.element.classList.remove('is-active');
            }
        });

        // Update the total count
        updateTotalCount(totalMatches);

        // Show/hide load more button based on whether there are more items to show
        if (loadMoreBtn) {
            if (totalMatches > currentlyShown) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    };

    // Add input event listener if input exists
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            currentlyShown = showAmount; // Reset to initial display amount when filtering
            const searchTerm = e.target.value.trim();
            filterItems(searchTerm);
        });
    }

    // Add load more functionality
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentlyShown += showAmount;
            filterItems(filterInput ? filterInput.value.trim() : '');
        });
    }

    // Initial filter
    filterItems(filterInput ? filterInput.value.trim() : '');
}

