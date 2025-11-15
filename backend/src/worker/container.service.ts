import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// dockerode uses CommonJS exports; require() ensures the constructor is available at runtime
const Docker = require('dockerode');
import * as path from 'path';
import * as fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { DetectedStack } from '../common/types';

interface BuildOptions {
  workspaceDir: string;
  detectedStack: DetectedStack;
  deploymentId: string;
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
}

interface BuildResult {
  success: boolean;
  artifactPath?: string;
  error?: string;
  imageId?: string;
}

@Injectable()
export class ContainerService {
  private readonly logger = new Logger(ContainerService.name);
  // Use `any` here to avoid typing issues with the CommonJS import
  private readonly docker: any;
  private readonly workspaceBase: string;

  constructor(private configService: ConfigService) {
    // Configure Docker client for local development (Windows Docker Desktop)
    const dockerHost = this.configService.get('DOCKER_HOST');
    const dockerConfig: any = {
      version: 'v1.41',
    };

    if (dockerHost) {
      // If DOCKER_HOST is set, use it (for remote Docker)
      const [protocol, hostPort] = dockerHost.split('://');
      const [host, port] = hostPort.split(':');
      dockerConfig.host = host;
      dockerConfig.port = parseInt(port) || (protocol === 'tcp' ? 2376 : 2375);
      
      // Only use TLS if explicitly enabled
      if (this.configService.get('DOCKER_TLS_VERIFY')) {
        dockerConfig.ca = this.configService.get('DOCKER_CERT_PATH');
        dockerConfig.cert = this.configService.get('DOCKER_CERT_PATH');
        dockerConfig.key = this.configService.get('DOCKER_CERT_PATH');
      }
    } else {
      // Local development - use Docker Desktop's default socket/pipe
      if (process.platform === 'win32') {
        dockerConfig.socketPath = '\\\\.\\pipe\\docker_engine';
      } else {
        dockerConfig.socketPath = '/var/run/docker.sock';
      }
    }

    this.docker = new Docker(dockerConfig);
    // Use Windows-compatible temp directory
    this.workspaceBase = path.join(process.env.TEMP || 'C:\\temp', 'deployify-workspaces');
  }

  async cloneRepository(repoUrl: string, branch: string = 'main'): Promise<string> {
    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workspaceDir = path.join(this.workspaceBase, workspaceId);

    try {
      // Ensure base directory exists
      await fs.mkdir(this.workspaceBase, { recursive: true });
      
      // If workspace directory already exists, remove it first
      try {
        await fs.access(workspaceDir);
        await fs.rm(workspaceDir, { recursive: true, force: true });
        this.logger.log(`Removed existing workspace: ${workspaceDir}`);
      } catch {
        // Directory doesn't exist, which is fine
      }
      
      await fs.mkdir(workspaceDir, { recursive: true });
      
      const git = simpleGit();
      
      // First try to clone with the specified branch
      try {
        await git.clone(repoUrl, workspaceDir, ['--branch', branch, '--depth', '1']);
        this.logger.log(`Repository cloned to ${workspaceDir} using branch ${branch}`);
        return workspaceDir;
      } catch (branchError) {
        // If branch doesn't exist, try to get the default branch
        this.logger.warn(`Branch ${branch} not found, trying to detect default branch`);
        
        // Clean up failed attempt
        try {
          await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
        
        // Try common default branch names
        const commonBranches = ['main', 'master', 'develop', 'dev'];
        const branchesToTry = branch !== 'main' ? commonBranches : ['master', 'develop', 'dev'];
        
        for (const tryBranch of branchesToTry) {
          try {
            await fs.mkdir(workspaceDir, { recursive: true });
            await git.clone(repoUrl, workspaceDir, ['--branch', tryBranch, '--depth', '1']);
            this.logger.log(`Repository cloned to ${workspaceDir} using default branch ${tryBranch}`);
            return workspaceDir;
          } catch (error) {
            // Clean up and try next branch
            try {
              await fs.rm(workspaceDir, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
            continue;
          }
        }
        
        // If all specific branches fail, clone without specifying branch (get default)
        try {
          await fs.mkdir(workspaceDir, { recursive: true });
          await git.clone(repoUrl, workspaceDir, ['--depth', '1']);
          this.logger.log(`Repository cloned to ${workspaceDir} using repository default branch`);
          return workspaceDir;
        } catch (finalError) {
          throw new Error(`Unable to clone repository. Original error: ${branchError.message}, Final error: ${finalError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to clone repository: ${error.message}`);
      
      // Clean up on failure
      try {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup failed workspace: ${cleanupError.message}`);
      }
      
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async buildProject(options: BuildOptions): Promise<BuildResult> {
    const { workspaceDir, detectedStack, deploymentId, onLog } = options;

    try {
      // If Dockerfile exists, use Docker build
      if (detectedStack.hasDockerfile) {
        return this.buildWithDockerfile(workspaceDir, deploymentId, onLog);
      }

      // For pure static HTML projects, skip build process
      if (this.isStaticHtmlProject(detectedStack)) {
        onLog('info', 'Detected pure static HTML project, skipping build process...');
        return this.buildStaticProject(workspaceDir, detectedStack, onLog);
      }

      // Otherwise, use language-specific build in container
      return this.buildWithLanguageContainer(workspaceDir, detectedStack, deploymentId, onLog);
    } catch (error) {
      this.logger.error(`Build failed for ${deploymentId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async buildWithDockerfile(
    workspaceDir: string,
    deploymentId: string,
    onLog: (level: string, message: string) => void,
  ): Promise<BuildResult> {
    const imageName = `deployify-${deploymentId.toLowerCase()}`;

    try {
      onLog('info', 'Building Docker image...');

      const stream = await this.docker.buildImage(
        {
          context: workspaceDir,
          src: ['.'],
        },
        {
          t: imageName,
          dockerfile: 'Dockerfile',
        },
      );

      // Monitor build progress
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(
          stream,
          (err, res) => {
            if (err) reject(err);
            else resolve(res);
          },
          (event) => {
            if (event.stream) {
              onLog('info', event.stream.trim());
            }
          },
        );
      });

      onLog('info', `Docker image built: ${imageName}`);

      return {
        success: true,
        imageId: imageName,
        artifactPath: workspaceDir, // For container deployments
      };
    } catch (error) {
      onLog('error', `Docker build failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async buildWithLanguageContainer(
    workspaceDir: string,
    detectedStack: DetectedStack,
    deploymentId: string,
    onLog: (level: string, message: string) => void,
  ): Promise<BuildResult> {
    const buildImage = this.getBuildImage(detectedStack);
    const buildCommands = this.getBuildCommands(detectedStack);

    try {
      onLog('info', `Starting build with ${buildImage}...`);

      // Pull the Docker image if it doesn't exist
      try {
        await this.pullImageIfNeeded(buildImage, onLog);
      } catch (pullError) {
        onLog('error', `Failed to pull image ${buildImage}: ${pullError.message}`);
        return {
          success: false,
          error: `Failed to pull Docker image: ${pullError.message}`,
        };
      }

      // Create container for building
      const container = await this.docker.createContainer({
        Image: buildImage,
        Cmd: ['sh', '-c', buildCommands.join(' && ')],
        WorkingDir: '/workspace',
        HostConfig: {
          Binds: [`${workspaceDir}:/workspace`],
          Memory: 4 * 1024 * 1024 * 1024, // 4GB
          CpuShares: 1024,
        },
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
      });

      // Monitor build output
      stream.on('data', (chunk) => {
        const message = chunk.toString().trim();
        if (message) {
          onLog('info', message);
        }
      });

      await container.start();
      const result = await container.wait();

      if (result.StatusCode !== 0) {
        throw new Error(`Build failed with exit code ${result.StatusCode}`);
      }

      onLog('info', 'Build completed successfully');

      // Create artifact archive for static deployments
      const artifactPath = await this.createArtifact(workspaceDir, detectedStack);

      await container.remove();

      return {
        success: true,
        artifactPath,
      };
    } catch (error) {
      onLog('error', `Container build failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getBuildImage(detectedStack: DetectedStack): string {
    switch (detectedStack.type) {
      case 'static':
      case 'spa':
      case 'ssr':
        return 'node:18-alpine';
      case 'api':
        if (detectedStack.framework?.toLowerCase().includes('python')) {
          return 'python:3.11-alpine';
        }
        return 'node:18-alpine';
      default:
        return 'node:18-alpine';
    }
  }

  private getBuildCommands(detectedStack: DetectedStack): string[] {
    const commands: string[] = [];

    // Install dependencies
    switch (detectedStack.packageManager) {
      case 'npm':
        commands.push('npm ci --production=false');
        break;
      case 'yarn':
        commands.push('yarn install --frozen-lockfile');
        break;
      case 'pnpm':
        commands.push('npm install -g pnpm && pnpm install');
        break;
      case 'bun':
        commands.push('npm install -g bun && bun install');
        break;
    }

    // Build command
    if (detectedStack.buildCmd) {
      commands.push(detectedStack.buildCmd);
    }

    return commands;
  }

  private async createArtifact(workspaceDir: string, detectedStack: DetectedStack): Promise<string> {
    const distDir = detectedStack.distDir || 'dist';
    const fullDistPath = path.join(workspaceDir, distDir);

    this.logger.log(`Creating artifact from directory: ${distDir}`);
    this.logger.log(`Full path: ${fullDistPath}`);

    try {
      await fs.access(fullDistPath);
      this.logger.log(`Build directory exists: ${fullDistPath}`);
      return fullDistPath;
    } catch {
      this.logger.warn(`Build directory '${distDir}' doesn't exist at ${fullDistPath}, using workspace root`);
      
      // List available directories for debugging
      try {
        const availableDirs = await fs.readdir(workspaceDir, { withFileTypes: true });
        const directories = availableDirs.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
        this.logger.log(`Available directories in workspace: ${directories.join(', ')}`);
      } catch (listError) {
        this.logger.warn(`Could not list workspace directories: ${listError.message}`);
      }
      
      return workspaceDir;
    }
  }

  private isStaticHtmlProject(detectedStack: DetectedStack): boolean {
    // Check if it's a static HTML project without Node.js dependencies
    return detectedStack.type === 'static' && 
           detectedStack.framework === 'Static HTML' &&
           (!detectedStack.dependencies || Object.keys(detectedStack.dependencies).length === 0);
  }

  private async buildStaticProject(
    workspaceDir: string, 
    detectedStack: DetectedStack, 
    onLog: (level: string, message: string) => void
  ): Promise<BuildResult> {
    try {
      onLog('info', 'Processing static HTML project...');
      
      // For static projects, just return the workspace directory as the artifact
      const artifactPath = await this.createArtifact(workspaceDir, detectedStack);
      
      onLog('info', `Static project ready for deployment: ${artifactPath}`);
      
      return {
        success: true,
        artifactPath,
      };
    } catch (error) {
      onLog('error', `Failed to process static project: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cleanup(workspaceDir: string): Promise<void> {
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true });
      this.logger.log(`Cleaned up workspace: ${workspaceDir}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup workspace ${workspaceDir}: ${error.message}`);
    }
  }

  async pullImage(imageName: string): Promise<void> {
    try {
      this.logger.log(`Pulling Docker image: ${imageName}`);
      const stream = await this.docker.pull(imageName);
      
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      
      this.logger.log(`Successfully pulled image: ${imageName}`);
    } catch (error) {
      this.logger.error(`Failed to pull image ${imageName}: ${error.message}`);
      throw error;
    }
  }

  private async pullImageIfNeeded(imageName: string, onLog: (level: string, message: string) => void): Promise<void> {
    try {
      // Check if image exists locally
      const image = this.docker.getImage(imageName);
      await image.inspect();
      onLog('info', `Using existing Docker image: ${imageName}`);
    } catch (error) {
      // Image doesn't exist, pull it
      onLog('info', `Pulling Docker image: ${imageName}...`);
      
      const stream = await this.docker.pull(imageName);
      
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }, (event) => {
          if (event.status) {
            onLog('info', `Pull ${imageName}: ${event.status}`);
          }
        });
      });
      
      onLog('info', `Successfully pulled Docker image: ${imageName}`);
    }
  }
}