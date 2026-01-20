// BBS Network Graph Implementation
class BBSNetworkGraph {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.width = 0;
        this.height = 0;
        
        this.nodes = [];
        this.links = [];
        this.simulation = null;
        
        this.svg = null;
        this.g = null;
        
        // Visual elements
        this.linkElements = null;
        this.nodeElements = null;
        this.labelElements = null;
        
        // Tooltip
        this.tooltip = this.createTooltip();
        
        // Callbacks
        this.onNodeClick = null;
        this.onLinkClick = null;
        
        this.initialize();
    }
    
    initialize() {
        // Get container dimensions
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        // Detect mobile
        this.isMobile = window.innerWidth <= 768;
        
        // Create SVG
        this.svg = this.container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`);
        
        // Main group for zoom/pan
        this.g = this.svg.append("g");
        
        // Add zoom behavior (simplified on mobile)
        const zoom = d3.zoom()
            .scaleExtent(this.isMobile ? [0.3, 2] : [0.1, 4])
            .on("zoom", (event) => {
                this.g.attr("transform", event.transform);
            });
        
        this.svg.call(zoom);
        
        // Set initial zoom to show full graph
        const initialScale = this.isMobile ? 0.6 : 0.8;
        const initialTransform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(initialScale);
        this.svg.call(zoom.transform, initialTransform);
        
        // Initialize simulation with mobile-optimized settings
        const linkDistance = this.isMobile ? 80 : 100;
        const chargeStrength = this.isMobile ? -200 : -300;
        
        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(linkDistance))
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collision", d3.forceCollide().radius(25));
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    handleResize() {
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
        
        // Update mobile detection
        this.isMobile = window.innerWidth <= 768;
        
        if (this.simulation) {
            this.simulation.force("center", d3.forceCenter(this.width / 2, this.height / 2));
            this.simulation.alpha(0.3).restart();
        }
    }
    
    updateData(nodes, links) {
        console.log(`Updating graph: ${nodes.length} nodes, ${links.length} links`);
        
        this.nodes = nodes;
        this.links = links;
        
        // Stop old simulation
        if (this.simulation) {
            this.simulation.stop();
        }
        
        // Render
        this.render();
        
        // Restart simulation with mobile optimization
        this.simulation.nodes(this.nodes);
        this.simulation.force("link").links(this.links);
        
        // On mobile, run fewer iterations for faster settling
        if (this.isMobile) {
            this.simulation
                .alphaDecay(0.05) // Faster decay on mobile
                .velocityDecay(0.6); // More damping on mobile
        } else {
            this.simulation
                .alphaDecay(0.0228)
                .velocityDecay(0.4);
        }
        
        this.simulation.alpha(1).restart();
    }
    
    render() {
        // Clear old elements
        this.g.selectAll("*").remove();
        
        // Create element groups
        const linkGroup = this.g.append("g").attr("class", "links");
        const nodeGroup = this.g.append("g").attr("class", "nodes");
        const labelGroup = this.g.append("g").attr("class", "labels");
        
        // Draw links
        this.linkElements = linkGroup
            .selectAll("line")
            .data(this.links)
            .join("line")
            .attr("class", "link")
            .attr("stroke-width", d => Math.max(1.5, Math.sqrt(d.letters ? d.letters.length : 1) * 1.2))
            .on("click", (event, d) => {
                event.stopPropagation();
                if (this.onLinkClick) this.onLinkClick(d);
            })
            .on("mouseover", (event, d) => {
                this.highlightConnection(d);
                this.showTooltip(event, d, 'link');
            })
            .on("mouseout", () => {
                this.clearHighlight();
                this.hideTooltip();
            });
        
        // Calculate node sizes based on connections (larger on mobile for touch)
        const nodeSize = (d) => {
            const connections = this.links.filter(l => 
                l.source.id === d.id || l.target.id === d.id
            ).length;
            const baseSize = this.isMobile ? 10 : 8;
            const multiplier = this.isMobile ? 5 : 4;
            return Math.max(baseSize, Math.sqrt(connections) * multiplier);
        };
        
        // Draw nodes
        this.nodeElements = nodeGroup
            .selectAll("circle")
            .data(this.nodes)
            .join("circle")
            .attr("class", "node")
            .attr("r", d => nodeSize(d))
            .attr("fill", "var(--terminal-green)")
            .call(this.drag(this.simulation))
            .on("click", (event, d) => {
                event.stopPropagation();
                if (this.onNodeClick) this.onNodeClick(d);
            })
            .on("mouseover", (event, d) => {
                this.highlightNode(d);
                this.showTooltip(event, d, 'node');
            })
            .on("mouseout", () => {
                this.clearHighlight();
                this.hideTooltip();
            });
        
        // Draw labels (hide on mobile when there are many nodes for performance)
        const showLabels = !this.isMobile || this.nodes.length < 30;
        
        this.labelElements = labelGroup
            .selectAll("text")
            .data(showLabels ? this.nodes : [])
            .join("text")
            .attr("class", "node-label")
            .text(d => this.truncateLabel(d.name || d.id, this.isMobile ? 15 : 20))
            .attr("dx", d => nodeSize(d) + 5)
            .attr("dy", "0.35em");
        
        // Update positions on simulation tick
        this.simulation.on("tick", () => {
            this.linkElements
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            this.nodeElements
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
            
            this.labelElements
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        });
    }
    
    truncateLabel(text, maxLength = 20) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }
    
    highlightNode(node) {
        // Find connected nodes and links
        const connectedNodeIds = new Set([node.id]);
        const connectedLinks = new Set();
        
        this.links.forEach(link => {
            if (link.source.id === node.id || link.target.id === node.id) {
                connectedLinks.add(link);
                connectedNodeIds.add(link.source.id);
                connectedNodeIds.add(link.target.id);
            }
        });
        
        // Dim everything
        this.nodeElements.classed("dimmed", d => !connectedNodeIds.has(d.id));
        this.linkElements.classed("dimmed", d => !connectedLinks.has(d));
        this.labelElements.classed("dimmed", d => !connectedNodeIds.has(d.id));
        
        // Highlight connected
        this.nodeElements.classed("highlighted", d => connectedNodeIds.has(d.id));
        this.linkElements.classed("highlighted", d => connectedLinks.has(d));
    }
    
    highlightConnection(link) {
        const connectedNodeIds = new Set([link.source.id, link.target.id]);
        
        // Dim everything
        this.nodeElements.classed("dimmed", d => !connectedNodeIds.has(d.id));
        this.linkElements.classed("dimmed", d => d !== link);
        this.labelElements.classed("dimmed", d => !connectedNodeIds.has(d.id));
        
        // Highlight
        this.nodeElements.classed("highlighted", d => connectedNodeIds.has(d.id));
        this.linkElements.classed("highlighted", d => d === link);
    }
    
    clearHighlight() {
        this.nodeElements.classed("dimmed", false).classed("highlighted", false);
        this.linkElements.classed("dimmed", false).classed("highlighted", false);
        this.labelElements.classed("dimmed", false);
    }
    
    createTooltip() {
        return d3.select("body")
            .append("div")
            .attr("class", "graph-tooltip");
    }
    
    showTooltip(event, data, type) {
        let content = '';
        
        if (type === 'node') {
            const connections = this.links.filter(l => 
                l.source.id === data.id || l.target.id === data.id
            ).length;
            content = `<strong>${data.name || data.id}</strong><br>Connections: ${connections}`;
        } else if (type === 'link') {
            const sourceName = data.source.name || data.source.id;
            const targetName = data.target.name || data.target.id;
            const letterCount = data.letters ? data.letters.length : 0;
            content = `${sourceName} ↔ ${targetName}<br>Letters: ${letterCount}`;
        }
        
        this.tooltip
            .html(content)
            .classed("visible", true)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
    }
    
    hideTooltip() {
        this.tooltip.classed("visible", false);
    }
    
    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
    
    clear() {
        this.nodes = [];
        this.links = [];
        this.g.selectAll("*").remove();
        if (this.simulation) {
            this.simulation.stop();
        }
    }
}
