param location string
param tags object

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-orders-${tags.environment}'
  location: location
  tags: tags
}

output principalId string = identity.properties.principalId
