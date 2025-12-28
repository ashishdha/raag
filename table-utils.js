// Generic table utilities

// State management
let currentSort = { column: null, ascending: true };
let hiddenColumns = new Set();
let currentData = [];
let currentTable = '';

// Initialize page
function initializePage(tableName) {
  currentTable = tableName;
  loadColumnVisibility();
  loadNotationPreference();
  setupMenuToggle();
  setupNotationRadios();
  setupColumnCheckboxes();
}

// Menu toggle
function setupMenuToggle() {
  const menuBtn = document.querySelector('.menu-btn');
  const menuDropdown = document.querySelector('.menu-dropdown');
  
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Position dropdown relative to button
      const rect = menuBtn.getBoundingClientRect();
      menuDropdown.style.top = `${rect.bottom + 5}px`;
      menuDropdown.style.right = `${window.innerWidth - rect.right}px`;
      
      menuDropdown.classList.toggle('active');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        menuDropdown.classList.remove('active');
      }
    });
    
    // Reposition on scroll
    window.addEventListener('scroll', () => {
      if (menuDropdown.classList.contains('active')) {
        const rect = menuBtn.getBoundingClientRect();
        menuDropdown.style.top = `${rect.bottom + 5}px`;
      }
    });
  }
}

// Load and save column visibility
function loadColumnVisibility() {
  const saved = localStorage.getItem(`${currentTable}_hiddenColumns`);
  if (saved) {
    hiddenColumns = new Set(JSON.parse(saved));
  }
}

function saveColumnVisibility() {
  localStorage.setItem(`${currentTable}_hiddenColumns`, JSON.stringify([...hiddenColumns]));
}

function toggleColumnVisibility(columnName, visible) {
  if (visible) {
    hiddenColumns.delete(columnName);
  } else {
    hiddenColumns.add(columnName);
  }
  saveColumnVisibility();
  renderTable(currentData);
}

// Setup column visibility checkboxes
function setupColumnCheckboxes() {
  const checkboxes = document.querySelectorAll('.column-toggle');
  if (!checkboxes) return;
  
  checkboxes.forEach(checkbox => {
    const column = checkbox.dataset.column;
    checkbox.checked = !hiddenColumns.has(column);
    checkbox.addEventListener('change', (e) => {
      toggleColumnVisibility(column, e.target.checked);
    });
  });
}

// Notation preference
function loadNotationPreference() {
  const notation = getCurrentNotation();
  const radio = document.querySelector(`input[name="notation"][value="${notation}"]`);
  if (radio) radio.checked = true;
}

function setupNotationRadios() {
  const radios = document.querySelectorAll('input[name="notation"]');
  if (!radios) return;
  
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setNotation(e.target.value);
      renderTable(currentData);
    });
  });
}

// Table sorting
function setupSorting(tableElement) {
  if (!tableElement) return;
  
  const headers = tableElement.querySelectorAll('th.sortable');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column;
      sortTable(column);
    });
  });
}

function sortTable(column) {
  if (currentSort.column === column) {
    currentSort.ascending = !currentSort.ascending;
  } else {
    currentSort.column = column;
    currentSort.ascending = true;
  }
  
  currentData.sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];
    
    // Handle nulls
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    // Handle arrays (compare length)
    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      aVal = aVal.length;
      bVal = bVal.length;
    }
    
    // Compare
    if (aVal < bVal) return currentSort.ascending ? -1 : 1;
    if (aVal > bVal) return currentSort.ascending ? 1 : -1;
    return 0;
  });
  
  renderTable(currentData);
  updateSortIndicators();
}

function updateSortIndicators() {
  const headers = document.querySelectorAll('th.sortable');
  if (!headers) return;
  
  headers.forEach(header => {
    header.classList.remove('sorted-asc', 'sorted-desc');
    if (header.dataset.column === currentSort.column) {
      header.classList.add(currentSort.ascending ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

// Generic table renderer
function renderTable(data) {
  currentData = data;
  const tbody = document.querySelector('tbody');
  const notation = getCurrentNotation();
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" style="text-align: center; padding: 2rem;">No results found</td></tr>';
    return;
  }
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    
    // Get all columns from the first row to maintain order
    const columns = Object.keys(data[0]);
    
    columns.forEach(column => {
      if (hiddenColumns.has(column)) return;
      
      const td = document.createElement('td');
      let value = row[column];
      
      // Format based on data type
      if (value === null || value === undefined) {
        td.textContent = '-';
      } else if (Array.isArray(value)) {
        // Check if it's a svar array (numbers) or other array
        if (value.length > 0 && typeof value[0] === 'number') {
          td.textContent = convertSvarArray(value, notation);
        } else {
          td.textContent = JSON.stringify(value);
        }
      } else if (typeof value === 'object') {
        td.textContent = JSON.stringify(value);
      } else {
        td.textContent = value;
      }
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  // Update column headers visibility
  updateHeaderVisibility();
  updateSortIndicators();
}

function updateHeaderVisibility() {
  const headers = document.querySelectorAll('th');
  if (!headers) return;
  
  headers.forEach(header => {
    const column = header.dataset.column;
    if (column && hiddenColumns.has(column)) {
      header.classList.add('hidden-column');
    } else {
      header.classList.remove('hidden-column');
    }
  });
}

// Loading state
function showLoading() {
  const tbody = document.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="20" style="text-align: center; padding: 2rem;">Loading data...</td></tr>';
  }
}

function showError(message) {
  const main = document.querySelector('main');
  if (!main) return;
  
  // Remove any existing error messages
  const existingError = main.querySelector('.error');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = `Error: ${message}`;
  main.insertBefore(errorDiv, main.firstChild);
}

// Active nav link
function setActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'raags.html';
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
});

// Export functions to window
window.initializePage = initializePage;
window.renderTable = renderTable;
window.setupSorting = setupSorting;
window.showLoading = showLoading;
window.showError = showError;