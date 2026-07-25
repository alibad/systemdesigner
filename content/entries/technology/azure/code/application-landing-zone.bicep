targetScope = 'subscription'

@description('Azure region selected for latency, residency, service availability, and resilience.')
param location string

@allowed([
  'dev'
  'test'
  'prod'
])
param environment string

@description('Stable workload owner used for routing alerts and cost attribution.')
param owner string

var resourceGroupName = 'rg-orders-${environment}'
var commonTags = {
  workload: 'orders'
  environment: environment
  owner: owner
  managedBy: 'bicep'
}

resource workloadGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module workloadIdentity './workload-identity.bicep' = {
  name: 'orders-identity-${environment}'
  scope: workloadGroup
  params: {
    location: location
    tags: commonTags
  }
}

output resourceGroupId string = workloadGroup.id
output managedIdentityPrincipalId string = workloadIdentity.outputs.principalId
