# Kubernetes Resource Visualizer 🚀

A browser-based tool to visualize Kubernetes resources and their relationships as an interactive graph. Perfect for understanding your cluster's resource topology, sharing configurations, and documentation.

## Features

- 📊 **Mermaid Graph Visualization** - See your Kubernetes resources and their relationships in a Mermaid diagram
- 🧾 **Mermaid Markdown Export** - View and copy the generated Mermaid markdown for documentation
- 🔗 **Relationship Mapping** - Automatically detects relationships between:
  - Deployments → Pods → Containers
  - StatefulSets → Pods → Containers
  - DaemonSets → Pods → Containers
  - Pods → ServiceAccounts
  - Pods → ConfigMaps
  - Pods → Secrets
  - Services → Deployments (via label selectors)
- 📤 **URL Sharing** - Share your visualizations via URL
- 📁 **Multi-File Support** - Load multiple YAML files at once
- 🎨 **Color-Coded Resources** - Different colors for each resource type
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🌐 **Client-Side Only** - All processing happens in your browser, no server needed

## Live Demo

Visit the live application: [https://basmulder03.github.io/k8s-resource-visualizer/](https://basmulder03.github.io/k8s-resource-visualizer/)

## Usage

### 1. Paste YAML

Simply paste your Kubernetes YAML manifests into the text area and click "Visualize".

### 2. Load from File

Click "📁 Load from File" to upload one or multiple YAML files from your computer.

### 3. Share via URL

After visualizing your resources:
1. Click "Share URL"
2. The URL is automatically copied to your clipboard
3. Share it with your team

## Supported Resource Types

- ✅ Deployments
- ✅ StatefulSets
- ✅ DaemonSets
- ✅ Pods
- ✅ Services
- ✅ ServiceAccounts
- ✅ ConfigMaps
- ✅ Secrets
- ✅ And more...

## Example YAML

See the [examples](./examples) folder for sample Kubernetes manifests, or try this simple example:

```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      serviceAccountName: my-app-sa
      containers:
      - name: nginx
        image: nginx:1.21
---
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
  ports:
  - port: 80
```

## How It Works

The visualizer:
1. Parses your YAML using `js-yaml` library
2. Extracts Kubernetes resources and their metadata
3. Analyzes relationships based on:
   - Spec references (e.g., `serviceAccountName`, volume mounts)
   - Label selectors (e.g., Service to Deployment matching)
   - Parent-child relationships (e.g., Deployment manages Pods)
4. Renders a Mermaid diagram and markdown snippet for sharing

## Technology Stack

- **HTML5/CSS3** - Modern, responsive UI
- **JavaScript (Vanilla)** - No framework dependencies
- **Mermaid** - Diagram rendering library
- **js-yaml** - YAML parsing library
- **GitHub Pages** - Hosting

## Development

To run locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/basmulder03/k8s-resource-visualizer.git
   cd k8s-resource-visualizer
   ```

2. Open `index.html` in your browser or serve with a local HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx http-server
   ```

3. Navigate to `http://localhost:8000`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this tool for any purpose.

## Acknowledgments

- Built with [Mermaid](https://mermaid.js.org/)
- YAML parsing by [js-yaml](https://github.com/nodeca/js-yaml)
- Inspired by the need for better Kubernetes resource visualization
