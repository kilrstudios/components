//version 1.3.4

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed.");

  // Global variable to store active filter selections.
  let activeFilterValues = new Set();

  // Check URL for a filter parameter on load.
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get("filter");
  if (urlFilter) {
    urlFilter.split(",").forEach((val) => {
      if (val.trim()) {
        activeFilterValues.add(val.trim());
      }
    });
    console.log("Filters from URL applied:", Array.from(activeFilterValues));
  }

  // Global variable to store the full filter options from the complete product list.
  let fullFilterOptions = null;

  // Helper function to update the URL query string with the active filters.
  function updateURLFilter() {
    const url = new URL(window.location);
    if (activeFilterValues.size === 0) {
      url.searchParams.delete("filter");
    } else {
      const filters = Array.from(activeFilterValues).join(",");
      url.searchParams.set("filter", filters);
    }
    window.history.pushState({}, "", url);
  }

  // Mark nav-step-1 as active on load.
  const navStep1 = document.querySelector('[kilr-quick-search="nav-step-1"]');
  if (navStep1) {
    navStep1.classList.add("is-active");
    console.log("Nav-step-1 marked as active on load.");
  } else {
    console.error("Nav-step-1 element not found.");
  }

  // The endpoint for our Cloudflare worker.
  const workerEndpoint = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";
  console.log("Worker endpoint set to:", workerEndpoint);

  // The loader element.
  const loader = document.querySelector('[kilr-quick-search="loader"]');
  if (!loader) {
    console.error("Loader element not found. Check your HTML for [kilr-quick-search='loader']");
  } else {
    console.log("Loader element found:", loader);
  }

  // Grab the wrapping containers for each step.
  const step1Container = document.querySelector('[kilr-quick-search="options-step-1"]');
  const step2Container = document.querySelector('[kilr-quick-search="options-step-2"]');
  const step3Container = document.querySelector('[kilr-quick-search="options-step-3"]');
  if (!step1Container || !step2Container || !step3Container) {
    console.error("One or more required containers (options-step-1, options-step-2, options-step-3) not found. Stopping function.");
    return;
  }

  // Ensure options-step-1 is active on load.
  step1Container.classList.add("is-active");
  console.log("Options-step-1 marked as active on load.");

  // Create (or get) a dedicated container for product options inside Step 3.
  let productsContainer = step3Container.querySelector('[kilr-quick-search="step-3-options-container"]');
  if (!productsContainer) {
    productsContainer = document.createElement("div");
    productsContainer.setAttribute("kilr-quick-search", "step-3-options-container");
    step3Container.appendChild(productsContainer);
  }

  // Clone and remove the step-2 template.
  let step2Template = document.querySelector('[kilr-quick-search="option-step-2-template"]');
  if (step2Template) {
    step2Template = step2Template.cloneNode(true);
    step2Template.removeAttribute("kilr-quick-search");
    console.log("Step 2 template cloned for later use.");
    document.querySelector('[kilr-quick-search="option-step-2-template"]').remove();
    console.log("Original Step 2 template removed from DOM.");
  } else {
    console.error("Step 2 template not found on page load.");
  }

  // Clone the step-3 template and store the tag template.
  let step3Template = document.querySelector('[kilr-quick-search="option-step-3-template"]');
  let storedTagTemplate = null;
  if (step3Template) {
    step3Template = step3Template.cloneNode(true);
    storedTagTemplate = step3Template.querySelector('[data-option-3="tag-template"]');
    if (storedTagTemplate) {
      console.log("Stored tag template found:", storedTagTemplate);
    } else {
      console.error("Tag template not found inside step-3 template.");
    }
    step3Template.removeAttribute("kilr-quick-search");
    document.querySelector('[kilr-quick-search="option-step-3-template"]').remove();
    console.log("Original Step 3 template removed from DOM.");
  } else {
    console.warn("Step 3 template not found on page load. Ensure it exists if you need it.");
  }

  // Get the filters container and clone the filter template.
  const filterContainer = step3Container.querySelector('[kilr-quick-search="filters"]');
  let filterTemplate = filterContainer ? filterContainer.querySelector('[kilr-quick-search="filter-template"]') : null;
  if (filterTemplate) {
    filterTemplate = filterTemplate.cloneNode(true);
    console.log("Filter template cloned for use.");
    filterContainer.querySelector('[kilr-quick-search="filter-template"]').remove();
  } else {
    console.error("Filter template not found in the filters container.");
  }

  // Global variables for product data and pagination.
  let quickSearchProducts = [];
  // Set the initial visible count from the load more button's data attribute (or default to 20)
  let visibleCount = 20;
  const loadMoreEl = step3Container.querySelector('[kilr-quick-search="load-more"]');
  if (loadMoreEl) {
    const initialDisplay = parseInt(loadMoreEl.getAttribute("data-display-number"), 10);
    if (!isNaN(initialDisplay)) {
      visibleCount = initialDisplay;
    }
  }

  /**
   * Helper function to call the worker.
   */
  async function callWorker(query, variables = {}) {
    console.log("Calling worker with query:", query);
    console.log("Variables:", variables);
    const payload = { storeFrontQuery: query, variables };
    try {
      const response = await fetch(workerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("Worker response received with status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Worker error response:", errorText);
        throw new Error(`Worker Error: ${errorText}`);
      }
      const json = await response.json();
      console.log("Worker response JSON:", json);
      return json.responseData;
    } catch (err) {
      console.error("Error calling worker:", err);
      throw err;
    }
  }

  /**
   * Resets selections and clears options from a given step onward.
   * Also resets the filter list.
   */
  function resetSteps(fromStep) {
    console.log("Resetting steps from step:", fromStep);
    if (fromStep <= 2) {
      const step2Nav = document.querySelector('[kilr-quick-search="nav-step-2"]');
      if (step2Nav) {
        step2Nav.classList.remove("is-selected", "is-active");
        console.log("Nav-step-2 reset (removed is-selected and is-active).");
      }
      const step2NavSelected = document.querySelector('[kilr-quick-search="nav-step-2-selected"]');
      if (step2NavSelected) {
        step2NavSelected.innerText = "";
        console.log("Nav-step-2 text cleared.");
      }
      step2Container.classList.remove("is-active");
      step2Container.innerHTML = "";
      console.log("Options-step-2 container cleared and deactivated.");
    }
    if (fromStep <= 3) {
      const step3Nav = document.querySelector('[kilr-quick-search="nav-step-3"]');
      if (step3Nav) {
        step3Nav.classList.remove("is-selected", "is-active");
        console.log("Nav-step-3 reset (removed is-selected and is-active).");
      }
      const step3NavSelected = document.querySelector('[kilr-quick-search="nav-step-3-selected"]');
      if (step3NavSelected) {
        step3NavSelected.innerText = "";
        console.log("Nav-step-3 text cleared.");
      }
      // Clear only the products container.
      productsContainer.innerHTML = "";
      console.log("Product options container cleared.");
      // Reset product data, visible count, active filters, and the full filter options.
      quickSearchProducts = [];
      visibleCount = 20;
      if (loadMoreEl) {
        const initialDisplay = parseInt(loadMoreEl.getAttribute("data-display-number"), 10);
        if (!isNaN(initialDisplay)) {
          visibleCount = initialDisplay;
        }
      }
      activeFilterValues.clear();
      fullFilterOptions = null;
      updateURLFilter();
    }
  }

  /**
   * Fetches all products for a given collection using pagination.
   */
  async function fetchAllProducts(collectionId) {
    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;
    const prodQuery = `
      query getProducts($id: ID!, $cursor: String) {
        collection(id: $id) {
          products(first: 50, after: $cursor) {
            edges {
              cursor
              node {
                id
                title
                description
                handle
                featuredImage {
                  url
                }
                tags
                productType
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    `;
    while (hasNextPage) {
      const variables = { id: collectionId, cursor };
      try {
        const data = await callWorker(prodQuery, variables);
        const productsData = data?.data?.collection?.products;
        if (!productsData) break;
        const edges = productsData.edges || [];
        edges.forEach((edge) => {
          allProducts.push(edge.node);
        });
        hasNextPage = productsData.pageInfo.hasNextPage;
        if (edges.length > 0) {
          cursor = edges[edges.length - 1].cursor;
        } else {
          hasNextPage = false;
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        break;
      }
    }
    return allProducts;
  }

  /**
   * Filters products based on the active filters stored in activeFilterValues.
   * Updated to filter using productType instead of tags.
   */
  function filterProducts(products) {
    if (activeFilterValues.size === 0) return products;
    return products.filter((product) => {
      if (!product.productType || !product.productType.trim()) return false;
      return activeFilterValues.has(product.productType.trim());
    });
  }

  /**
   * Sorts products based on the selected sort option and order.
   */
  function sortProducts(products) {
    const sortSelect = document.querySelector('[kilr-quick-search="sort-options"]');
    const sortOrderCheckbox = document.querySelector('[kilr-quick-search="sorting"] input[type="checkbox"]');
    if (!sortSelect) return products;
    const sortKey = sortSelect.value;
    const ascending = sortOrderCheckbox ? sortOrderCheckbox.checked : true;
    return products.slice().sort((a, b) => {
      let aVal, bVal;
      if (sortKey === "price") {
        aVal = parseFloat(a.priceRange?.minVariantPrice?.amount || 0);
        bVal = parseFloat(b.priceRange?.minVariantPrice?.amount || 0);
      } else {
        aVal = a[sortKey] || "";
        bVal = b[sortKey] || "";
      }
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }

  /**
   * Populates the sort select element automatically based on product data.
   * Each option is created with the structure:
   * <option label="Option A" value="a" class="w-option"></option>
   * This version saves and then restores the current selection.
   */
  function populateSortOptions() {
    const sortSelect = document.querySelector('[kilr-quick-search="sort-options"]');
    if (!sortSelect || quickSearchProducts.length === 0) return;

    // Save the current selection.
    const currentSelection = sortSelect.value;

    // Clear existing options.
    sortSelect.innerHTML = "";

    const keys = new Set();
    quickSearchProducts.forEach((product) => {
      if (product.title) keys.add("title");
      if (product.description) keys.add("description");
      if (product.priceRange && product.priceRange.minVariantPrice)
        keys.add("price");
    });
    keys.forEach((key) => {
      if (key === "") return;
      const optionEl = document.createElement("option");
      optionEl.value = key;
      optionEl.setAttribute("label", key.charAt(0).toUpperCase() + key.slice(1));
      optionEl.classList.add("w-option");
      sortSelect.appendChild(optionEl);
    });
    // Restore previous selection if it exists in the new options.
    if (currentSelection && Array.from(keys).includes(currentSelection)) {
      sortSelect.value = currentSelection;
    }
  }

  /**
   * Renders the products in Stage 3 based on pagination, filtering, and sorting.
   * Also generates filter options based on the full product list (quickSearchProducts).
   * The filters container should have a data attribute (e.g., data-filter-option="productType")
   * that tells us which product field to use for generating the filter list.
   */
  function renderProducts() {
    // Ensure the Step 3 container is active.
    step3Container.classList.add("is-active");
    // Also hide the Step 2 container.
    step2Container.classList.remove("is-active");

    // Get filtered and sorted products (based on activeFilterValues).
    let products = quickSearchProducts;
    products = filterProducts(products);
    products = sortProducts(products);

    // Update product count displays.
    const totalCountEl = document.querySelector('[kilr-quick-search="product-totals"]');
    const visibleCountEl = document.querySelector('[kilr-quick-search="products-visible"]');
    if (totalCountEl) {
      totalCountEl.innerText = products.length;
    }
    if (visibleCountEl) {
      visibleCountEl.innerText = Math.min(visibleCount, products.length);
    }

    // Clear only the products container.
    productsContainer.innerHTML = "";

    // Render products up to the current visibleCount.
    const productsToShow = products.slice(0, visibleCount);
    productsToShow.forEach((product) => {
      if (!step3Template) {
        console.error("Step 3 template is not available.");
        return;
      }
      const clone = step3Template.cloneNode(true);
      clone.setAttribute("kilr-quick-search", "option-3");
      // Set title.
      const titleEl = clone.querySelector('[data-option-3="title"]');
      if (titleEl) {
        titleEl.innerText = product.title || "";
      }
      // Set description.
      const descEl = clone.querySelector('[data-option-3="description"]');
      if (descEl) {
        descEl.innerText = product.description || "";
      }
      // Set image.
      const imgEl = clone.querySelector('[data-option-3="image"]');
      if (imgEl && product.featuredImage) {
        imgEl.src = product.featuredImage.url || "";
      }
      // Set price (without currency code).
      const priceEl = clone.querySelector('[data-option-3="price"]');
      if (priceEl && product.priceRange && product.priceRange.minVariantPrice) {
        priceEl.innerText = product.priceRange.minVariantPrice.amount;
      }
      // Process product tags (if needed, this section remains if you wish to display tags).
      const tagsContainer = clone.querySelector('[data-option-3="tags"]');
      if (tagsContainer) {
        tagsContainer.innerHTML = "";
        if (product.tags && product.tags.length > 0) {
          if (!storedTagTemplate) {
            console.error("Stored tag template not found. Cannot generate tags.");
          } else {
            product.tags.forEach((tag) => {
              let tagEl = storedTagTemplate.cloneNode(true);
              tagEl.removeAttribute("data-option-3");
              tagEl.setAttribute("data-option-3", "tag");
              tagEl.innerText = tag;
              tagsContainer.appendChild(tagEl);
            });
          }
        } else {
          tagsContainer.remove();
        }
      }
      // Update the handle link.
      const linkEl = clone.querySelector('[data-option-3="handle"]');
      if (linkEl && product.handle) {
        const currentHref = linkEl.getAttribute("href") || "";
        const newHref = currentHref.replace(":slug", product.handle);
        linkEl.setAttribute("href", newHref);
      }
      // Append the product option clone to the dedicated container.
      productsContainer.appendChild(clone);
    });

    // Populate sort options based on the product data.
    populateSortOptions();

    // *** NEW FILTERS LOGIC ***
    // Generate filter options from the full product list using productType.
    // The filters container should have a data attribute (e.g., data-filter-option="productType")
    // that tells us which field to use for generating the filters.
    const filterField = filterContainer.getAttribute("data-filter-option");
    if (filterField) {
      // If fullFilterOptions has not been generated yet, generate it from the full quickSearchProducts.
      if (!fullFilterOptions) {
        let uniqueFilters = new Set();
        quickSearchProducts.forEach((product) => {
          if (product.productType && product.productType.trim()) {
            uniqueFilters.add(product.productType.trim());
          }
        });
        fullFilterOptions = Array.from(uniqueFilters);
        console.log("Full filter options generated:", fullFilterOptions);
      }
      // Clear the filters container.
      filterContainer.innerHTML = "";
      // For each filter value in the full list, create a filter element.
      fullFilterOptions.forEach((value) => {
        let filterEl = filterTemplate ? filterTemplate.cloneNode(true) : document.createElement("div");
        if (!filterTemplate) {
          filterEl.innerText = value;
          filterEl.setAttribute("kilr-quick-search", "filter");
        } else {
          filterEl.removeAttribute("kilr-quick-search");
          filterEl.setAttribute("kilr-quick-search", "filter");
          filterEl.innerText = value;
        }
        // Re-apply active state if this value is in activeFilterValues.
        if (activeFilterValues.has(value)) {
          filterEl.classList.add("is-active");
        }
        // On click, toggle active state (allowing multiple filters).
        filterEl.addEventListener("click", () => {
          if (activeFilterValues.has(value)) {
            activeFilterValues.delete(value);
          } else {
            activeFilterValues.add(value);
          }
          updateURLFilter();
          renderProducts();
        });
        filterContainer.appendChild(filterEl);
      });
    }

    // Update the load more element visibility based on the number of products.
    const loadMoreEl = step3Container.querySelector('[kilr-quick-search="load-more"]');
    if (loadMoreEl) {
      let displayNumber = parseInt(loadMoreEl.getAttribute("data-display-number"), 10);
      if (isNaN(displayNumber)) {
        displayNumber = 20;
      }
      // Only show load more if there are more products than visibleCount.
      if (products.length > visibleCount) {
        loadMoreEl.style.display = "block";
      } else {
        loadMoreEl.style.display = "none";
      }
    }
  }

  // Event listener for the "load more" button.
  const loadMoreBtn = step3Container.querySelector('[kilr-quick-search="load-more"]');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      let displayNumber = parseInt(loadMoreBtn.getAttribute("data-display-number"), 10);
      if (isNaN(displayNumber)) {
        displayNumber = 20;
      }
      visibleCount += displayNumber;
      renderProducts();
    });
  }

  // Event listeners for sorting controls.
  const sortSelectEl = document.querySelector('[kilr-quick-search="sort-options"]');
  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", renderProducts);
  }
  const sortOrderCheckbox = document.querySelector('[kilr-quick-search="sorting"] input[type="checkbox"]');
  if (sortOrderCheckbox) {
    sortOrderCheckbox.addEventListener("change", renderProducts);
  }

  /**
   * STEP 1 – Collection Selection.
   */
  const step1Options = document.querySelectorAll('[kilr-quick-search="option-1"]');
  if (!step1Options.length) {
    console.error("No Step 1 options found. Ensure you have elements with [kilr-quick-search='option-1']");
  } else {
    console.log("Found", step1Options.length, "Step 1 options.");
  }

  step1Options.forEach((option) => {
    option.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("Step 1 option clicked:", option);

      // Reset steps 2 and 3.
      resetSteps(2);
      loader.classList.add("is-loading");

      // Mark the selected Step 1 option.
      step1Options.forEach((opt) => opt.classList.remove("is-selected"));
      option.classList.add("is-selected");
      // Update navigation.
      const step1Nav = document.querySelector('[kilr-quick-search="nav-step-1"]');
      if (step1Nav) {
        step1Nav.classList.remove("is-active");
        step1Nav.classList.add("is-selected");
      }
      const step2Nav = document.querySelector('[kilr-quick-search="nav-step-2"]');
      if (step2Nav) {
        step2Nav.classList.add("is-active");
      }
      const step1NavSelected = document.querySelector('[kilr-quick-search="nav-step-1-selected"]');
      const optionTitle = option.getAttribute("data-option-1");
      if (step1NavSelected) {
        step1NavSelected.innerText = optionTitle;
      }

      // Extract collection ID and build a query to get sub-categories.
      const collectionId = option.getAttribute("data-collection-id");
      console.log("Extracted collection ID:", collectionId);
      const query = `
        query getCollection($id: ID!) {
          collection(id: $id) {
            subCategories: metafield(namespace: "custom", key: "sub_categories") {
              references(first: 10) {
                nodes {
                  ... on Collection {
                    id
                    image {
                      src
                    }
                    title
                    handle
                    description
                  }
                }
              }
            }
          }
        }
      `;
      try {
        const data = await callWorker(query, { id: collectionId });
        console.log("Data received for Step 1:", data);
        const collectionData = data?.data?.collection;
        // Process sub-categories.
        let subCategories = collectionData &&
          collectionData.subCategories &&
          collectionData.subCategories.references
            ? collectionData.subCategories.references.nodes
            : [];
        if (subCategories && subCategories.length > 0) {
          // Sub-categories exist – display Step 2 options.
          step2Container.classList.add("is-active");
          step1Container.classList.remove("is-active");
          step2Container.innerHTML = ""; // Clear previous content.
          subCategories.forEach((subCat) => {
            if (!step2Template) {
              console.error("Step 2 template is not available.");
              return;
            }
            const clone = step2Template.cloneNode(true);
            clone.querySelectorAll('[kilr-quick-search="option-2"]').forEach((el) => {
              el.removeAttribute("kilr-quick-search");
            });
            clone.setAttribute("kilr-quick-search", "option-2");
            const titleEl = clone.querySelector('[data-option-2="title"]');
            if (titleEl) {
              titleEl.innerText = subCat.title || "";
            }
            const descEl = clone.querySelector('[data-option-2="description"]');
            if (descEl) {
              descEl.textContent = subCat.description || "";
            }
            const imgEl = clone.querySelector('[data-option-2="image"]');
            if (imgEl) {
              imgEl.src = (subCat.image && subCat.image.src) || "";
            }
            clone.setAttribute("data-collection-id", subCat.id || "");
            clone.classList.add("option");
            step2Container.appendChild(clone);
          });
        } else {
          // No sub-categories: directly fetch products.
          step1Container.classList.remove("is-active");
          step2Container.classList.remove("is-active");
          step2Container.innerHTML = "";
          if (step2Nav) {
            step2Nav.classList.remove("is-active");
          }
          const step3Nav = document.querySelector('[kilr-quick-search="nav-step-3"]');
          if (step3Nav) {
            step3Nav.classList.add("is-active");
          }
          // Mark Step 3 container active.
          step3Container.classList.add("is-active");
          // Fetch all products.
          quickSearchProducts = await fetchAllProducts(collectionId);
          console.log("Fetched products:", quickSearchProducts);
          // Render the initial set of products.
          renderProducts();
        }
      } catch (err) {
        console.error("Error in Step 1 processing:", err);
      } finally {
        loader.classList.remove("is-loading");
      }
    });
  });

  /**
   * STEP 2 – Sub-category Selection.
   */
  step2Container.addEventListener("click", async (e) => {
    const option = e.target.closest('[kilr-quick-search="option-2"]');
    if (!option) return;
    e.preventDefault();
    console.log("Step 2 option clicked:", option);
    resetSteps(3);
    loader.classList.add("is-loading");
    Array.from(step2Container.querySelectorAll('[kilr-quick-search="option-2"]')).forEach((opt) => opt.classList.remove("is-selected"));
    option.classList.add("is-selected");
    const step2Nav = document.querySelector('[kilr-quick-search="nav-step-2"]');
    if (step2Nav) {
      step2Nav.classList.remove("is-active");
      step2Nav.classList.add("is-selected");
    }
    // Hide Step 2 container now that we're moving to Step 3.
    step2Container.classList.remove("is-active");
    const step3Nav = document.querySelector('[kilr-quick-search="nav-step-3"]');
    if (step3Nav) {
      step3Nav.classList.add("is-active");
    }
    const step2NavSelected = document.querySelector('[kilr-quick-search="nav-step-2-selected"]');
    const title = option.querySelector('[data-option-2="title"]')?.innerText || "";
    if (step2NavSelected) {
      step2NavSelected.innerText = title;
    }
    const collectionId = option.getAttribute("data-collection-id");
    console.log("Step 2 collection ID:", collectionId);
    // Fetch products for the selected sub-category.
    quickSearchProducts = await fetchAllProducts(collectionId);
    console.log("Fetched products for Step 2:", quickSearchProducts);
    // Ensure the Step 3 container is active.
    step3Container.classList.add("is-active");
    renderProducts();
    loader.classList.remove("is-loading");
  });

  /**
   * STEP 3 – Product Selection.
   * Clicking a product option marks it as selected.
   */
  step3Container.addEventListener("click", (e) => {
    // If the click is on a handle link, allow navigation.
    const linkClicked = e.target.closest('[data-option-3="handle"]');
    if (linkClicked) {
      console.log("Handle link clicked; navigating to:", linkClicked.getAttribute("href"));
      return;
    }
    const option = e.target.closest('[kilr-quick-search="option-3"]');
    if (!option) return;
    e.preventDefault();
    console.log("Step 3 option clicked:", option);
    Array.from(step3Container.querySelectorAll('[kilr-quick-search="option-3"]')).forEach((opt) => opt.classList.remove("is-selected"));
    option.classList.add("is-selected");
    const step3Nav = document.querySelector('[kilr-quick-search="nav-step-3"]');
    if (step3Nav) {
      step3Nav.classList.remove("is-active");
      step3Nav.classList.add("is-selected");
    }
    const step3NavSelected = document.querySelector('[kilr-quick-search="nav-step-3-selected"]');
    const title = option.querySelector('[data-option-3="title"]')?.innerText || "";
    if (step3NavSelected) {
      step3NavSelected.innerText = title;
    }
  });

  /**
   * Navigation Clicks: Allow user to click on nav elements to reset later steps.
   */
  const navElements = document.querySelectorAll('[kilr-quick-search^="nav-step-"]');
  if (!navElements.length) {
    console.error("No navigation elements found. Check your HTML for [kilr-quick-search='nav-step-X'] attributes.");
  } else {
    console.log("Found navigation elements:", navElements);
  }
  navElements.forEach((nav) => {
    nav.addEventListener("click", (e) => {
      e.preventDefault();
      const navAttr = nav.getAttribute("kilr-quick-search");
      console.log("Navigation element clicked:", navAttr);
      const parts = navAttr.split("-");
      if (parts.length < 3) return;
      const stepNumber = parseInt(parts[2]);
      console.log("Navigation step number parsed as:", stepNumber);
      // Reset steps after the clicked one.
      resetSteps(stepNumber + 1);
      document.querySelectorAll('[kilr-quick-search^="nav-step-"]').forEach((n) => n.classList.remove("is-active"));
      step1Container.classList.remove("is-active");
      step2Container.classList.remove("is-active");
      step3Container.classList.remove("is-active");
      if (stepNumber === 1) {
        step1Container.classList.add("is-active");
        const nav1 = document.querySelector('[kilr-quick-search="nav-step-1"]');
        if (nav1) {
          nav1.classList.add("is-active");
        }
      } else if (stepNumber === 2) {
        step2Container.classList.add("is-active");
        const nav2 = document.querySelector('[kilr-quick-search="nav-step-2"]');
        if (nav2) {
          nav2.classList.add("is-active");
        }
      } else if (stepNumber === 3) {
        step3Container.classList.add("is-active");
        const nav3 = document.querySelector('[kilr-quick-search="nav-step-3"]');
        if (nav3) {
          nav3.classList.add("is-active");
        }
      }
    });
  });
});
