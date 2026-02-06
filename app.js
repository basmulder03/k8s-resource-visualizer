// Kubernetes Resource Visualizer - Main Application Logic

let cy; // Cytoscape instance
let resources = []; // Parsed Kubernetes resources

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeCytoscape();
    loadFromURL();
    setupFileInput();
});

// Initialize Cytoscape graph
function initializeCytoscape() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'background-color': 'data(color)',
                    'color': '#fff',
                    'text-outline-color': 'data(color)',
                    'text-outline-width': 2,
                    'font-size': '12px',
                    'width': 'data(size)',
                    'height': 'data(size)',
                    'font-weight': 'bold'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#94a3b8',
                    'target-arrow-color': '#94a3b8',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'color': '#64748b',
                    'text-background-color': '#fff',
                    'text-background-opacity': 0.8,
                    'text-background-padding': '3px'
                }
            },
            {
                selector: ':selected',
                style: {
                    'border-width': 3,
                    'border-color': '#000'
                }
            }
        ],
        
        layout: {
            name: 'breadthfirst',
            directed: true,
            spacingFactor: 1.5,
            padding: 30
        }
    });
}

// Parse YAML and visualize resources
function visualize() {
    const yamlText = document.getElementById('yamlInput').value;
    
    if (!yamlText.trim()) {
        showMessage('Please enter some YAML content', 'error');
        return;
    }

    try {
        resources = parseKubernetesYAML(yamlText);
        
        if (resources.length === 0) {
            showMessage('No valid Kubernetes resources found', 'error');
            return;
        }

        buildGraph(resources);
        updateResourceCount(resources);
        showMessage(`Successfully visualized ${resources.length} resource(s)`, 'success');
        
    } catch (error) {
        showMessage(`Error parsing YAML: ${error.message}`, 'error');
        console.error(error);
    }
}

// Parse Kubernetes YAML (supports multiple documents)
function parseKubernetesYAML(yamlText) {
    const docs = jsyaml.loadAll(yamlText);
    const resources = [];
    
    for (const doc of docs) {
        if (doc && doc.kind && doc.metadata) {
            resources.push(doc);
        }
    }
    
    return resources;
}

// Build the graph from resources
function buildGraph(resources) {
    cy.elements().remove();
    
    const elements = [];
    const nodes = new Map();
    const edges = [];
    
    // Process each resource
    resources.forEach(resource => {
        const kind = resource.kind;
        const name = resource.metadata?.name || 'unnamed';
        const namespace = resource.metadata?.namespace || 'default';
        const nodeId = `${kind}/${namespace}/${name}`;
        
        // Add main resource node
        nodes.set(nodeId, {
            id: nodeId,
            label: `${kind}\n${name}`,
            kind: kind,
            color: getColorForKind(kind),
            size: getSizeForKind(kind)
        });
        
        // Handle Deployment
        if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet') {
            const replicas = resource.spec?.replicas || 1;
            const template = resource.spec?.template;
            
            // Create pod nodes
            for (let i = 0; i < Math.min(replicas, 5); i++) {
                const podId = `Pod/${namespace}/${name}-pod-${i}`;
                nodes.set(podId, {
                    id: podId,
                    label: `Pod\n${name}-${i}`,
                    kind: 'Pod',
                    color: getColorForKind('Pod'),
                    size: 40
                });
                
                edges.push({
                    source: nodeId,
                    target: podId,
                    label: 'manages'
                });
                
                // Process containers
                const containers = template?.spec?.containers || [];
                containers.forEach((container, cIdx) => {
                    const containerId = `Container/${namespace}/${name}-pod-${i}-${container.name}`;
                    nodes.set(containerId, {
                        id: containerId,
                        label: `Container\n${container.name}`,
                        kind: 'Container',
                        color: getColorForKind('Container'),
                        size: 30
                    });
                    
                    edges.push({
                        source: podId,
                        target: containerId,
                        label: 'contains'
                    });
                });
                
                // Link to ServiceAccount
                const serviceAccountName = template?.spec?.serviceAccountName;
                if (serviceAccountName) {
                    const saId = `ServiceAccount/${namespace}/${serviceAccountName}`;
                    edges.push({
                        source: podId,
                        target: saId,
                        label: 'uses'
                    });
                }
                
                // Link to ConfigMaps
                const volumes = template?.spec?.volumes || [];
                volumes.forEach(volume => {
                    if (volume.configMap) {
                        const cmId = `ConfigMap/${namespace}/${volume.configMap.name}`;
                        edges.push({
                            source: podId,
                            target: cmId,
                            label: 'mounts'
                        });
                    }
                    if (volume.secret) {
                        const secretId = `Secret/${namespace}/${volume.secret.secretName}`;
                        edges.push({
                            source: podId,
                            target: secretId,
                            label: 'mounts'
                        });
                    }
                });
            }
            
            if (replicas > 5) {
                const moreNodeId = `${nodeId}-more`;
                nodes.set(moreNodeId, {
                    id: moreNodeId,
                    label: `... +${replicas - 5} more pods`,
                    kind: 'Pod',
                    color: '#cbd5e1',
                    size: 35
                });
                edges.push({
                    source: nodeId,
                    target: moreNodeId,
                    label: ''
                });
            }
        }
        
        // Handle Service
        if (kind === 'Service') {
            const selector = resource.spec?.selector || {};
            // Services can link to deployments/pods via selectors
            // For simplicity, we'll show the service as connected to deployments with matching labels
            resources.forEach(otherResource => {
                if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(otherResource.kind)) {
                    const labels = otherResource.metadata?.labels || {};
                    const matches = Object.keys(selector).every(key => labels[key] === selector[key]);
                    
                    if (matches && Object.keys(selector).length > 0) {
                        const targetId = `${otherResource.kind}/${otherResource.metadata?.namespace || 'default'}/${otherResource.metadata?.name}`;
                        edges.push({
                            source: nodeId,
                            target: targetId,
                            label: 'routes to'
                        });
                    }
                }
            });
        }
    });
    
    // Convert nodes Map to array
    nodes.forEach(node => {
        elements.push({ data: node });
    });
    
    // Add edges
    edges.forEach(edge => {
        elements.push({ data: edge });
    });
    
    // Add elements to graph
    cy.add(elements);
    
    // Apply layout
    cy.layout({
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.5,
        padding: 30,
        animate: true,
        animationDuration: 500
    }).run();
    
    // Fit to viewport
    cy.fit(50);
}

// Get color for resource kind
function getColorForKind(kind) {
    const colors = {
        'Deployment': '#326CE5',
        'Pod': '#00B4D8',
        'Container': '#90E0EF',
        'Service': '#48CAE4',
        'ServiceAccount': '#FFC300',
        'ConfigMap': '#FF5733',
        'Secret': '#C70039',
        'StatefulSet': '#9D4EDD',
        'DaemonSet': '#10B981',
        'Ingress': '#3B82F6',
        'PersistentVolumeClaim': '#F59E0B',
        'Namespace': '#8B5CF6'
    };
    
    return colors[kind] || '#94A3B8';
}

// Get size for resource kind
function getSizeForKind(kind) {
    const sizes = {
        'Deployment': 60,
        'StatefulSet': 60,
        'DaemonSet': 60,
        'Service': 55,
        'Pod': 40,
        'Container': 30,
        'ServiceAccount': 50,
        'ConfigMap': 45,
        'Secret': 45
    };
    
    return sizes[kind] || 50;
}

// Update resource count display
function updateResourceCount(resources) {
    const counts = {};
    
    resources.forEach(resource => {
        const kind = resource.kind;
        counts[kind] = (counts[kind] || 0) + 1;
    });
    
    const countDiv = document.getElementById('resourceCount');
    countDiv.innerHTML = '';
    
    Object.entries(counts).sort().forEach(([kind, count]) => {
        const badge = document.createElement('div');
        badge.className = 'resource-badge';
        badge.innerHTML = `${kind}: <span>${count}</span>`;
        countDiv.appendChild(badge);
    });
}

// Show message to user
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.className = type;
    messageDiv.textContent = text;
    
    setTimeout(() => {
        messageDiv.className = '';
        messageDiv.textContent = '';
    }, 5000);
}

// Share URL with encoded YAML
function shareURL() {
    const yamlText = document.getElementById('yamlInput').value;
    
    if (!yamlText.trim()) {
        showMessage('Please enter some YAML content first', 'error');
        return;
    }
    
    try {
        const encoded = btoa(encodeURIComponent(yamlText));
        const url = `${window.location.origin}${window.location.pathname}?yaml=${encoded}`;
        
        navigator.clipboard.writeText(url).then(() => {
            showMessage('URL copied to clipboard! Share it with others.', 'success');
        }).catch(() => {
            // Fallback if clipboard API fails
            prompt('Copy this URL to share:', url);
        });
    } catch (error) {
        showMessage('Error creating shareable URL', 'error');
        console.error(error);
    }
}

// Load YAML from URL parameter
function loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const yamlParam = urlParams.get('yaml');
    
    if (yamlParam) {
        try {
            const decoded = decodeURIComponent(atob(yamlParam));
            document.getElementById('yamlInput').value = decoded;
            visualize();
        } catch (error) {
            showMessage('Error loading YAML from URL', 'error');
            console.error(error);
        }
    }
}

// Clear all
function clearAll() {
    document.getElementById('yamlInput').value = '';
    resources = [];
    cy.elements().remove();
    document.getElementById('resourceCount').innerHTML = '<div class="resource-badge">No resources loaded</div>';
    document.getElementById('message').textContent = '';
}

// Setup file input handler
function setupFileInput() {
    document.getElementById('fileInput').addEventListener('change', function(event) {
        const files = event.target.files;
        if (files.length === 0) return;
        
        let combinedYAML = '';
        let filesRead = 0;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const content = e.target.result;
                combinedYAML += (combinedYAML ? '\n---\n' : '') + content;
                filesRead++;
                
                if (filesRead === files.length) {
                    document.getElementById('yamlInput').value = combinedYAML;
                    showMessage(`Loaded ${files.length} file(s)`, 'success');
                    visualize();
                }
            };
            
            reader.onerror = function() {
                showMessage(`Error reading file: ${file.name}`, 'error');
            };
            
            reader.readAsText(file);
        });
        
        // Reset file input
        event.target.value = '';
    });
}
