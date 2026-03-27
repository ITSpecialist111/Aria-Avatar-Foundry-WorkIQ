// ============================================================
// Avatar Foundry — Azure Infrastructure
// Deploys: App Service (backend), Static Web App (frontend),
//          Foundry resource, Speech resource
// ============================================================

@description('Base name for all resources')
param baseName string = 'avatar-foundry'

@description('Azure region for deployment')
param location string = resourceGroup().location

@description('Speech service region (must support Voice Live + Avatar)')
param speechRegion string = 'eastus2'

@description('App Service plan SKU')
param appServiceSku string = 'B1'

@description('Static Web App SKU')
param staticWebAppSku string = 'Standard'

// ---- Variables ----
var uniqueSuffix = uniqueString(resourceGroup().id)
var appServicePlanName = '${baseName}-plan-${uniqueSuffix}'
var appServiceName = '${baseName}-api-${uniqueSuffix}'
var staticWebAppName = '${baseName}-web-${uniqueSuffix}'
var speechResourceName = '${baseName}-speech-${uniqueSuffix}'
var foundryResourceName = '${baseName}-foundry-${uniqueSuffix}'

// ---- App Service Plan ----
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServiceSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// ---- App Service (Node.js backend) ----
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      webSocketsEnabled: true
      alwaysOn: true
      cors: {
        allowedOrigins: [
          'https://${staticWebApp.properties.defaultHostname}'
        ]
        supportCredentials: true
      }
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'SPEECH_REGION', value: speechRegion }
        { name: 'SPEECH_RESOURCE_KEY', value: speechResource.listKeys().key1 }
        { name: 'AGENT_NAME', value: 'Aria' }
        { name: 'AVATAR_CHARACTER', value: 'meg' }
        { name: 'AVATAR_STYLE', value: 'casual' }
        { name: 'VOICE_NAME', value: 'en-US-Ava:DragonHDLatestNeural' }
        { name: 'VOICELIVE_API_VERSION', value: '2026-01-01-preview' }
        { name: 'MSAL_CLIENT_ID', value: '9b00c7ab-2ec3-463f-9a30-0dbfbb3800af' }
      ]
    }
    httpsOnly: true
  }
}

// ---- Static Web App (React frontend) ----
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: staticWebAppSku
  }
  properties: {
    buildProperties: {
      appLocation: 'client'
      outputLocation: 'dist'
    }
  }
}

// ---- Speech Service ----
resource speechResource 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: speechResourceName
  location: speechRegion
  kind: 'SpeechServices'
  sku: {
    name: 'S0'
  }
  properties: {}
}

// ---- AI Foundry Resource ----
resource foundryResource 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: foundryResourceName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: foundryResourceName
  }
}

// ---- Outputs ----
output appServiceUrl string = 'https://${appService.properties.defaultHostname}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output speechEndpoint string = speechResource.properties.endpoint
output foundryEndpoint string = foundryResource.properties.endpoint
output speechResourceName string = speechResource.name
output foundryResourceName string = foundryResource.name
