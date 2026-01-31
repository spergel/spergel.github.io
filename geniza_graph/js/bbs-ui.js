// BBS UI Controller
class BBSTerminalUI {
    constructor() {
        // Graph instance
        this.graph = new BBSNetworkGraph("#graph-container");
        
        // Data
        this.data = {
            all: null,
            twoPlus: null
        };
        this.currentDataset = 'twoPlus';
        
        // Filter state
        this.filters = {
            yearStart: 750,
            yearEnd: 1250,
            selectedTags: new Set(),
            dateRange: [750, 1250]
        };
        
        // Stats
        this.stats = {
            nodes: 0,
            links: 0,
            letters: 0
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        this.updateStatus("LOADING DATA...");
        this.showLoading();
        
        try {
            // Load both datasets
            const [allData, twoPlusData] = await Promise.all([
                fetch('graph_data_all.json').then(r => r.json()),
                fetch('graph_data_2_plus_letters.json').then(r => r.json())
            ]);
            
            this.data.all = allData;
            this.data.twoPlus = twoPlusData;
            
            // Calculate date range from all data
            this.calculateDateRange();
            
            // Setup UI
            this.setupEventListeners();
            this.populateTags();
            this.updateTimeInputs();
            
            // Initial render
            this.applyFilters();
            
            this.hideLoading();
            this.updateStatus("READY");
            
        } catch (error) {
            console.error("Error loading data:", error);
            this.updateStatus("ERROR: Failed to load data");
            this.hideLoading();
        }
    }
    
    setupEventListeners() {
        // Apply filters button
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Year inputs
        document.getElementById('year-start').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value >= this.filters.dateRange[0] && value < this.filters.yearEnd) {
                this.filters.yearStart = value;
                this.syncSliders();
            } else {
                e.target.value = this.filters.yearStart;
            }
        });
        
        document.getElementById('year-end').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value <= this.filters.dateRange[1] && value > this.filters.yearStart) {
                this.filters.yearEnd = value;
                this.syncSliders();
            } else {
                e.target.value = this.filters.yearEnd;
            }
        });
        
        // Year sliders
        document.getElementById('year-slider-start').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < this.filters.yearEnd) {
                this.filters.yearStart = value;
                document.getElementById('year-start').value = value;
            }
        });
        
        document.getElementById('year-slider-end').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > this.filters.yearStart) {
                this.filters.yearEnd = value;
                document.getElementById('year-end').value = value;
            }
        });
        
        // Toggle all tags
        document.getElementById('toggle-all-tags').addEventListener('click', () => {
            const allChecked = this.filters.selectedTags.size === this.getAllTags().length;
            
            if (allChecked) {
                this.filters.selectedTags.clear();
                document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
                document.getElementById('toggle-all-tags').textContent = 'SELECT ALL';
            } else {
                this.getAllTags().forEach(tag => this.filters.selectedTags.add(tag));
                document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = true);
                document.getElementById('toggle-all-tags').textContent = 'DESELECT ALL';
            }
        });
        
        // Toggle dataset
        document.getElementById('toggle-dataset').addEventListener('click', (e) => {
            this.currentDataset = this.currentDataset === 'all' ? 'twoPlus' : 'all';
            e.target.textContent = this.currentDataset === 'all' ? '2+ LETTERS' : 'ALL LETTERS';
            
            // Get new dataset's tags
            const newTags = this.getAllTags();
            const newTagsSet = new Set(newTags);
            
            // Remove any selected tags that don't exist in new dataset
            const tagsToRemove = [];
            this.filters.selectedTags.forEach(tag => {
                if (!newTagsSet.has(tag)) {
                    tagsToRemove.push(tag);
                }
            });
            tagsToRemove.forEach(tag => this.filters.selectedTags.delete(tag));
            
            // Repopulate UI and apply
            this.populateTags();
            this.applyFilters();
        });
        
        // Toggle theme
        document.getElementById('toggle-theme').addEventListener('click', (e) => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            e.target.textContent = isLight ? '🌙 DARK MODE' : '☀ LIGHT MODE';
            
            // Save preference
            localStorage.setItem('bbs-theme', isLight ? 'light' : 'dark');
        });
        
        // Load saved theme preference
        const savedTheme = localStorage.getItem('bbs-theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            document.getElementById('toggle-theme').textContent = '🌙 DARK MODE';
        }
        
        // Mobile sidebar toggle
        this.setupMobileSidebar();
        
        // Close details
        document.getElementById('close-details').addEventListener('click', () => {
            this.hideDetails();
        });
        
        // Graph callbacks
        this.graph.onNodeClick = (node) => this.showNodeDetails(node);
        this.graph.onLinkClick = (link) => this.showLinkDetails(link);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideDetails();
            }
            if (e.key === 'F2') {
                e.preventDefault();
                this.resetFilters();
            }
        });
    }
    
    calculateDateRange() {
        let min = Infinity;
        let max = -Infinity;
        
        const allData = this.data.all;
        if (allData && allData.links) {
            allData.links.forEach(link => {
                if (link.letters) {
                    link.letters.forEach(letter => {
                        if (letter.date) {
                            min = Math.min(min, letter.date);
                            max = Math.max(max, letter.date);
                        }
                    });
                }
            });
        }
        
        if (min !== Infinity && max !== -Infinity) {
            this.filters.dateRange = [Math.floor(min), Math.ceil(max)];
            this.filters.yearStart = this.filters.dateRange[0];
            this.filters.yearEnd = this.filters.dateRange[1];
        }
    }
    
    getAllTags() {
        const currentData = this.data[this.currentDataset];
        const tags = new Set();
        
        if (currentData && currentData.links) {
            currentData.links.forEach(link => {
                if (link.tags) {
                    link.tags.forEach(tag => tags.add(tag));
                }
            });
        }
        
        return Array.from(tags).sort();
    }
    
    populateTags() {
        const tagsList = document.getElementById('tags-list');
        tagsList.innerHTML = '';
        
        const tags = this.getAllTags();
        
        tags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'tag-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'tag-checkbox';
            checkbox.value = tag;
            checkbox.checked = this.filters.selectedTags.has(tag);
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.filters.selectedTags.add(tag);
                } else {
                    this.filters.selectedTags.delete(tag);
                }
                this.updateToggleAllButton();
            });
            
            const label = document.createElement('span');
            label.textContent = tag;
            
            item.appendChild(checkbox);
            item.appendChild(label);
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            
            tagsList.appendChild(item);
        });
        
        this.updateToggleAllButton();
    }
    
    updateToggleAllButton() {
        const allTags = this.getAllTags();
        const button = document.getElementById('toggle-all-tags');
        button.textContent = this.filters.selectedTags.size === allTags.length ? 'DESELECT ALL' : 'SELECT ALL';
    }
    
    updateTimeInputs() {
        document.getElementById('year-start').min = this.filters.dateRange[0];
        document.getElementById('year-start').max = this.filters.dateRange[1];
        document.getElementById('year-start').value = this.filters.yearStart;
        
        document.getElementById('year-end').min = this.filters.dateRange[0];
        document.getElementById('year-end').max = this.filters.dateRange[1];
        document.getElementById('year-end').value = this.filters.yearEnd;
        
        document.getElementById('year-slider-start').min = this.filters.dateRange[0];
        document.getElementById('year-slider-start').max = this.filters.dateRange[1];
        document.getElementById('year-slider-start').value = this.filters.yearStart;
        
        document.getElementById('year-slider-end').min = this.filters.dateRange[0];
        document.getElementById('year-slider-end').max = this.filters.dateRange[1];
        document.getElementById('year-slider-end').value = this.filters.yearEnd;
    }
    
    syncSliders() {
        document.getElementById('year-slider-start').value = this.filters.yearStart;
        document.getElementById('year-slider-end').value = this.filters.yearEnd;
    }
    
    applyFilters() {
        this.updateStatus("APPLYING FILTERS...");
        
        const currentData = this.data[this.currentDataset];
        if (!currentData) return;
        
        // Filter links
        const filteredLinks = currentData.links.filter(link => {
            // Check tags
            const hasSelectedTags = this.filters.selectedTags.size === 0 || 
                (link.tags && link.tags.some(tag => this.filters.selectedTags.has(tag)));
            
            // Check time range
            const hasLettersInRange = link.letters && link.letters.some(letter => 
                letter.date >= this.filters.yearStart && letter.date <= this.filters.yearEnd
            );
            
            return hasSelectedTags && hasLettersInRange;
        });
        
        // Extract nodes from filtered links
        const nodesMap = new Map();
        filteredLinks.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (!nodesMap.has(sourceId)) {
                nodesMap.set(sourceId, { id: sourceId, name: sourceId });
            }
            if (!nodesMap.has(targetId)) {
                nodesMap.set(targetId, { id: targetId, name: targetId });
            }
        });
        
        const nodes = Array.from(nodesMap.values());
        
        // Count total letters
        let totalLetters = 0;
        filteredLinks.forEach(link => {
            if (link.letters) {
                totalLetters += link.letters.filter(letter => 
                    letter.date >= this.filters.yearStart && letter.date <= this.filters.yearEnd
                ).length;
            }
        });
        
        // Update stats
        this.stats = {
            nodes: nodes.length,
            links: filteredLinks.length,
            letters: totalLetters
        };
        this.updateStats();
        
        // Update graph
        this.graph.updateData(nodes, filteredLinks);
        
        this.updateStatus(`READY - ${nodes.length} NODES, ${filteredLinks.length} LINKS`);
    }
    
    updateStats() {
        document.getElementById('stat-nodes').textContent = this.stats.nodes;
        document.getElementById('stat-links').textContent = this.stats.links;
        document.getElementById('stat-letters').textContent = this.stats.letters;
        document.getElementById('stat-period').textContent = `${this.filters.yearStart}-${this.filters.yearEnd}`;
    }
    
    updateStatus(message) {
        document.getElementById('status-bar').textContent = message;
    }
    
    showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading-indicator';
        loading.id = 'loading';
        loading.innerHTML = `
            <div class="loading-text">LOADING...</div>
            <div class="loading-bar">
                <div class="loading-progress"></div>
            </div>
        `;
        document.getElementById('graph-container').appendChild(loading);
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.remove();
    }
    
    showNodeDetails(node) {
        const panel = document.getElementById('details-panel');
        const content = document.getElementById('details-content');
        
        // Find all letters involving this node
        const currentData = this.data[this.currentDataset];
        const lettersFrom = [];
        const lettersTo = [];
        
        currentData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (sourceId === node.id && link.letters) {
                link.letters.forEach(letter => {
                    lettersFrom.push({ ...letter, to: targetId });
                });
            }
            if (targetId === node.id && link.letters) {
                link.letters.forEach(letter => {
                    lettersTo.push({ ...letter, from: sourceId });
                });
            }
        });
        
        content.innerHTML = `
            <div class="detail-section">
                <div class="detail-title">NODE: ${node.name || node.id}</div>
                <div class="detail-item">Total Connections: ${lettersFrom.length + lettersTo.length}</div>
                <div class="detail-item">Letters Sent: ${lettersFrom.length}</div>
                <div class="detail-item">Letters Received: ${lettersTo.length}</div>
            </div>
            
            ${lettersFrom.length > 0 ? `
            <div class="detail-section">
                <div class="detail-title">LETTERS SENT (${lettersFrom.length})</div>
                ${lettersFrom.map(letter => `
                    <div class="detail-item">
                        → To: ${letter.to}<br>
                        Date: ${letter.date || 'Unknown'}<br>
                        <a href="https://geniza.princeton.edu/en/documents/${letter.pgpid}" target="_blank" class="letter-link">View Document #${letter.pgpid}</a>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${lettersTo.length > 0 ? `
            <div class="detail-section">
                <div class="detail-title">LETTERS RECEIVED (${lettersTo.length})</div>
                ${lettersTo.map(letter => `
                    <div class="detail-item">
                        ← From: ${letter.from}<br>
                        Date: ${letter.date || 'Unknown'}<br>
                        <a href="https://geniza.princeton.edu/en/documents/${letter.pgpid}" target="_blank" class="letter-link">View Document #${letter.pgpid}</a>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
        
        panel.classList.add('visible');
    }
    
    showLinkDetails(link) {
        const panel = document.getElementById('details-panel');
        const content = document.getElementById('details-content');
        
        const sourceName = link.source.name || link.source.id;
        const targetName = link.target.name || link.target.id;
        
        content.innerHTML = `
            <div class="detail-section">
                <div class="detail-title">CONNECTION: ${sourceName} ↔ ${targetName}</div>
                <div class="detail-item">Total Letters: ${link.letters ? link.letters.length : 0}</div>
                ${link.tags ? `<div class="detail-item">Tags: ${link.tags.join(', ')}</div>` : ''}
            </div>
            
            ${link.letters && link.letters.length > 0 ? `
            <div class="detail-section">
                <div class="detail-title">LETTERS (${link.letters.length})</div>
                ${link.letters.map(letter => `
                    <div class="detail-item">
                        Direction: ${letter.direction === 'forward' ? `${sourceName} → ${targetName}` : `${targetName} → ${sourceName}`}<br>
                        Date: ${letter.date || 'Unknown'}<br>
                        From: ${letter.start_location || 'Unknown'}<br>
                        To: ${letter.end_location || 'Unknown'}<br>
                        <a href="https://geniza.princeton.edu/en/documents/${letter.pgpid}" target="_blank" class="letter-link">View Document #${letter.pgpid}</a>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
        
        panel.classList.add('visible');
    }
    
    hideDetails() {
        document.getElementById('details-panel').classList.remove('visible');
    }
    
    resetFilters() {
        this.filters.yearStart = this.filters.dateRange[0];
        this.filters.yearEnd = this.filters.dateRange[1];
        this.filters.selectedTags.clear();
        
        this.updateTimeInputs();
        this.syncSliders();
        this.populateTags();
        this.applyFilters();
    }
    
    setupMobileSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        
        // Show toggle on mobile
        const updateMobileUI = () => {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                toggle.style.display = 'block';
                if (!sidebar.classList.contains('collapsed')) {
                    sidebar.classList.add('collapsed');
                    toggle.textContent = '▼ SHOW FILTERS';
                }
            } else {
                toggle.style.display = 'none';
                sidebar.classList.remove('collapsed');
            }
        };
        
        // Toggle sidebar
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            toggle.textContent = sidebar.classList.contains('collapsed') 
                ? '▼ SHOW FILTERS' 
                : '▲ HIDE FILTERS';
        });
        
        // Initial check
        updateMobileUI();
        
        // Update on resize
        window.addEventListener('resize', updateMobileUI);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.bbsUI = new BBSTerminalUI();
});
