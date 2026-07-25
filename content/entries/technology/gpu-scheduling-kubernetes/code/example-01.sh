# Verify the operator or manual installation instead of assuming a successful Helm release
kubectl get nodes -L nvidia.com/gpu.present,nvidia.com/gpu.product
kubectl get daemonsets --all-namespaces
kubectl describe node GPU_NODE_NAME

# Confirm that the vendor resource is both present and allocatable
kubectl get node GPU_NODE_NAME \
  -o jsonpath='{.status.capacity.nvidia\.com/gpu}{" capacity, "}{.status.allocatable.nvidia\.com/gpu}{" allocatable\n"}'

# Inspect scheduling and device-allocation events for one workload
kubectl describe pod GPU_POD_NAME -n WORKLOAD_NAMESPACE
