// Kubernetes Resource Visualizer - Main Application Logic

let resources = []; // Parsed Kubernetes resources

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMermaid();
    loadFromURL();
    setupFileInput();
});

// Initialize Mermaid rendering
function initializeMermaid() {
    if (typeof mermaid === 'undefined' || typeof mermaid.initialize !== 'function') {
        showMessage('Mermaid failed to load', 'error');
        return;
    }
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict'
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

        const diagram = buildMermaidDiagram(resources);
        renderMermaid(diagram);
        updateMermaidMarkdown(diagram);
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

// Build Mermaid diagram from resources
function buildMermaidDiagram(resources) {
    const nodes = new Map();
    const edges = [];
    let nodeIndex = 0;

    const ensureNode = (key, label, kind) => {
        if (!nodes.has(key)) {
            nodeIndex += 1;
            nodes.set(key, {
                id: `node${nodeIndex}`,
                label: label,
                kind: kind
            });
        }
        return nodes.get(key).id;
    };

    const formatLabel = (kind, name) => {
        return `${escapeMermaidLabel(kind)}<br/>${escapeMermaidLabel(name)}`;
    };

    // Process each resource
    resources.forEach(resource => {
        const kind = resource.kind;
        const name = resource.metadata?.name || 'unnamed';
        const namespace = resource.metadata?.namespace || 'default';
        const nodeKey = `${kind}/${namespace}/${name}`;
        const nodeId = ensureNode(nodeKey, formatLabel(kind, name), kind);

        // Handle Deployment
        if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet') {
            const replicas = resource.spec?.replicas || 1;
            const template = resource.spec?.template;

            // Create pod nodes
            for (let i = 0; i < Math.min(replicas, 5); i++) {
                const podName = `${name}-${i}`;
                const podKey = `Pod/${namespace}/${name}-pod-${i}`;
                const podId = ensureNode(podKey, formatLabel('Pod', podName), 'Pod');

                edges.push({
                    source: nodeId,
                    target: podId,
                    label: 'manages'
                });

                // Process containers
                const containers = template?.spec?.containers || [];
                containers.forEach(container => {
                    const containerKey = `Container/${namespace}/${name}-pod-${i}-${container.name}`;
                    const containerId = ensureNode(
                        containerKey,
                        formatLabel('Container', container.name),
                        'Container'
                    );

                    edges.push({
                        source: podId,
                        target: containerId,
                        label: 'contains'
                    });
                });

                // Link to ServiceAccount
                const serviceAccountName = template?.spec?.serviceAccountName;
                if (serviceAccountName) {
                    const saKey = `ServiceAccount/${namespace}/${serviceAccountName}`;
                    const saId = ensureNode(saKey, formatLabel('ServiceAccount', serviceAccountName), 'ServiceAccount');
                    edges.push({
                        source: podId,
                        target: saId,
                        label: 'uses'
                    });
                }

                // Link to ConfigMaps and Secrets
                const volumes = template?.spec?.volumes || [];
                volumes.forEach(volume => {
                    if (volume.configMap) {
                        const cmKey = `ConfigMap/${namespace}/${volume.configMap.name}`;
                        const cmId = ensureNode(cmKey, formatLabel('ConfigMap', volume.configMap.name), 'ConfigMap');
                        edges.push({
                            source: podId,
                            target: cmId,
                            label: 'mounts'
                        });
                    }
                    if (volume.secret) {
                        const secretKey = `Secret/${namespace}/${volume.secret.secretName}`;
                        const secretId = ensureNode(
                            secretKey,
                            formatLabel('Secret', volume.secret.secretName),
                            'Secret'
                        );
                        edges.push({
                            source: podId,
                            target: secretId,
                            label: 'mounts'
                        });
                    }
                });
            }

            if (replicas > 5) {
                const moreKey = `${nodeKey}-more`;
                const moreLabel = `... +${replicas - 5} more pods`;
                const moreId = ensureNode(moreKey, escapeMermaidLabel(moreLabel), 'Pod');
                edges.push({
                    source: nodeId,
                    target: moreId,
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
                        const targetKey = `${otherResource.kind}/${otherResource.metadata?.namespace || 'default'}/${otherResource.metadata?.name}`;
                        const targetId = ensureNode(
                            targetKey,
                            formatLabel(otherResource.kind, otherResource.metadata?.name || 'unnamed'),
                            otherResource.kind
                        );
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

    const lines = ['flowchart TD'];
    const classNames = new Map();

    nodes.forEach(node => {
        lines.push(`  ${node.id}["${node.label}"]`);
        const className = sanitizeMermaidClass(node.kind);
        if (!classNames.has(node.kind)) {
            classNames.set(node.kind, className);
        }
    });

    edges.forEach(edge => {
        const label = escapeMermaidEdgeLabel(edge.label);
        if (label) {
            lines.push(`  ${edge.source} -->|${label}| ${edge.target}`);
        } else {
            lines.push(`  ${edge.source} --> ${edge.target}`);
        }
    });

    classNames.forEach((className, kind) => {
        const color = getColorForKind(kind);
        lines.push(`  classDef ${className} fill:${color},stroke:${color},color:#fff`);
    });

    nodes.forEach(node => {
        const className = classNames.get(node.kind);
        if (className) {
            lines.push(`  class ${node.id} ${className}`);
        }
    });

    return lines.join('\n');
}

function renderMermaid(diagram) {
    const mermaidContainer = document.getElementById('mermaid');
    if (typeof mermaid === 'undefined' || typeof mermaid.run !== 'function') {
        mermaidContainer.textContent = diagram;
        return;
    }
    mermaidContainer.removeAttribute('data-processed');
    mermaidContainer.textContent = diagram;

    mermaid.run({ nodes: [mermaidContainer] }).catch(error => {
        showMessage('Error rendering Mermaid diagram', 'error');
        console.error(error);
    });
}

function updateMermaidMarkdown(diagram) {
    const output = document.getElementById('mermaidOutput');
    output.value = `\`\`\`mermaid\n${diagram}\n\`\`\``;
}

function escapeMermaidLabel(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeMermaidEdgeLabel(text) {
    return escapeMermaidLabel(text).replace(/\|/g, '/');
}

function sanitizeMermaidClass(kind) {
    const sanitized = String(kind).toLowerCase().replace(/[^a-z0-9]/g, '');
    return sanitized || 'resource';
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

// Copy Mermaid markdown to clipboard
function copyMermaidMarkdown() {
    const mermaidText = document.getElementById('mermaidOutput').value;

    if (!mermaidText.trim()) {
        showMessage('No Mermaid markdown to copy yet', 'error');
        return;
    }

    navigator.clipboard.writeText(mermaidText).then(() => {
        showMessage('Mermaid markdown copied to clipboard!', 'success');
    }).catch(() => {
        prompt('Copy this Mermaid markdown:', mermaidText);
    });
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
    document.getElementById('mermaid').textContent = '';
    document.getElementById('mermaidOutput').value = '';
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
