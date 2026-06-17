// Global State
let allUpdates = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedUpdate = null;

// DOM Elements
const elements = {
    html: document.documentElement,
    btnRefresh: document.getElementById('btn-refresh'),
    refreshIcon: document.getElementById('refresh-icon'),
    btnThemeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    lastUpdatedText: document.getElementById('last-updated'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterTabs: document.getElementById('filter-tabs'),
    updatesGrid: document.getElementById('updates-grid'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    btnRetry: document.getElementById('btn-retry'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statChanges: document.getElementById('stat-changes'),
    statBreaking: document.getElementById('stat-breaking'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    modalClose: document.getElementById('modal-close'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCountNum: document.getElementById('char-count-num'),
    charProgressRing: document.getElementById('char-progress-ring'),
    btnPostTwitter: document.getElementById('btn-post-twitter'),
    tweetPreviewText: document.getElementById('tweet-preview-text'),
    tweetLinkCard: document.getElementById('tweet-link-card'),
    tagButtons: document.querySelectorAll('.tag-toggle-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
    initProgressRing();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        elements.html.classList.remove('dark-theme');
        elements.html.classList.add('light-theme');
        elements.themeIcon.className = 'fa-solid fa-sun';
    } else {
        elements.html.classList.remove('light-theme');
        elements.html.classList.add('dark-theme');
        elements.themeIcon.className = 'fa-solid fa-moon';
    }
}

function toggleTheme() {
    if (elements.html.classList.contains('light-theme')) {
        elements.html.classList.remove('light-theme');
        elements.html.classList.add('dark-theme');
        elements.themeIcon.className = 'fa-solid fa-moon';
        localStorage.setItem('theme', 'dark');
    } else {
        elements.html.classList.remove('dark-theme');
        elements.html.classList.add('light-theme');
        elements.themeIcon.className = 'fa-solid fa-sun';
        localStorage.setItem('theme', 'light');
    }
}

// Fetch Data from Flask API
async function fetchReleaseNotes() {
    showState('loading');
    elements.refreshIcon.classList.add('spinning');
    elements.btnRefresh.disabled = true;

    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        const data = await response.json();
        allUpdates = data;
        
        // Update stats and display list
        updateStats();
        renderUpdates();
        
        // Set last updated time
        const now = new Date();
        elements.lastUpdatedText.textContent = `Last checked: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        
        if (allUpdates.length === 0) {
            showState('empty');
        } else {
            showState('grid');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        elements.errorMessage.textContent = `Error fetching data: ${error.message}`;
        showState('error');
    } finally {
        elements.refreshIcon.classList.remove('spinning');
        elements.btnRefresh.disabled = false;
    }
}

// Update Dashboard Statistics
function updateStats() {
    elements.statTotal.textContent = allUpdates.length;
    
    const features = allUpdates.filter(u => u.type.toLowerCase() === 'feature').length;
    const changes = allUpdates.filter(u => u.type.toLowerCase() === 'change').length;
    const breakingAndIssues = allUpdates.filter(u => {
        const t = u.type.toLowerCase();
        return t === 'breaking' || t === 'issue';
    }).length;
    
    elements.statFeatures.textContent = features;
    elements.statChanges.textContent = changes;
    elements.statBreaking.textContent = breakingAndIssues;
}

// Render Updates Grid
function renderUpdates() {
    elements.updatesGrid.innerHTML = '';
    
    // Filter & Search Logic
    const filtered = allUpdates.filter(update => {
        const matchesFilter = currentFilter === 'all' || update.type.toLowerCase() === currentFilter;
        
        const textToSearch = `${update.title || ''} ${update.type || ''} ${update.text || ''}`.toLowerCase();
        const matchesSearch = textToSearch.includes(searchQuery.toLowerCase());
        
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.updatesGrid.style.display = 'none';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.updatesGrid.style.display = 'grid';

    filtered.forEach(update => {
        const card = document.createElement('article');
        card.className = 'update-card';
        card.id = `card-${update.id}`;
        
        // Define badge type class
        let typeClass = 'badge-feature';
        const typeLower = update.type.toLowerCase();
        if (typeLower === 'change') typeClass = 'badge-change';
        else if (typeLower === 'breaking') typeClass = 'badge-breaking';
        else if (typeLower === 'issue') typeClass = 'badge-issue';
        else if (typeLower === 'announcement') typeClass = 'badge-announcement';
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge ${typeClass}">${update.type}</span>
                    <span class="card-date">${update.date}</span>
                </div>
            </div>
            <div class="card-content">
                ${update.html}
            </div>
            <div class="card-footer">
                ${update.link ? `
                    <a href="${update.link}" target="_blank" rel="noopener" class="external-link">
                        <span>Official Docs</span>
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                ` : '<span></span>'}
                <button class="btn btn-draft" onclick="openTweetComposer('${update.id}')">
                    <i class="fa-brands fa-x-twitter"></i>
                    <span>Draft Post</span>
                </button>
            </div>
        `;
        
        elements.updatesGrid.appendChild(card);
    });
}

// Manage UI view states
function showState(state) {
    elements.loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    elements.errorState.style.display = state === 'error' ? 'flex' : 'none';
    elements.emptyState.style.display = state === 'empty' ? 'flex' : 'none';
    elements.updatesGrid.style.display = state === 'grid' ? 'grid' : 'none';
}

// Event Listeners Setup
function setupEventListeners() {
    // Refresh button
    elements.btnRefresh.addEventListener('click', fetchReleaseNotes);
    elements.btnRetry.addEventListener('click', fetchReleaseNotes);
    
    // Theme toggle
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        elements.clearSearch.style.display = searchQuery ? 'block' : 'none';
        renderUpdates();
    });
    
    // Clear search
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        elements.searchInput.focus();
        renderUpdates();
    });
    
    // Filter tabs
    elements.filterTabs.addEventListener('click', (e) => {
        const button = e.target.closest('.filter-tab');
        if (!button) return;
        
        document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        currentFilter = button.dataset.filter;
        renderUpdates();
    });
    
    // Reset filters empty state button
    elements.btnResetFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        
        document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
        currentFilter = 'all';
        
        renderUpdates();
    });
    
    // Modal Close
    elements.modalClose.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });
    
    // Composer Live Update
    elements.tweetTextarea.addEventListener('input', () => {
        updateTweetPreview();
    });
    
    // Hashtag Helpers
    elements.tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            updateDraftTextWithTags();
        });
    });
    
    // Share on X click
    elements.btnPostTwitter.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank');
    });
}

// Progress Ring Initialization
let ringCircumference = 0;
function initProgressRing() {
    const radius = elements.charProgressRing.r.baseVal.value;
    ringCircumference = radius * 2 * Math.PI;
    elements.charProgressRing.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    elements.charProgressRing.style.strokeDashoffset = ringCircumference;
}

function setProgress(percent) {
    const offset = ringCircumference - (percent / 100 * ringCircumference);
    elements.charProgressRing.style.strokeDashoffset = offset;
}

// Tweet Composer & Preview Logic
window.openTweetComposer = function(id) {
    selectedUpdate = allUpdates.find(u => u.id === id);
    if (!selectedUpdate) return;
    
    // Build default text
    let cleanText = selectedUpdate.text;
    
    // Add default header text
    let baseHeader = `New BigQuery ${selectedUpdate.type}: `;
    let urlText = selectedUpdate.link ? ` ${selectedUpdate.link}` : '';
    
    // Standard tags that are active by default
    let defaultTags = ' #BigQuery #GoogleCloud';
    
    // Max description length = 280 - baseHeader - urlText - defaultTags - margins
    const availableLength = 280 - baseHeader.length - urlText.length - defaultTags.length - 4;
    
    if (cleanText.length > availableLength) {
        cleanText = cleanText.substring(0, availableLength - 3) + '...';
    }
    
    // Set initial text inside textarea
    elements.tweetTextarea.value = `${baseHeader}${cleanText}${defaultTags}${urlText}`;
    
    // Set tags button active states
    elements.tagButtons.forEach(btn => {
        const tag = btn.dataset.tag;
        if (defaultTags.includes(tag)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show Modal
    elements.tweetModal.style.display = 'flex';
    setTimeout(() => {
        elements.tweetModal.classList.add('active');
    }, 10);
    
    // Focus textarea
    elements.tweetTextarea.focus();
    
    // Update live previews
    updateTweetPreview();
};

function closeTweetModal() {
    elements.tweetModal.classList.remove('active');
    setTimeout(() => {
        elements.tweetModal.style.display = 'none';
    }, 300);
}

// Update text in composer when tags are toggled
function updateDraftTextWithTags() {
    if (!selectedUpdate) return;
    
    let text = elements.tweetTextarea.value;
    
    // Exclude links and existing hashtags to extract the core description
    // A simple regex approach or reconstruction
    let tagsList = [];
    elements.tagButtons.forEach(btn => {
        if (btn.classList.contains('active')) {
            tagsList.push(btn.dataset.tag);
        }
    });
    
    // Reconstruction from current text:
    // We try to identify if the tags are at the end, before the link.
    // To make it easy and robust, we reconstruct the whole tweet using the original text
    let cleanText = selectedUpdate.text;
    let baseHeader = `New BigQuery ${selectedUpdate.type}: `;
    let urlText = selectedUpdate.link ? ` ${selectedUpdate.link}` : '';
    let tagsText = tagsList.length ? ' ' + tagsList.join(' ') : '';
    
    const availableLength = 280 - baseHeader.length - urlText.length - tagsText.length - 4;
    
    if (cleanText.length > availableLength) {
        cleanText = cleanText.substring(0, availableLength - 3) + '...';
    }
    
    elements.tweetTextarea.value = `${baseHeader}${cleanText}${tagsText}${urlText}`;
    updateTweetPreview();
}

function updateTweetPreview() {
    const text = elements.tweetTextarea.value;
    const len = text.length;
    const remaining = 280 - len;
    
    // Update text character count number
    elements.charCountNum.textContent = remaining;
    
    // Update Progress Ring
    const percentage = Math.min((len / 280) * 100, 100);
    setProgress(percentage);
    
    // Style adjustments for character limits
    if (remaining < 0) {
        elements.charCountNum.style.color = '#f87171'; // red
        elements.charProgressRing.style.stroke = '#f87171';
        elements.btnPostTwitter.disabled = true;
    } else if (remaining <= 20) {
        elements.charCountNum.style.color = '#fbbf24'; // amber
        elements.charProgressRing.style.stroke = '#fbbf24';
        elements.btnPostTwitter.disabled = false;
    } else {
        elements.charCountNum.style.color = 'var(--text-secondary)';
        elements.charProgressRing.style.stroke = 'var(--primary-color)';
        elements.btnPostTwitter.disabled = false;
    }
    
    // Mirror content in the live preview tweet card
    // Add simple markup/styling to links and tags in preview
    let previewHTML = escapeHTML(text)
        .replace(/(@\w+)/g, '<span class="tweet-link">$1</span>')
        .replace(/(#\w+)/g, '<span class="tweet-link">$1</span>')
        .replace(/(https?:\/\/[^\s]+)/g, '<span class="tweet-link">$1</span>');
        
    elements.tweetPreviewText.innerHTML = previewHTML;
    
    // Update link preview card
    if (selectedUpdate && selectedUpdate.link) {
        elements.tweetLinkCard.style.display = 'flex';
        // Add brief description of selected item
        const linkDesc = elements.tweetLinkCard.querySelector('.tweet-link-desc');
        linkDesc.textContent = selectedUpdate.text;
    } else {
        elements.tweetLinkCard.style.display = 'none';
    }
}

// Helpers
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
