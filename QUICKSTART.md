# Quick Start Guide

## Getting Started in 3 Steps

### 1. Open the Application
Visit: [https://basmulder03.github.io/k8s-resource-visualizer/](https://basmulder03.github.io/k8s-resource-visualizer/)

### 2. Add Your Kubernetes YAML

Choose one of these methods:

#### Option A: Paste YAML
Copy your Kubernetes manifests and paste them into the text area.

#### Option B: Load Files
Click "📁 Load from File" and select one or more YAML files from your computer.

#### Option C: Try an Example
Copy this simple example:

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

### 3. Visualize
Click the **"Visualize"** button to generate the interactive graph.

## What You'll See

The visualizer will create a graph showing:
- **Deployments** (blue) managing **Pods** (cyan)
- **Pods** containing **Containers** (light blue)
- **ServiceAccounts** (yellow) used by Pods
- **Services** (turquoise) routing to Deployments
- **ConfigMaps** (orange) and **Secrets** (red) mounted by Pods
- **StatefulSets** (purple) and **DaemonSets** (green)

## Interacting with the Graph

- **Zoom**: Use mouse wheel or pinch gesture
- **Pan**: Click and drag the background
- **Select**: Click on nodes to highlight them
- **Move**: Drag nodes to reposition them

## Sharing Your Visualization

1. Click **"Share URL"**
2. URL is automatically copied to clipboard
3. Share the URL with your team
4. Anyone with the URL can view the same visualization

## Tips

- You can visualize multiple resources from different files at once
- The graph automatically detects relationships based on:
  - Resource references (serviceAccountName, volumes, etc.)
  - Label selectors (Services to Deployments)
  - Parent-child relationships (Deployments to Pods)
- For large deployments with many replicas, only the first 5 pods are shown with a summary node for the rest

## Supported Resource Types

✅ Deployments  
✅ StatefulSets  
✅ DaemonSets  
✅ Pods  
✅ Services  
✅ ServiceAccounts  
✅ ConfigMaps  
✅ Secrets  
✅ Ingress  
✅ PersistentVolumeClaims  
✅ Namespaces  
✅ And more...

## Troubleshooting

**Q: The graph is too crowded**
- Try visualizing fewer resources at once
- Zoom in to see details
- Drag nodes to spread them out

**Q: I don't see any relationships**
- Make sure your resources reference each other (e.g., Pods using ServiceAccounts)
- Check that Services have selectors matching Deployment labels
- Verify resource names match in references

**Q: Can I save the visualization?**
- Use the "Share URL" feature to save and share
- Take a screenshot of the graph for documentation
- The YAML is encoded in the URL, so it's completely portable

## Need Help?

Check out the [main README](README.md) for more detailed information or open an issue on GitHub.
