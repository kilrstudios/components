// Version 1.4.5
(() => {
  // Variable to keep track of the currently active dropdown
  let kilrActiveDropdown = null;

  // Function to handle delay for adding class
  const handleDelay = (element, className, delay) => {
    if (element) {
      setTimeout(() => {
        element.classList.add(className);
      }, delay);
    }
  };

  // Function to handle hidden attribute for direct children
  const handleHiddenForChildren = (parentElement, isActive) => {
    if (!parentElement) return;
    const hiddenElements = Array.from(parentElement.children).filter(child => child.hasAttribute('kilr-nav-hidden'));
    hiddenElements.forEach(el => handleHidden(el, isActive));
  };

  // Function to handle hidden attribute
  const handleHidden = (element, isActive) => {
    if (!element) return;
    const delay = element.getAttribute('kilr-nav-hidden');
    if (isActive) {
      element.classList.remove('is-hidden');
    } else if (delay) {
      setTimeout(() => {
        element.classList.add('is-hidden');
      }, delay);
    } else {
      element.classList.add('is-hidden');
    }
  };

  // Function to initialize the first sub-dropdown based on sub_dropdown_type and window width
  const initializeFirstSubDropdown = (parentDropdown) => {
    if (!parentDropdown) return;
    const breakpointElement = document.querySelector('[kilr-nav-hamburger-breakpoint]');
    if (!breakpointElement) return;

    const breakpoint = parseInt(breakpointElement.getAttribute('kilr-nav-hamburger-breakpoint'), 10);
    if (window.innerWidth > breakpoint) {
      const subDropdownType = parentDropdown.getAttribute('sub-dropdown-type');
      const subDropdowns = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
      subDropdowns.forEach((subDropdown) => subDropdown.classList.remove('is-active'));

      if (subDropdownType === 'type1') {
        const firstSubDropdown = subDropdowns[0];
        if (firstSubDropdown) {
          firstSubDropdown.classList.add('is-active');
          handleHiddenForChildren(firstSubDropdown, true);
        }
      }
    }
  };

  // Function to close active dropdown
  const closeActiveDropdown = () => {
    if (kilrActiveDropdown) {
      kilrActiveDropdown.classList.remove('is-active');
      handleHiddenForChildren(kilrActiveDropdown, false);
      kilrActiveDropdown = null;
    }
  };
  
  // Function to handle inputs inside dropdown triggers
  const setupInputsInDropdownTriggers = () => {
    // Find all dropdown triggers
    const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
    console.log('Nav: Found dropdown triggers:', dropdownTriggers.length);
    
    dropdownTriggers.forEach(trigger => {
      // Find any inputs inside the trigger (search inputs, text inputs, etc.)
      const inputs = trigger.querySelectorAll('input');
      
      if (inputs.length === 0) return; // Skip if no inputs inside this trigger
      
      // Find the parent dropdown
      const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
      if (!parentDropdown) return; // Skip if not inside a dropdown
      
      console.log('Nav: Found trigger with inputs:', trigger);
      
      // Set up each input inside this trigger
      inputs.forEach(input => {
        console.log('Nav: Setting up input in dropdown trigger:', input);
        
        // Focus handler - activate dropdown
        input.addEventListener('focus', (e) => {
          console.log('Nav: Input in dropdown trigger focused');
          
          // Activate the dropdown
          parentDropdown.classList.add('is-active');
          kilrActiveDropdown = parentDropdown;
          
          // Handle hidden elements
          handleHiddenForChildren(parentDropdown, true);
          
          // Initialize first sub-dropdown if needed
          initializeFirstSubDropdown(parentDropdown);
        });
        
        // Blur handler - check if focus is still within the dropdown
        input.addEventListener('blur', (event) => {
          console.log('Nav: Input in dropdown trigger blurred');
          
          // Add a small delay to check where focus moved
          setTimeout(() => {
            // Check if focus moved within the dropdown
            if (parentDropdown.contains(document.activeElement)) {
              console.log('Nav: Focus still in dropdown, keeping active');
              return;
            }
            
            // Check if we clicked somewhere inside the dropdown
            if (event.relatedTarget && parentDropdown.contains(event.relatedTarget)) {
              console.log('Nav: Clicked inside dropdown, keeping active');
              return;
            }
            
            // Only close if this dropdown is the active one
            if (parentDropdown === kilrActiveDropdown) {
              console.log('Nav: Focus left dropdown, deactivating');
              closeActiveDropdown();
            }
          }, 50);
        });
        
        // Prevent trigger click from toggling dropdown when interacting with the input
        input.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
        // Prevent input mousedown events from bubbling to avoid dropdown state issues
        input.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const breakpointElement = document.querySelector('[kilr-nav-hamburger-breakpoint]');
    const breakpoint = breakpointElement
      ? parseInt(breakpointElement.getAttribute('kilr-nav-hamburger-breakpoint'), 10)
      : 0;

    const navContainer = document.querySelector('[kilr-nav="nav"]');
    const isHoverEnabled = navContainer && navContainer.getAttribute('drop-down') === 'hover';

    // Initialize first sub-dropdowns if they exist
    const dropdowns = document.querySelectorAll('[kilr-nav="dropdown"]');
    if (dropdowns.length > 0) {
      dropdowns.forEach((dropdown) => initializeFirstSubDropdown(dropdown));
    }
    
    // Set up inputs in dropdown triggers
    setupInputsInDropdownTriggers();

    if (isHoverEnabled && dropdowns.length > 0) {
      const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
      dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('mouseenter', () => {
          const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
          if (!parentDropdown) return;

          parentDropdown.classList.add('is-active');
          initializeFirstSubDropdown(parentDropdown);
          kilrActiveDropdown = parentDropdown;
          handleHiddenForChildren(parentDropdown, true);
        });
      });

      dropdowns.forEach(dropdown => {
        dropdown.addEventListener('mouseleave', () => {
          setTimeout(() => {
            if (!dropdown.contains(document.querySelector(':hover'))) {
              dropdown.classList.remove('is-active');
              kilrActiveDropdown = null;
              handleHiddenForChildren(dropdown, false);
            }
          }, 10);
        });
      });
    }

    // Add click outside handler
    document.addEventListener('click', (event) => {
      if (kilrActiveDropdown && !event.target.closest('[kilr-nav="dropdown"]')) {
        closeActiveDropdown();
      }
    });

    const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
    dropdownTriggers.forEach(trigger => {
      trigger.addEventListener('click', (event) => {
        // Prevent the click from bubbling to document
        event.stopPropagation();
        
        const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
        if (!parentDropdown) return;

        const isActive = parentDropdown.classList.contains('is-active');
        if (window.innerWidth <= breakpoint) {
          const subDropdowns = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
          subDropdowns.forEach(subDropdown => subDropdown.classList.remove('is-active'));

          const subHeader = parentDropdown.querySelector('[kilr-nav="sub-header"]');
          if (subHeader) subHeader.classList.add('is-hidden');
        }

        if (kilrActiveDropdown && kilrActiveDropdown !== parentDropdown) {
          kilrActiveDropdown.classList.remove('is-active');
          handleHiddenForChildren(kilrActiveDropdown, false);
        }
        if (!isActive) {
          handleDelay(parentDropdown, 'is-active', 10);
          kilrActiveDropdown = parentDropdown;
          handleHiddenForChildren(parentDropdown, true);
        } else {
          parentDropdown.classList.remove('is-active');
          kilrActiveDropdown = null;
          handleHiddenForChildren(parentDropdown, false);
        }
        initializeFirstSubDropdown(parentDropdown);
      });
    });

    const subDropdownTriggers = document.querySelectorAll('[kilr-nav="sub-dropdown-trigger"]');
    subDropdownTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const parentSubDropdown = trigger.closest('[kilr-nav="sub-dropdown"]');
        if (!parentSubDropdown) return;

        const isActive = parentSubDropdown.classList.contains('is-active');
        const siblingSubDropdowns = parentSubDropdown.parentElement.querySelectorAll('[kilr-nav="sub-dropdown"]');
        siblingSubDropdowns.forEach(el => {
          if (el !== parentSubDropdown) {
            el.classList.remove('is-active');
            handleHiddenForChildren(el, false);
          }
        });

        if (!isActive) {
          handleDelay(parentSubDropdown, 'is-active', 50);
          handleHiddenForChildren(parentSubDropdown, true);
        } else {
          parentSubDropdown.classList.remove('is-active');
          handleHiddenForChildren(parentSubDropdown, false);
        }

        const parentDropdown = parentSubDropdown.closest('[kilr-nav="dropdown"]');
        const subHeader = parentDropdown && parentDropdown.querySelector('[kilr-nav="sub-header"]');
        if (subHeader) {
          const subLabel = parentSubDropdown.querySelector('[kilr-nav="sub-label"]');
          if (subLabel) subHeader.textContent = subLabel.textContent;
          subHeader.classList.remove('is-hidden');
        }
      });
    });

    const subHeaders = document.querySelectorAll('[kilr-nav="sub-header"]');
    subHeaders.forEach(subHeader => {
      subHeader.addEventListener('click', () => {
        const parentDropdown = subHeader.closest('[kilr-nav="dropdown"]');
        if (!parentDropdown) return;

        const subDropdownsToClear = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
        subDropdownsToClear.forEach(el => el.classList.remove('is-active'));
        subHeader.classList.add('is-hidden');
      });
    });

    const hamburger = document.querySelector('[kilr-nav="hamburger"]');
    const menu = document.querySelector('[kilr-nav="menu"]');
    const nav = document.querySelector('[kilr-nav="nav"]');

    if (hamburger && menu && nav) {
      hamburger.addEventListener('click', () => {
        const isHamburgerActive = hamburger.classList.contains('is-active');
        hamburger.classList.toggle('is-active', !isHamburgerActive);
        menu.classList.toggle('is-active', !isHamburgerActive);
        nav.classList.toggle('is-active', !isHamburgerActive);
        // Toggle body scroll prevention
        document.body.classList.toggle('kilr-nav-no-scroll', !isHamburgerActive);
      });
    }
  });
})();
