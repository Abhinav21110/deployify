# Deployify - Complete Technical Documentation

## Project Overview
Deployify is a **full-stack deployment automation platform** that intelligently analyzes web projects and deploys them to cloud providers (Netlify/Vercel) with zero configuration. It combines modern web technologies with containerized build systems to provide a seamless deployment experience.

---

## Tech Stack Architecture

### 🎨 **Frontend Stack**
- **React 18** + **TypeScript** - Component-based UI with type safety
- **Vite** - Lightning-fast dev server and build tool
- **Tailwind CSS** + **shadcn/ui** - Utility-first styling with pre-built components
- **TanStack Query** - Server state management and caching
- **React Router DOM** - Client-side routing
- **Sonner** - Toast notifications
- **Lucide React** - Icon library
- **Axios** - HTTP client with interceptors

### 🚀 **Backend Stack**
- **NestJS** + **TypeScript** - Scalable Node.js framework with decorators
- **PostgreSQL** + **TypeORM** - Relational database with ORM
- **Redis** + **Bull Queue** - Job queue for background processing
- **Docker** - Container runtime for isolated builds
- **Node.js Crypto** - AES-256 encryption for credentials
- **Class Validator** - Request validation
- **Swagger** - API documentation

### 🔧 **Infrastructure**
- **Docker Compose** - Multi-container orchestration
- **GitHub API** - Repository cloning and analysis
- **Netlify API** - Static site deployments
- **Vercel API** - Full-stack app deployments

---

## Complete Deployment Workflow

### **Step 1: User Input & Validation** 
**Tool: React + TypeScript**
```typescript
// EnhancedDeployModal.tsx - User fills deployment form
const deploymentData: DeploymentRequest = {
  repoUrl: 'https://github.com/user/repo',
  branch: 'main',
  environment: 'school',
  budget: 'free',
  provider: 'auto' // or specific provider
};
```
- User enters GitHub URL, selects environment, budget preferences
- React validates form data with real-time feedback
- TanStack Query handles provider/credential fetching

### **Step 2: API Request & Validation**
**Tool: NestJS + Class Validator**
```typescript
// deployment.controller.ts - Validates and accepts request
@Post()
async createDeployment(@Body() dto: CreateDeploymentDto) {
  return await this.deploymentService.createDeployment(dto);
}
```
- NestJS controller receives deployment request
- Class Validator ensures data integrity
- Request logged and stored in PostgreSQL

### **Step 3: Job Queue & Background Processing**
**Tool: Bull Queue + Redis**
```typescript
// deployment.service.ts - Queues deployment job
await this.deploymentQueue.add('process-deployment', {
  deploymentId,
  repoUrl,
  environment,
  provider
}, {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 }
});
```
- Deployment request converted to background job
- Redis stores job data and manages queue
- Bull Queue provides retry logic and timeout protection

### **Step 4: Repository Analysis**
**Tool: Docker + Git + Node.js**
```typescript
// deployment.worker.ts - Downloads and analyzes repo
const workspaceDir = await this.gitService.cloneRepository(
  job.data.repoUrl, 
  job.data.branch
);
const projectInfo = await this.projectAnalysisService.analyzeProject(workspaceDir);
```
- **Git clone** downloads repository to temporary workspace
- **File system analysis** reads package.json, config files
- **Framework detection** identifies React, Vue, Next.js, etc.
- **Build tool detection** finds Vite, Webpack, CRA setup

### **Step 5: Framework & Build Detection**
**Tool: Node.js + JSON Parsing**
```typescript
// project-analysis.service.ts - Smart framework detection
if (packageJson.dependencies?.vite && packageJson.dependencies?.react) {
  return {
    framework: 'React (Vite)',
    buildCommand: 'npm run build',
    buildDirectory: 'dist',
    type: 'spa'
  };
}
```
- **Package.json parsing** identifies dependencies
- **Config file analysis** reads vite.config.js, webpack.config.js
- **Priority-based detection** (Vite → Next.js → CRA → Static)
- **Build directory mapping** (Vite=dist, CRA=build, Next=out)

### **Step 6: Provider Selection & Optimization**
**Tool: Provider Decision Engine**
```typescript
// provider-decision.service.ts - Intelligent provider selection
const recommendation = await this.getRecommendation({
  detectedStack: { framework: 'React (Vite)', type: 'spa' },
  budget: 'free',
  userCredentials: credentials
});
// Returns: { provider: 'netlify', confidence: 0.95, plan: freePlan }
```
- **Framework compatibility** scoring (Next.js → Vercel, Static → Netlify)
- **Budget optimization** prioritizes free tiers
- **Credential availability** checks for stored API keys
- **Fallback logic** when preferred providers fail

### **Step 7: Credential Management & Security**
**Tool: Node.js Crypto + PostgreSQL**
```typescript
// credential.service.ts - Secure credential handling
const credentials = await this.getCredentialForDeployment(credentialId);
const decrypted = this.decrypt(credentials.encryptedData);
// Returns: { netlifyToken: 'real-api-key', siteId: 'optional' }
```
- **AES-256 encryption** for stored API keys
- **Database retrieval** of user credentials
- **Automatic decryption** for deployment use
- **Credential validation** against provider APIs

### **Step 8: Containerized Build Process**
**Tool: Docker + Node.js**
```typescript
// container.service.ts - Isolated build environment
const containerId = await this.docker.createContainer({
  Image: 'node:18-alpine',
  WorkingDir: '/app',
  Cmd: ['sh', '-c', 'npm install && npm run build']
});
```
- **Docker container** creates isolated build environment
- **Node.js 18 Alpine** provides lightweight, consistent runtime
- **Volume mounting** shares workspace with container
- **Build execution** runs npm install → npm run build
- **Artifact extraction** copies build output back to host

### **Step 9: Build Artifact Processing**
**Tool: Node.js File System + Archiver**
```typescript
// container.service.ts - Creates deployment package
const buildPath = path.join(workspaceDir, detectedStack.distDir); // 'dist'
const deploymentZip = await this.createDeploymentZip(buildPath);
```
- **Directory verification** ensures build output exists
- **File compression** creates ZIP archive of built files
- **Content validation** checks for index.html, assets
- **Error handling** provides detailed failure messages

### **Step 10: Provider API Deployment**
**Tool: Provider SDKs (Netlify/Vercel APIs)**
```typescript
// netlify.service.ts - Deploys to Netlify
const site = await netlifyClient.createSite({
  name: `deployment-${Date.now()}`,
});
const deployment = await netlifyClient.deployZip({
  siteId: site.id,
  body: fs.createReadStream(zipPath)
});
```
- **Netlify API** creates site and uploads ZIP archive
- **Vercel API** creates project from Git repository
- **Automatic site creation** generates unique deployment URLs
- **Build status tracking** monitors deployment progress

### **Step 11: Real-time Status Updates**
**Tool: Server-Sent Events + WebSockets**
```typescript
// logs.controller.ts - Streams deployment logs
@Sse('deployments/:id/logs/stream')
streamLogs(@Param('id') id: string) {
  return new Observable(observer => {
    // Stream real-time logs to frontend
  });
}
```
- **Server-Sent Events** push real-time updates to frontend
- **PostgreSQL triggers** notify of status changes
- **Log aggregation** collects build output, errors, success messages
- **Frontend updates** show live progress without polling

### **Step 12: Success & URL Generation**
**Tool: Database Updates + Frontend Notifications**
```typescript
// Final deployment result
const result: DeploymentResult = {
  success: true,
  deploymentUrl: 'https://deployment-123.netlify.app',
  buildTime: 45,
  provider: 'netlify',
  plan: freePlan
};
```
- **Database update** marks deployment as successful
- **URL storage** saves live deployment link
- **Notification system** shows success toast
- **Frontend refresh** updates deployment list

---

## File Structure & Responsibilities

### Frontend (`src/`)

#### Core Pages
- **`pages/Home.tsx`**: Landing page with hero section and feature overview
- **`pages/Deployments.tsx`**: Main dashboard showing deployment history, status, and management
- **`pages/Features.tsx`**: Feature showcase and provider comparison
- **`pages/Settings.tsx`**: User settings and credential management

#### Components
- **`components/EnhancedDeployModal.tsx`**: 
  - Multi-tab deployment form (Basic/Provider/Advanced settings)
  - Real-time provider selection with plan recommendations
  - Environment variable management
  - Auto-detect vs manual provider selection

- **`components/CredentialsManager.tsx`**: 
  - Add/edit/delete provider credentials (Netlify, Vercel)
  - Credential validation and encryption status
  - Provider capability display

- **`components/DeploymentLogs.tsx`**: 
  - Real-time log streaming via Server-Sent Events
  - Log filtering by level and step
  - Auto-scroll functionality
  - Error highlighting

- **`components/Navigation.tsx`**: App navigation with active route highlighting

#### API & Utils
- **`lib/api.ts`**: 
  - Centralized HTTP client with error handling
  - Type-safe API methods for all backend endpoints
  - Request/response transformation
  - Query key management for React Query

- **`types/index.ts`**: TypeScript definitions for all data models

### Backend (`backend/src/`)

#### Core Modules

##### Deployment Module (`deployment/`)
- **`deployment.controller.ts`**: 
  - REST endpoints for creating, listing, and managing deployments
  - Request validation and transformation
  - Response formatting

- **`deployment.service.ts`**: 
  - Business logic for deployment lifecycle
  - Queue job creation and management
  - Database operations for deployment records

- **`logs.controller.ts`**: 
  - Server-Sent Events endpoint for real-time logs
  - Log filtering and streaming
  - Client connection management

- **`logs.service.ts`**: 
  - Log collection and storage
  - Real-time log broadcasting
  - Log level management

##### Provider Module (`provider/`)
- **`netlify.service.ts`**: 
  - Netlify API integration
  - Site creation and deployment
  - Plan fetching and capability reporting
  - Credential validation

- **`vercel.service.ts`**: 
  - Vercel API integration
  - Project creation from Git repositories
  - Automatic deployments
  - Build status monitoring

- **`provider-decision.service.ts`**: 
  - Intelligent provider selection algorithm
  - Plan recommendation engine
  - Compatibility scoring
  - Fallback provider logic

##### Worker Module (`worker/`)
- **`deployment.worker.ts`**: 
  - Bull Queue job processor
  - Deployment orchestration
  - Error handling and retry logic
  - Workspace management

- **`container.service.ts`**: 
  - Docker container management
  - Build environment isolation
  - Image pulling and caching
  - Build artifact extraction

- **`stack-detection.service.ts`**: 
  - Framework detection (React, Vue, Next.js, etc.)
  - Build tool identification (Vite, Webpack, etc.)
  - Build command and output directory detection
  - Package.json analysis

- **`project-analysis.service.ts`**: 
  - Repository structure analysis
  - Dependency tree parsing
  - Build configuration inference
  - Project type classification

##### Authentication Module (`auth/`)
- **`credential.service.ts`**: 
  - Encrypted credential storage and retrieval
  - Provider API key management
  - Credential validation
  - User credential associations

- **`entities/user-credentials.entity.ts`**: Database schema for credentials

#### Configuration & Setup
- **`main.ts`**: Application bootstrap, middleware setup, and global configuration
- **`app.module.ts`**: Root module with all feature module imports
- **Database migrations**: Schema management and updates

---

## Key Technical Innovations

### 🧠 **Intelligent Framework Detection**
```typescript
// Priority-based detection prevents conflicts
if (viteConfig && reactDeps) → "React (Vite)" → distDir: 'dist'
if (nextConfig) → "Next.js" → distDir: 'out'  
if (reactDeps) → "React" → distDir: 'build'
```

### 🔐 **Secure Credential Management**
```typescript
// Persistent encryption prevents restart issues
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || generateKey();
const encrypted = crypto.createCipheriv('aes-256-cbc', key, iv);
```

### ⚡ **Queue-Based Architecture**
```typescript
// Background processing prevents blocking
@Processor('deployment')
export class DeploymentWorker {
  @Process('process-deployment')
  async execute(job: Job<DeploymentData>) {
    // Long-running deployment process
  }
}
```

### 🎯 **Provider Optimization**
```typescript
// Smart provider selection based on project type
const score = calculateCompatibilityScore(
  framework: 'React (Vite)',
  provider: 'netlify',
  budget: 'free'
); // Returns optimal match
```

---

## Key Features

### 1. Intelligent Project Detection
- **Multi-framework support**: React, Vue, Next.js, Nuxt.js, Static HTML
- **Build tool detection**: Vite, Webpack, Create React App
- **Automatic configuration**: Build commands, output directories, and environment setup
- **Fallback mechanisms**: Graceful handling of unknown project types

### 2. Provider Management
- **Multi-provider support**: Netlify (static sites) and Vercel (full-stack apps)
- **Plan recommendations**: Automatic free tier selection and upgrade suggestions
- **Credential security**: AES-256 encryption for stored API keys
- **Auto-selection logic**: Framework-based provider optimization

### 3. Real-time Monitoring
- **Live deployment logs**: Server-Sent Events for instant feedback
- **Status tracking**: Queued → Cloning → Building → Deploying → Success/Failed
- **Error analysis**: Detailed error messages and troubleshooting hints
- **Build metrics**: Build time, artifact size, and performance data

### 4. User Experience
- **One-click deployments**: Minimal configuration required
- **Tabbed interface**: Progressive disclosure of advanced options
- **Responsive design**: Works on desktop and mobile devices
- **Toast notifications**: Non-intrusive status updates

---

## Security & Reliability

### Security Measures
- **Credential encryption**: All API keys stored with AES-256 encryption
- **Input validation**: Comprehensive validation on all endpoints
- **CORS configuration**: Proper cross-origin request handling
- **Rate limiting**: Protection against abuse and spam

### Reliability Features
- **Queue system**: Bull Queue for reliable job processing
- **Retry logic**: Automatic retry on transient failures
- **Timeout protection**: 15-minute maximum deployment time
- **Cleanup procedures**: Automatic workspace and container cleanup
- **Health checks**: System health monitoring endpoints

---

## Development Workflow

### Local Development
1. **Database**: PostgreSQL container with persistent storage
2. **Cache**: Redis container for queue management
3. **Backend**: NestJS with hot reload via nodemon
4. **Frontend**: Vite dev server with HMR
5. **API Communication**: Proxy configuration for seamless development

### Deployment Pipeline
1. **Repository analysis**: Framework and dependency detection
2. **Provider selection**: Automatic or user-specified
3. **Credential retrieval**: Encrypted credential decryption
4. **Build execution**: Isolated container-based builds
5. **Provider deployment**: Direct API integration
6. **URL generation**: Live deployment URL provision

---

## Data Flow Summary

1. **React Form** → validates input
2. **NestJS API** → queues deployment job  
3. **Bull Worker** → processes in background
4. **Git Clone** → downloads repository
5. **File Analysis** → detects framework/build setup
6. **Provider Engine** → selects optimal deployment target
7. **Docker Build** → creates production artifacts
8. **Provider API** → deploys to Netlify/Vercel
9. **SSE Stream** → real-time progress updates
10. **Success Result** → live URL + deployment data

This architecture ensures **reliability** (queue system), **security** (encrypted credentials), **performance** (containerized builds), and **user experience** (real-time feedback) while supporting multiple cloud providers with intelligent optimization.

---

## Getting Started

### Prerequisites
- **Node.js 18+**
- **Docker & Docker Compose**
- **PostgreSQL 14+**
- **Redis**

### Installation
```bash
# Clone repository
git clone https://github.com/Abhinav21110/deployify.git
cd deployify

# Install dependencies
npm install
cd backend && npm install

# Setup environment
cp backend/.env.example backend/.env
# Edit .env with your database credentials

# Start infrastructure
docker-compose up -d postgres redis

# Start backend
cd backend && npm run start:dev

# Start frontend
npm run dev
```

### Configuration
1. **Add Provider Credentials**: Go to Settings → Add Credentials
2. **Configure Providers**: Add Netlify/Vercel API tokens
3. **Test Deployment**: Deploy a sample repository

This documentation provides a complete technical overview of Deployify's architecture, workflow, and implementation details for developers and contributors.
